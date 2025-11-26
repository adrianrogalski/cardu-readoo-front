<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { ExpansionResponse } from '@/api/expansion'
import { fetchAllExpansions } from '@/api/expansion'
import type { CardResponse } from '@/api/card'
import { fetchCardsByExpansionName } from '@/api/card'
import type { OfferPointResponse } from '@/api/offer'
import { addOffer, deleteOffer, fetchOffersByCardName, patchOffer } from '@/api/offer'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const isAdmin = computed(() => auth.user?.roles.includes('ROLE_ADMIN'))

// flaga sterująca widocznością akcji admina dla ofert
// domyślnie true dla wygody, ale będzie wyłączana przy dodawaniu kolejnych serii
const showAdminOfferActions = ref(true)

const expansions = ref<ExpansionResponse[]>([])
const isLoadingExpansions = ref(false)
const loadExpansionsError = ref<string | null>(null)

const selectedExpansionName = ref<string | null>(null)
const selectedCardName = ref<string | null>(null)
const submitError = ref<string | null>(null)

const cards = ref<CardResponse[]>([])
const isLoadingCards = ref(false)
const loadCardsError = ref<string | null>(null)

const isLoadingOffers = ref(false)
const offersError = ref<string | null>(null)

// WIELE SERII OFERT
interface OfferSeries {
  id: number
  card: CardResponse
  offers: OfferPointResponse[]
  lineColor: string
  pointColor: string
  label: string // np. "Dark Ritual_1"
}

const series = ref<OfferSeries[]>([])
const nextSeriesId = ref(1)

// zflattenowane oferty z informacją o serii
const allOffers = computed(
  () =>
    series.value.flatMap((s) =>
      s.offers.map((o) => ({
        ...o,
        _seriesId: s.id,
        _seriesLabel: s.label,
        _seriesLineColor: s.lineColor,
        _seriesPointColor: s.pointColor,
      })),
    ) as (OfferPointResponse & {
      _seriesId: number
      _seriesLabel: string
      _seriesLineColor: string
      _seriesPointColor: string
    })[],
)

// zaznaczenie wybranej oferty (wiersz + punkt na wykresie)
const selectedOfferId = ref<number | null>(null)

const hasSearched = ref(false)

const fromDate = ref<string | null>(null)
const toDate = ref<string | null>(null)

// konfiguracja wykresu liniowego
const lineColor = ref<string>('#2563eb')
const pointColor = ref<string>('#1d4ed8')
const axisLabelColor = ref<string>('#475569')

const chartTitle = ref<string>('Offer history for selected card')
const xAxisLabel = ref<string>('Offer listing time')
const yAxisLabel = ref<string>('Price')

const isChartConfigVisible = ref(false)

// konfiguracja wykresu słupkowego
const barColor = ref<string>('#22c55e')
const barAxisLabelColor = ref<string>('#475569')
const barChartTitle = ref<string>('Offers count per card')
const barXAxisLabel = ref<string>('Card name')
const barYAxisLabel = ref<string>('Number of offers')
const isBarChartConfigVisible = ref(false)

const canSubmit = computed(() => !!selectedExpansionName.value && !!selectedCardName.value)

// pomocnicze kolory dla kolejnych serii (domyślne wartości startowe)
const baseLineColors = ['#2563eb', '#22c55e', '#f97316', '#ec4899', '#a855f7'] as const
const basePointColors = ['#1d4ed8', '#16a34a', '#ea580c', '#db2777', '#7c3aed'] as const

function pickSeriesLineColor(id: number): string {
  const idx = (id - 1) % baseLineColors.length
  return baseLineColors[idx] ?? '#2563eb'
}

function pickSeriesPointColor(id: number): string {
  const idx = (id - 1) % basePointColors.length
  return basePointColors[idx] ?? '#1d4ed8'
}

async function loadExpansions() {
  isLoadingExpansions.value = true
  loadExpansionsError.value = null
  try {
    expansions.value = await fetchAllExpansions()
  } catch {
    loadExpansionsError.value = 'Failed to load expansions list'
  } finally {
    isLoadingExpansions.value = false
  }
}

async function loadCardsForExpansion(name: string) {
  isLoadingCards.value = true
  loadCardsError.value = null
  cards.value = []
  selectedCardName.value = null

  try {
    cards.value = await fetchCardsByExpansionName(name)
  } catch {
    loadCardsError.value = 'Failed to load cards for selected expansion'
  } finally {
    isLoadingCards.value = false
  }
}

async function handleAddSeries() {
  submitError.value = null
  offersError.value = null

  if (!selectedExpansionName.value || !selectedCardName.value) {
    submitError.value = 'Select expansion and card name'
    return
  }

  const card = cards.value.find((c) => c.cardName === selectedCardName.value)
  if (!card) {
    submitError.value = 'Selected card was not found for this expansion'
    return
  }

  // nie dodawaj serii, jeżeli już istnieje dla tej karty w tym samym zakresie
  const alreadyExists = series.value.some((s) => s.card.cardName === card.cardName)
  if (alreadyExists) {
    submitError.value = 'Series for this card is already added'
    return
  }

  const fromIso = fromDate.value ? new Date(fromDate.value + 'T00:00:00Z').toISOString() : undefined
  const toIso = toDate.value ? new Date(toDate.value + 'T23:59:59Z').toISOString() : undefined

  isLoadingOffers.value = true
  try {
    const fetched = await fetchOffersByCardName(card.expExternalId, card.cardName, fromIso, toIso)

    const id = nextSeriesId.value++
    const label = card.cardName

    // domyślne kolory serii bazujące na kolejności
    const defaultLineColor = pickSeriesLineColor(id)
    const defaultPointColor = pickSeriesPointColor(id)

    series.value.push({
      id,
      card,
      offers: fetched.map((o) => ({ ...o, cardName: card.cardName })),
      lineColor: defaultLineColor,
      pointColor: defaultPointColor,
      label,
    })

    // jeżeli po dodaniu mamy więcej niż jedną serię, ukrywamy akcje admina
    showAdminOfferActions.value = series.value.length <= 1

    hasSearched.value = true
  } catch {
    offersError.value = 'Failed to load offers for this series'
  } finally {
    isLoadingOffers.value = false
  }
}

async function handleSubmit() {
  // nowe wyszukiwanie – kasujemy poprzednie serie i dodajemy pierwszą
  series.value = []
  nextSeriesId.value = 1
  selectedOfferId.value = null
  // przy nowym wyszukiwaniu ponownie pozwalamy na akcje admina, bo będzie pojedyncza seria
  showAdminOfferActions.value = true
  await handleAddSeries()
}

watch(selectedExpansionName, (newName) => {
  if (newName) {
    void loadCardsForExpansion(newName)
  } else {
    cards.value = []
    selectedCardName.value = null
  }
  // reset wyników
  series.value = []
  nextSeriesId.value = 1
  selectedOfferId.value = null
  offersError.value = null
  hasSearched.value = false
  isAddOfferVisible.value = false
  resetAddOfferForm()
  // przy zmianie ekspansji również resetujemy widoczność akcji admina
  showAdminOfferActions.value = true
})

onMounted(() => {
  void loadExpansions()
})

const isAddOfferVisible = ref(false)
const newOfferAmount = ref('')
const newOfferCurrency = ref('PLN')
const addOfferError = ref<string | null>(null)
const isSavingOffer = ref(false)

function resetAddOfferForm() {
  newOfferAmount.value = ''
  newOfferCurrency.value = 'PLN'
  addOfferError.value = null
}

async function handleAddOffer() {
  addOfferError.value = null

  if (!selectedExpansionName.value || !selectedCardName.value) {
    addOfferError.value = 'Najpierw wybierz ekspansję i kartę'
    return
  }

  const card = cards.value.find((c) => c.cardName === selectedCardName.value)
  if (!card) {
    addOfferError.value = 'Nie znaleziono wybranej karty dla tej ekspansji'
    return
  }

  const normalizedAmount = newOfferAmount.value.replace(',', '.').trim()
  const amountNum = Number(normalizedAmount)
  if (!normalizedAmount || Number.isNaN(amountNum) || amountNum <= 0) {
    addOfferError.value = 'Provide valid positive price'
    return
  }

  // ograniczenie do maksymalnie 2 miejsc po przecinku
  if (/\.(\d{3,})$/.test(normalizedAmount)) {
    addOfferError.value = 'Price can have at most 2 decimal places'
    return
  }

  // wymuszamy PLN jako jedyną wspieraną walutę
  const currency = 'PLN'

  const nowIso = new Date().toISOString()

  isSavingOffer.value = true
  try {
    await addOffer({
      expExternalId: card.expExternalId,
      cardNumber: card.cardNumber,
      amount: normalizedAmount,
      currency,
      listedAt: nowIso,
      cardName: card.cardName,
      cardRarity: card.cardRarity,
    })

    resetAddOfferForm()
    isAddOfferVisible.value = false

    await handleSubmit()
  } catch {
    addOfferError.value = 'Failed to add offer'
  } finally {
    isSavingOffer.value = false
  }
}

const editingOfferId = ref<number | null>(null)
const editOfferAmount = ref('')
const editOfferError = ref<string | null>(null)
const isSavingEditOffer = ref(false)

const deletingOfferId = ref<number | null>(null)

function startEditOffer(offer: OfferPointResponse) {
  editingOfferId.value = offer.id
  editOfferAmount.value = offer.amount.toString()
  editOfferError.value = null
}

function cancelEditOffer() {
  editingOfferId.value = null
  editOfferAmount.value = ''
  editOfferError.value = null
}

async function handleSaveOffer(offer: OfferPointResponse) {
  const normalizedAmount = editOfferAmount.value.replace(',', '.').trim()
  const amountNum = Number(normalizedAmount)

  if (!normalizedAmount || Number.isNaN(amountNum) || amountNum <= 0) {
    editOfferError.value = 'Provide valid positive price'
    return
  }

  // ograniczenie do maksymalnie 2 miejsc po przecinku przy edycji
  if (/\.(\d{3,})$/.test(normalizedAmount)) {
    editOfferError.value = 'Price can have at most 2 decimal places'
    return
  }

  isSavingEditOffer.value = true
  try {
    await patchOffer(offer.id, {
      amount: normalizedAmount,
      currency: null,
      listedAt: null,
    })

    cancelEditOffer()
    await handleSubmit()
  } catch {
    editOfferError.value = 'Failed to update offer'
  } finally {
    isSavingEditOffer.value = false
  }
}

async function handleDeleteOffer(offer: OfferPointResponse) {
  if (!window.confirm(`Are you sure you want to delete offer from ${formatOfferDate(offer.listedAt)} for ${offer.amount} ${offer.currency}?`)) {
    return
  }

  deletingOfferId.value = offer.id
  try {
    await deleteOffer(offer.id)
    await handleSubmit()
  } catch {
    alert('Failed to delete offer')
  } finally {
    deletingOfferId.value = null
  }
}

const chartWidth = 600
const chartHeight = 230
const chartPaddingX = 40
const chartPaddingY = 24

// domena czasu/ceny dla WSZYSTKICH serii (wspólne osie)
const chartDomain = computed(() => {
  const pts = allOffers.value
    .map((o) => ({
      time: new Date(o.listedAt).getTime(),
      amount: o.amount,
    }))
    .filter((p) => !Number.isNaN(p.time))

  if (pts.length === 0) return null

  const times = pts.map((p) => p.time)
  const amounts = pts.map((p) => p.amount)

  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)
  const minAmount = Math.min(...amounts)
  const maxAmount = Math.max(...amounts)

  return { minTime, maxTime, minAmount, maxAmount }
})

const scaleX = (t: number) => {
  if (!chartDomain.value) return chartPaddingX
  const { minTime, maxTime } = chartDomain.value
  const span = maxTime - minTime || 1
  return chartPaddingX + ((t - minTime) / span) * (chartWidth - 2 * chartPaddingX)
}

const scaleY = (a: number) => {
  if (!chartDomain.value) return chartHeight - chartPaddingY
  const { minAmount, maxAmount } = chartDomain.value
  const span = maxAmount - minAmount || 1
  return chartHeight - chartPaddingY - ((a - minAmount) / span) * (chartHeight - 2 * chartPaddingY)
}

// SERIE DLA WYKRESU LINIOWEGO
interface LineSeriesView {
  id: number
  label: string
  lineColor: string
  pointColor: string
  path: string
  points: { id: number; x: number; y: number }[]
}

const lineSeries = computed<LineSeriesView[]>(() => {
  if (!chartDomain.value) return []

  return series.value.map((s) => {
    const pts = s.offers
      .map((o) => ({
        id: o.id,
        time: new Date(o.listedAt).getTime(),
        amount: o.amount,
      }))
      .filter((p) => !Number.isNaN(p.time))
      .sort((a, b) => a.time - b.time)

    const path = pts
      .map((p, idx) => {
        const x = scaleX(p.time)
        const y = scaleY(p.amount)
        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')

    const points = pts.map((p) => ({ id: p.id, x: scaleX(p.time), y: scaleY(p.amount) }))

    return {
      id: s.id,
      label: s.label,
      lineColor: s.lineColor,
      pointColor: s.pointColor,
      path,
      points,
    }
  })
})

// OŚ X/Y dla wykresu liniowego (na bazie chartDomain jak wcześniej)
const xTicks = computed(() => {
  if (!chartDomain.value) return []
  const { minTime, maxTime } = chartDomain.value
  const span = maxTime - minTime || 1

  const count = 4
  const tickInterval = span / count

  const ticks: { x: number; label: string }[] = []
  for (let i = 0; i <= count; i++) {
    const t = minTime + tickInterval * i
    const d = new Date(t)
    const label = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d
      .getMinutes()
      .toString()
      .padStart(2, '0')}`
    ticks.push({ x: scaleX(t), label })
  }
  return ticks
})

const yTicks = computed(() => {
  if (!chartDomain.value) return []
  const { minAmount, maxAmount } = chartDomain.value
  const span = maxAmount - minAmount || 1

  const count = 4
  const tickInterval = span / count

  const ticks: { y: number; label: string }[] = []
  for (let i = 0; i <= count; i++) {
    const v = minAmount + tickInterval * i
    ticks.push({ y: scaleY(v), label: v.toFixed(2) })
  }
  return ticks
})

// WYKRES SŁUPKOWY – ILOŚĆ OFERT PER SERIA
const barData = computed(() =>
  series.value.map((s) => ({
    label: s.label,
    count: s.offers.length,
    color: s.lineColor,
  })),
)

const barChartDomain = computed(() => {
  if (barData.value.length === 0) return null
  const maxCount = Math.max(...barData.value.map((b) => b.count))
  return { maxCount }
})

const barScaleX = (index: number, total: number) => {
  if (total === 0) return chartPaddingX
  const plotWidth = chartWidth - 2 * chartPaddingX
  const barWidth = plotWidth / Math.max(total, 1)
  return chartPaddingX + index * barWidth + barWidth / 2
}

const barScaleY = (count: number) => {
  if (!barChartDomain.value) return chartHeight - chartPaddingY
  const { maxCount } = barChartDomain.value
  const span = maxCount || 1
  return chartHeight - chartPaddingY - (count / span) * (chartHeight - 2 * chartPaddingY)
}

const barYTicks = computed(() => {
  if (!barChartDomain.value) return []
  const { maxCount } = barChartDomain.value
  const span = maxCount || 1
  const count = 4
  const tickInterval = span / count

  const ticks: { y: number; label: string }[] = []
  for (let i = 0; i <= count; i++) {
    const v = Math.round(tickInterval * i)
    ticks.push({ y: barScaleY(v), label: String(v) })
  }
  return ticks
})

const displayDateRange = computed(() => {
  if (allOffers.value.length === 0) {
    return { from: null as string | null, to: null as string | null }
  }

  const parseDateOnly = (value: string | null) => (value && value.trim().length > 0 ? value : null)

  const fromUi = parseDateOnly(fromDate.value)
  const toUi = parseDateOnly(toDate.value)

  if (fromUi || toUi) {
    return { from: fromUi, to: toUi }
  }

  const times = allOffers.value
    .map((o) => new Date(o.listedAt).getTime())
    .filter((t) => !Number.isNaN(t))

  if (times.length === 0) {
    return { from: null, to: null }
  }

  const minTime = Math.min(...times)
  const maxTime = Math.max(...times)

  const toInputDate = (ms: number) => {
    const d = new Date(ms)
    const y = d.getFullYear()
    const m = (d.getMonth() + 1).toString().padStart(2, '0')
    const day = d.getDate().toString().padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  return {
    from: toInputDate(minTime),
    to: toInputDate(maxTime),
  }
})

function formatOfferDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso

  const pad = (n: number) => n.toString().padStart(2, '0')

  const day = pad(d.getDate())
  const month = pad(d.getMonth() + 1)
  const year = d.getFullYear()
  const hours = pad(d.getHours())
  const minutes = pad(d.getMinutes())

  return `${day}.${month}.${year} ${hours}:${minutes}`
}

function removeSeries(id: number) {
  // usuń serię o podanym id
  series.value = series.value.filter((s) => s.id !== id)

  // jeżeli zaznaczona oferta należała do usuniętej serii, wyczyść zaznaczenie
  if (selectedOfferId.value !== null) {
    const stillExists = series.value.some((s) => s.offers.some((o) => o.id === selectedOfferId.value))
    if (!stillExists) {
      selectedOfferId.value = null
    }
  }

  // aktualizacja widoczności akcji admina:
  // - 0 serii: brak wyników, akcje nie mają sensu
  // - 1 seria: przywracamy akcje admina
  // - >1 serii: akcje ukryte (jak po dodaniu wielu serii)
  if (series.value.length === 0) {
    hasSearched.value = false
    showAdminOfferActions.value = false
  } else if (series.value.length === 1) {
    showAdminOfferActions.value = true
  } else {
    showAdminOfferActions.value = false
  }
}
</script>

<template>
  <div class="w-full bg-white rounded-xl shadow-md p-4 sm:p-6 flex flex-col gap-6">
    <section class="print:hidden">
      <h2 class="text-lg sm:text-xl font-semibold mb-2 text-slate-900">Offer - Search</h2>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="flex flex-col gap-2 max-w-md w-full">
          <label for="offerExpansionName" class="text-sm font-medium text-slate-700">Expansion name</label>
          <select
            id="offerExpansionName"
            v-model="selectedExpansionName"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option :value="null">-- select expansion --</option>
            <option
              v-for="exp in expansions"
              :key="exp.externalId"
              :value="exp.name"
            >
              {{ exp.name }}
            </option>
          </select>
          <p v-if="isLoadingExpansions" class="text-xs text-slate-500">Loading expansions...</p>
          <p v-if="loadExpansionsError" class="text-xs text-red-600">{{ loadExpansionsError }}</p>
        </div>

        <div class="flex flex-col gap-2 max-w-md w-full">
          <label for="offerCardName" class="text-sm font-medium text-slate-700">Card name</label>
          <select
            id="offerCardName"
            v-model="selectedCardName"
            :disabled="!selectedExpansionName || isLoadingCards || cards.length === 0"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option :value="null">-- select card --</option>
            <option
              v-for="card in cards"
              :key="card.cardNumber + card.cardName"
              :value="card.cardName"
            >
              {{ card.cardName }} ({{ card.cardNumber }})
            </option>
          </select>
          <p v-if="isLoadingCards" class="text-xs text-slate-500">Loading cards...</p>
          <p v-if="loadCardsError" class="text-xs text-red-600">{{ loadCardsError }}</p>
        </div>

        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div class="flex flex-col gap-2 max-w-xs w-full">
            <label for="offerFromDate" class="text-sm font-medium text-slate-700">Date from (optional)</label>
            <input
              id="offerFromDate"
              v-model="fromDate"
              type="date"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div class="flex flex-col gap-2 max-w-xs w-full">
            <label for="offerToDate" class="text-sm font-medium text-slate-700">Date to (optional)</label>
            <input
              id="offerToDate"
              v-model="toDate"
              type="date"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            :disabled="!canSubmit || isLoadingOffers"
            class="inline-flex justify-center items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {{ isLoadingOffers ? 'Searching...' : 'Search offers' }}
          </button>

          <button
            type="button"
            :disabled="!canSubmit || isLoadingOffers"
            class="inline-flex items-center rounded border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            @click="handleAddSeries"
          >
            Add series
          </button>

          <span v-if="series.length > 0" class="text-xs text-slate-500">
            Series count: {{ series.length }}
          </span>
        </div>

        <p v-if="submitError" class="text-sm text-red-600">{{ submitError }}</p>
      </form>
    </section>

    <section>
      <h3 class="text-lg font-semibold mb-3 text-slate-900">Search results</h3>

      <div v-if="allOffers.length > 0" class="mb-4 overflow-x-auto">
        <!-- nagłówek Bar chart + toggle config -->
        <div class="flex items-center justify-between mb-2">
          <span class="block text-sm font-medium text-slate-800">{{ barChartTitle }}</span>
          <button
            type="button"
            class="inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-900"
            @click="isBarChartConfigVisible = !isBarChartConfigVisible"
          >
            <span class="underline">Bar chart configuration</span>
            <span>{{ isBarChartConfigVisible ? '▲' : '▼' }}</span>
          </button>
        </div>

        <!-- Bar chart configuration BEZ wyboru kolorów -->
        <div
          v-if="isBarChartConfigVisible"
          class="mb-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
        >
          <div class="flex flex-wrap gap-4 text-xs text-slate-700">
            <div class="flex flex-col gap-1 min-w-[180px]">
              <label for="offerBarChartTitle" class="font-medium">Chart title</label>
              <input
                id="offerBarChartTitle"
                v-model="barChartTitle"
                type="text"
                class="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="np. Liczba ofert"
              />
            </div>
            <div class="flex flex-col gap-1 min-w-[160px]">
              <label for="offerBarXAxisLabel" class="font-medium">X-axis label</label>
              <input
                id="offerBarXAxisLabel"
                v-model="barXAxisLabel"
                type="text"
                class="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="np. Karta"
              />
            </div>
            <div class="flex flex-col gap-1 min-w-[160px]">
              <label for="offerBarYAxisLabel" class="font-medium">Y-axis label</label>
              <input
                id="offerBarYAxisLabel"
                v-model="barYAxisLabel"
                type="text"
                class="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="np. Liczba ofert"
              />
            </div>
          </div>
        </div>

        <!-- wykres słupkowy -->
        <div class="w-full overflow-x-auto mb-2">
          <svg
            :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            class="w-full min-w-[320px] h-56 bg-slate-50 rounded-md border border-slate-200"
          >
            <!-- siatka pozioma -->
            <g stroke="#e5e7eb" stroke-width="1">
              <line
                v-for="(tick, idx) in barYTicks"
                :key="'bar-y-grid-' + idx"
                :x1="chartPaddingX"
                :x2="chartWidth - chartPaddingX"
                :y1="tick.y"
                :y2="tick.y"
                stroke-dasharray="2 2"
              />
            </g>

            <!-- osie -->
            <line
              :x1="chartPaddingX"
              :x2="chartWidth - chartPaddingX"
              :y1="chartHeight - chartPaddingY"
              :y2="chartHeight - chartPaddingY"
              stroke="#0f172a"
              stroke-width="1.5"
            />
            <line
              :x1="chartPaddingX"
              :x2="chartPaddingX"
              :y1="chartPaddingY"
              :y2="chartHeight - chartPaddingY"
              stroke="#0f172a"
              stroke-width="1.5"
            />

            <!-- kreski na osi Y -->
            <g stroke="#0f172a" stroke-width="1.2">
              <line
                v-for="(tick, idx) in barYTicks"
                :key="'bar-y-tick-' + idx"
                :x1="chartPaddingX - 4"
                :x2="chartPaddingX"
                :y1="tick.y"
                :y2="tick.y"
              />
            </g>

            <!-- podpis osi Y (używa barYAxisLabel) -->
            <text
              :x="chartPaddingX - 36"
              :y="chartPaddingY + (chartHeight - 2 * chartPaddingY) / 2"
              text-anchor="middle"
              font-size="10"
              :fill="barAxisLabelColor"
              :transform="`rotate(-90, ${chartPaddingX - 36}, ${chartPaddingY + (chartHeight - 2 * chartPaddingY) / 2})`"
            >
              {{ barYAxisLabel }}
            </text>

            <!-- podpis osi X (używa barXAxisLabel) -->
            <text
              :x="chartPaddingX + (chartWidth - 2 * chartPaddingX) / 2"
              :y="chartHeight - 4"
              text-anchor="middle"
              font-size="10"
              :fill="barAxisLabelColor"
            >
              {{ barXAxisLabel }}
            </text>

            <!-- etykiety osi Y -->
            <g v-for="(tick, idx) in barYTicks" :key="'bar-y-label-' + idx">
              <text
                :x="chartPaddingX - 6"
                :y="tick.y + 4"
                text-anchor="end"
                font-size="10"
                :fill="barAxisLabelColor"
              >
                {{ tick.label }}
              </text>
            </g>

            <!-- słupki -->
            <g v-if="barData.length > 0">
              <rect
                v-for="(b, idx) in barData"
                :key="'bar-' + b.label"
                :x="barScaleX(idx, barData.length) - ((chartWidth - 2 * chartPaddingX) / Math.max(barData.length, 1)) / 3"
                :width="(chartWidth - 2 * chartPaddingX) / Math.max(barData.length, 1) / 1.5"
                :y="barScaleY(b.count)"
                :height="chartHeight - chartPaddingY - barScaleY(b.count)"
                :fill="b.color"
              />

              <g v-for="(b, idx) in barData" :key="'bar-x-label-' + b.label">
                <text
                  :x="barScaleX(idx, barData.length)"
                  :y="chartHeight - chartPaddingY + 12"
                  text-anchor="middle"
                  font-size="9"
                  :fill="barAxisLabelColor"
                >
                  {{ b.label }}
                </text>
              </g>
            </g>
          </svg>
        </div>

        <!-- legenda wykresu słupkowego -->
        <div class="flex flex-wrap gap-3 text-xs text-slate-700 mb-4">
          <div
            v-for="b in barData"
            :key="'legend-bar-' + b.label"
            class="inline-flex items-center gap-1"
          >
            <span class="inline-block w-3 h-3 rounded-sm" :style="{ backgroundColor: b.color }" />
            <span>{{ b.label }} ({{ b.count }})</span>
          </div>
        </div>

        <!-- wykres liniowy + info -->
        <div class="mb-2 flex items-center justify-between">
          <span class="block text-sm font-medium text-slate-800">{{ chartTitle }}</span>
          <button
            type="button"
            class="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900"
            @click="isChartConfigVisible = !isChartConfigVisible"
          >
            <span class="underline">Chart configuration</span>
            <span>{{ isChartConfigVisible ? '▲' : '▼' }}</span>
          </button>
        </div>

        <!-- KONFIGURATOR WYKRESU LINIOWEGO Z PER-SERYJNYMI KOLORAMI -->
        <div
          v-if="isChartConfigVisible"
          class="mb-3 space-y-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
        >
          <!-- globalne ustawienia opisu osi/tytułów -->
          <div class="flex flex-wrap gap-4 text-xs text-slate-700">
            <div class="flex flex-col gap-1 min-w-[180px]">
              <label for="offerChartTitle" class="font-medium">Chart title</label>
              <input
                id="offerChartTitle"
                v-model="chartTitle"
                type="text"
                class="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="np. Historia ofert"
              />
            </div>
            <div class="flex flex-col gap-1 min-w-[160px]">
              <label for="offerXAxisLabel" class="font-medium">X-axis label</label>
              <input
                id="offerXAxisLabel"
                v-model="xAxisLabel"
                type="text"
                class="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="np. Czas wystawienia"
              />
            </div>
            <div class="flex flex-col gap-1 min-w-[160px]">
              <label for="offerYAxisLabel" class="font-medium">Y-axis label</label>
              <input
                id="offerYAxisLabel"
                v-model="yAxisLabel"
                type="text"
                class="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="np. Cena"
              />
            </div>
            <div class="flex items-center gap-2 mt-2">
              <label for="offerAxisLabelColor" class="font-medium">Axis label color:</label>
              <input
                id="offerAxisLabelColor"
                v-model="axisLabelColor"
                type="color"
                class="w-8 h-6 border border-slate-300 rounded cursor-pointer bg-white"
              />
            </div>
          </div>

          <!-- per-seryjna konfiguracja kolorów -->
          <div class="border-t border-slate-200 pt-2 mt-1">
            <p class="text-xs font-semibold text-slate-700 mb-1">Series colors</p>
            <div
              v-if="series.length > 0"
              class="flex flex-col gap-2"
            >
              <div
                v-for="s in series"
                :key="'series-color-' + s.id"
                class="flex flex-wrap items-center gap-3 text-xs text-slate-700"
              >
                <span class="min-w-[80px] font-medium truncate">{{ s.card.cardName }}</span>

                <label class="flex items-center gap-1">
                  <span>Line:</span>
                  <input
                    type="color"
                    :value="s.lineColor"
                    class="w-8 h-5 border border-slate-300 rounded cursor-pointer bg-white"
                    @input="(e: Event) => {
                      const target = e.target as HTMLInputElement
                      s.lineColor = target.value
                    }"
                  />
                </label>

                <label class="flex items-center gap-1">
                  <span>Point:</span>
                  <input
                    type="color"
                    :value="s.pointColor"
                    class="w-8 h-5 border border-slate-300 rounded cursor-pointer bg-white"
                    @input="(e: Event) => {
                      const target = e.target as HTMLInputElement
                      s.pointColor = target.value
                    }"
                  />
                </label>
              </div>
            </div>
            <p v-else class="text-xs text-slate-500">No series added yet.</p>
          </div>
        </div>

        <div class="flex flex-col lg:flex-row gap-4 items-start">
          <div class="text-xs text-slate-700 min-w-[220px] space-y-1 w-full lg:w-auto">
            <p>
              <span class="font-semibold">Expansion name:</span>
              <span class="ml-1 break-all">{{ selectedExpansionName || '-' }}</span>
            </p>
            <p>
              <span class="font-semibold">Series:</span>
              <span class="ml-1 break-all">{{ series.map((s) => s.card.cardName).join(', ') || '-' }}</span>
            </p>
            <p class="flex flex-wrap gap-1">
              <span class="font-semibold">Data od:</span>
              <span>{{ displayDateRange.from ?? '-' }}</span>
            </p>
            <p class="flex flex-wrap gap-1">
              <span class="font-semibold">Data do:</span>
              <span>{{ displayDateRange.to ?? '-' }}</span>
            </p>

            <!-- legenda wykresu liniowego -->
            <div class="mt-2 flex flex-wrap gap-2">
              <div
                v-for="s in lineSeries"
                :key="'legend-line-' + s.id"
                class="inline-flex items-center gap-1"
              >
                <span
                  class="inline-block w-4 h-[2px] rounded-full"
                  :style="{ backgroundColor: s.lineColor }"
                />
                <span
                  class="inline-block w-2 h-2 rounded-full border"
                  :style="{ backgroundColor: s.pointColor, borderColor: '#ffffff' }"
                />
                <span>{{ s.label }}</span>
              </div>
            </div>
          </div>

          <div class="flex-1 min-w-0">
            <div class="w-full overflow-x-auto">
              <svg
                :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
                class="w-full min-w-[320px] h-56 bg-slate-50 rounded-md border border-slate-200"
              >
                <!-- siatka pozioma (Y) -->
                <g stroke="#e5e7eb" stroke-width="1">
                  <line
                    v-for="(tick, idx) in yTicks"
                    :key="'y-grid-' + idx"
                    :x1="chartPaddingX"
                    :x2="chartWidth - chartPaddingX"
                    :y1="tick.y"
                    :y2="tick.y"
                    stroke-dasharray="2 2"
                  />
                </g>

                <!-- siatka pionowa (X) -->
                <g stroke="#e5e7eb" stroke-width="1">
                  <line
                    v-for="(tick, idx) in xTicks"
                    :key="'x-grid-' + idx"
                    :x1="tick.x"
                    :x2="tick.x"
                    :y1="chartPaddingY"
                    :y2="chartHeight - chartPaddingY"
                    stroke-dasharray="2 2"
                  />
                </g>

                <!-- osie -->
                <line
                  :x1="chartPaddingX"
                  :x2="chartWidth - chartPaddingX"
                  :y1="chartHeight - chartPaddingY"
                  :y2="chartHeight - chartPaddingY"
                  stroke="#0f172a"
                  stroke-width="1.5"
                />
                <line
                  :x1="chartPaddingX"
                  :x2="chartPaddingX"
                  :y1="chartPaddingY"
                  :y2="chartHeight - chartPaddingY"
                  stroke="#0f172a"
                  stroke-width="1.5"
                />

                <!-- kreski na osi Y -->
                <g stroke="#0f172a" stroke-width="1.2">
                  <line
                    v-for="(tick, idx) in yTicks"
                    :key="'y-tick-' + idx"
                    :x1="chartPaddingX - 4"
                    :x2="chartPaddingX"
                    :y1="tick.y"
                    :y2="tick.y"
                  />
                </g>

                <!-- kreski na osi X -->
                <g stroke="#0f172a" stroke-width="1.2">
                  <line
                    v-for="(tick, idx) in xTicks"
                    :key="'x-tick-' + idx"
                    :x1="tick.x"
                    :x2="tick.x"
                    :y1="chartHeight - chartPaddingY"
                    :y2="chartHeight - chartPaddingY + 4"
                  />
                </g>

                <!-- opis osi Y -->
                <text
                  :x="chartPaddingX - 36"
                  :y="chartPaddingY + (chartHeight - 2 * chartPaddingY) / 2"
                  text-anchor="middle"
                  font-size="10"
                  :fill="axisLabelColor"
                  :transform="`rotate(-90, ${chartPaddingX - 36}, ${chartPaddingY + (chartHeight - 2 * chartPaddingY) / 2})`"
                >
                  {{ yAxisLabel }} ({{ allOffers[0]?.currency ?? '' }})
                </text>

                <!-- opis osi X -->
                <text
                  :x="chartPaddingX + (chartWidth - 2 * chartPaddingX) / 2"
                  :y="chartHeight - 4"
                  text-anchor="middle"
                  font-size="10"
                  :fill="axisLabelColor"
                >
                  {{ xAxisLabel }}
                </text>

                <!-- etykiety osi Y -->
                <g v-for="(tick, idx) in yTicks" :key="'y-label-' + idx">
                  <text
                    :x="chartPaddingX - 6"
                    :y="tick.y + 4"
                    text-anchor="end"
                    font-size="10"
                    :fill="axisLabelColor"
                  >
                    {{ tick.label }}
                  </text>
                </g>

                <!-- etykiety osi X -->
                <g v-for="(tick, idx) in xTicks" :key="'x-label-' + idx">
                  <text
                    :x="tick.x"
                    :y="chartHeight - chartPaddingY + 14"
                    text-anchor="middle"
                    font-size="10"
                    :fill="axisLabelColor"
                  >
                    {{ tick.label }}
                  </text>
                </g>

                <!-- ścieżki linii dla każdej serii -->
                <g v-for="s in lineSeries" :key="'path-' + s.id">
                  <path
                    v-if="s.path && s.path.length > 0"
                    :d="s.path"
                    :stroke="s.lineColor"
                    stroke-width="2"
                    fill="none"
                  />
                </g>

                <!-- punkty dla każdej serii -->
                <g v-for="s in lineSeries" :key="'pts-' + s.id">
                  <circle
                    v-for="pt in s.points"
                    :key="'pt-' + s.id + '-' + pt.id"
                    :cx="pt.x"
                    :cy="pt.y"
                    :r="selectedOfferId === pt.id ? 6 : 3"
                    :fill="selectedOfferId === pt.id ? '#ef4444' : s.pointColor"
                    :stroke="selectedOfferId === pt.id ? '#b91c1c' : 'white'"
                    :stroke-width="selectedOfferId === pt.id ? 2 : 1"
                  />
                </g>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- komunikaty gdy brak serii / ładowanie / błąd -->
      <p v-if="isLoadingOffers" class="text-sm text-slate-500 print:hidden">Loading offers...</p>
      <p v-else-if="offersError" class="text-sm text-red-600 print:hidden">{{ offersError }}</p>
      <p v-else-if="allOffers.length === 0" class="text-sm text-slate-500 print:hidden">
        No offers to display. Select expansion, card and run search, then optionally add more series.
      </p>

      <!-- osobne tabele dla każdej serii -->
      <div
        v-else
        class="space-y-6"
      >
        <div
          v-for="s in series"
          :key="'table-' + s.id"
          class="border border-slate-200 rounded-md overflow-hidden"
        >
          <div class="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
            <span class="text-sm font-semibold text-slate-800">
              Series: {{ s.card.cardName }} ({{ s.card.cardNumber }})
            </span>
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-500">
                Offers: {{ s.offers.length }}
              </span>
              <button
                v-if="series.length > 1"
                type="button"
                class="inline-flex items-center justify-center text-xs font-bold text-red-600 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                @click="removeSeries(s.id)"
                title="Remove this series from view"
              >
                x
              </button>
            </div>
          </div>

          <table class="w-full text-sm">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Listed at</th>
                <th class="px-3 py-2 text-right font-medium text-slate-700 border-b border-slate-200">Price</th>
                <th class="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Currency</th>
                <th
                  v-if="isAdmin && showAdminOfferActions"
                  class="px-3 py-2 text-right font-medium text-slate-700 border-b border-slate-200 w-40 print:hidden"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="offer in s.offers"
                :key="offer.id"
                class="odd:bg-white even:bg-slate-50 cursor-pointer hover:bg-blue-50"
                :class="{ 'bg-blue-100': selectedOfferId === offer.id }"
                @click="selectedOfferId = offer.id"
              >
                <td class="px-3 py-2 border-b border-slate-100 font-mono">{{ formatOfferDate(offer.listedAt) }}</td>
                <td class="px-3 py-2 border-b border-slate-100 text-right">
                  <template v-if="isAdmin && showAdminOfferActions && editingOfferId === offer.id">
                    <input
                      v-model="editOfferAmount"
                      type="text"
                      class="w-24 rounded border border-slate-300 px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      @keyup.enter="handleSaveOffer(offer)"
                    />
                  </template>
                  <template v-else>
                    <span class="font-mono inline-block min-w-[4rem] text-right">{{ offer.amount.toFixed(2) }}</span>
                  </template>
                </td>
                <td class="px-3 py-2 border-b border-slate-100">
                  {{ offer.currency }}
                </td>
                <td
                  v-if="isAdmin && showAdminOfferActions"
                  class="px-3 py-2 border-b border-slate-100 text-right space-x-2 print:hidden"
                  @click.stop
                >
                  <template v-if="editingOfferId === offer.id">
                    <button
                      type="button"
                      class="inline-flex items-center rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                      :disabled="isSavingEditOffer"
                      @click="handleSaveOffer(offer)"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      class="inline-flex items-center rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      :disabled="isSavingEditOffer"
                      @click="cancelEditOffer"
                    >
                      Cancel
                    </button>
                  </template>
                  <template v-else>
                    <button
                      type="button"
                      class="inline-flex items-center rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      @click="startEditOffer(offer)"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      class="inline-flex items-center rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      :disabled="deletingOfferId === offer.id"
                      @click="handleDeleteOffer(offer)"
                    >
                      Delete
                    </button>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p v-if="editOfferError" class="text-xs text-red-600 mt-2 print:hidden">{{ editOfferError }}</p>
    </section>

    <section
      v-if="isAdmin && showAdminOfferActions && selectedExpansionName && selectedCardName && hasSearched && !isLoadingOffers && !offersError"
      class="border-t border-slate-200 pt-3 mt-2 print:hidden"
    >

      <button
        type="button"
        class="inline-flex items-center rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
        @click="isAddOfferVisible = !isAddOfferVisible"
      >
        {{ isAddOfferVisible ? 'Hide form' : 'Add offer' }}
      </button>

      <div
        v-if="isAddOfferVisible"
        class="mt-3 flex flex-col gap-2 max-w-md"
      >
        <div class="flex flex-col gap-1">
          <label for="newOfferAmount" class="text-xs font-medium text-slate-700">Price</label>
          <input
            id="newOfferAmount"
            v-model="newOfferAmount"
            type="text"
            class="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label for="newOfferCurrency" class="text-xs font-medium text-slate-700">Currency</label>
          <input
            id="newOfferCurrency"
            v-model="newOfferCurrency"
            type="text"
            class="w-full rounded border border-slate-300 px-2 py-1 text-sm bg-slate-100 text-slate-500 cursor-not-allowed"
            readonly
            disabled
          />
        </div>

        <p v-if="addOfferError" class="text-xs text-red-600">{{ addOfferError }}</p>

        <div class="flex gap-2 mt-1">
          <button
            type="button"
            class="inline-flex items-center rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            :disabled="isSavingOffer"
            @click="handleAddOffer"
          >
            {{ isSavingOffer ? 'Saving...' : 'Save' }}
          </button>
          <button
            type="button"
            class="inline-flex items-center rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            :disabled="isSavingOffer"
            @click="() => { isAddOfferVisible = false; resetAddOfferForm() }"
          >
            Cancel
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
