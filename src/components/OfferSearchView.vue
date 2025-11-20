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
const offers = ref<OfferPointResponse[]>([])

// flaga: czy użytkownik wykonał już wyszukiwanie
const hasSearched = ref(false)

// nowe pola dat
const fromDate = ref<string | null>(null)
const toDate = ref<string | null>(null)

// konfiguracja kolorów wykresu (edytowalna przez użytkownika)
const lineColor = ref<string>('#2563eb')
const pointColor = ref<string>('#1d4ed8')
const axisLabelColor = ref<string>('#475569')

// konfigurowalne podpisy tytułu i osi
const chartTitle = ref<string>('Historia ofert dla wybranej karty')
const xAxisLabel = ref<string>('Czas wystawienia oferty')
const yAxisLabel = ref<string>('Cena')

// widoczność sekcji konfiguracji wykresu
const isChartConfigVisible = ref(false)

const canSubmit = computed(() => !!selectedExpansionName.value && !!selectedCardName.value)

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

async function handleSubmit() {
  submitError.value = null
  offersError.value = null

  if (!canSubmit.value || !selectedExpansionName.value || !selectedCardName.value) {
    submitError.value = 'Select expansion and card name'
    return
  }

  const card = cards.value.find((c) => c.cardName === selectedCardName.value)
  if (!card) {
    submitError.value = 'Nie znaleziono wybranej karty dla tej ekspansji'
    return
  }

  isLoadingOffers.value = true
  offers.value = []
  hasSearched.value = true

  // budujemy wartości from/to jako pełne ISO, jeśli użytkownik podał datę (bez godziny)
  const fromIso = fromDate.value ? new Date(fromDate.value + 'T00:00:00Z').toISOString() : undefined
  const toIso = toDate.value ? new Date(toDate.value + 'T23:59:59Z').toISOString() : undefined

  try {
    offers.value = await fetchOffersByCardName(card.expExternalId, card.cardName, fromIso, toIso)
  } catch {
    offersError.value = 'Failed to load offers for selected card'
  } finally {
    isLoadingOffers.value = false
  }
}

watch(selectedExpansionName, (newName) => {
  if (newName) {
    void loadCardsForExpansion(newName)
  } else {
    cards.value = []
    selectedCardName.value = null
  }
  // zmiana ekspansji resetuje wyniki i panel dodawania
  offers.value = []
  offersError.value = null
  hasSearched.value = false
  isAddOfferVisible.value = false
  resetAddOfferForm()
})

onMounted(() => {
  void loadExpansions()
})

// ADMIN: dodawanie nowej oferty
const isAddOfferVisible = ref(false)
const newOfferAmount = ref('')
const newOfferCurrency = ref('')
const addOfferError = ref<string | null>(null)
const isSavingOffer = ref(false)

function resetAddOfferForm() {
  newOfferAmount.value = ''
  newOfferCurrency.value = ''
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

  if (!newOfferCurrency.value.trim()) {
    addOfferError.value = 'Provide currency (3-letter code, e.g. PLN)'
    return
  }

  const currency = newOfferCurrency.value.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) {
    addOfferError.value = 'Currency must be a 3-letter ISO code (e.g. PLN, USD)'
    return
  }

  // aktualna data/godzina
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

    // odśwież oferty dla aktualnych filtrów
    await handleSubmit()
  } catch {
    addOfferError.value = 'Failed to add offer'
  } finally {
    isSavingOffer.value = false
  }
}

// ADMIN: usuwanie/edycja istniejących ofert (tylko cena)
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

// Zwiększamy wysokość wykresu, żeby zmieścić etykiety czasu + podpis osi X w viewBox
const chartWidth = 600
const chartHeight = 230
const chartPaddingX = 40
const chartPaddingY = 24

const offerPoints = computed(() =>
  offers.value
    .map((o) => ({
      time: new Date(o.listedAt).getTime(),
      amount: o.amount,
    }))
    .filter((p) => !Number.isNaN(p.time)),
)

const chartDomain = computed(() => {
  if (offerPoints.value.length === 0) return null

  const times = offerPoints.value.map((p) => p.time)
  const amounts = offerPoints.value.map((p) => p.amount)

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

const offerChartPath = computed(() => {
  if (!chartDomain.value || offerPoints.value.length === 0) return ''

  const pts = [...offerPoints.value].sort((a, b) => a.time - b.time)

  return pts
    .map((p, idx) => {
      const x = scaleX(p.time)
      const y = scaleY(p.amount)
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
})

const offerChartDots = computed(() => {
  if (!chartDomain.value || offerPoints.value.length === 0) return []

  const pts = [...offerPoints.value].sort((a, b) => a.time - b.time)
  return pts.map((p) => ({ x: scaleX(p.time), y: scaleY(p.amount) }))
})

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

// Zakres dat używany do wyświetlania obok wykresu:
// - jeśli użytkownik podał from/to, używamy ich,
// - jeśli zostawił puste, bierzemy min/max z listedAt z danych ofert.
const displayDateRange = computed(() => {
  if (offers.value.length === 0) {
    return { from: null as string | null, to: null as string | null }
  }

  const parseDateOnly = (value: string | null) => (value && value.trim().length > 0 ? value : null)

  const fromUi = parseDateOnly(fromDate.value)
  const toUi = parseDateOnly(toDate.value)

  if (fromUi || toUi) {
    return { from: fromUi, to: toUi }
  }

  // Brak dat od/do z formularza -> policz z danych
  const times = offers.value
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
</script>

<template>
  <div class="w-full max-w-5xl bg-white rounded-xl shadow-md p-6 flex flex-col gap-6">
    <!-- Sekcja sterująca ma być ukryta podczas drukowania -->
    <section class="print:hidden">
      <h2 class="text-xl font-semibold mb-4 text-slate-900">Offer - Search</h2>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="flex flex-col gap-2 max-w-md">
          <label for="offerExpansionName" class="text-sm font-medium text-slate-700">Expansion name</label>
          <select
            id="offerExpansionName"
            v-model="selectedExpansionName"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option :value="null">-- wybierz ekspansję --</option>
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

        <div class="flex flex-col gap-2 max-w-md">
          <label for="offerCardName" class="text-sm font-medium text-slate-700">Card name</label>
          <select
            id="offerCardName"
            v-model="selectedCardName"
            :disabled="!selectedExpansionName || isLoadingCards || cards.length === 0"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
          >
            <option :value="null">-- wybierz kartę --</option>
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

        <div class="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
          <div class="flex flex-col gap-2 max-w-xs">
            <label for="offerFromDate" class="text-sm font-medium text-slate-700">Date from (optional)</label>
            <input
              id="offerFromDate"
              v-model="fromDate"
              type="date"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div class="flex flex-col gap-2 max-w-xs">
            <label for="offerToDate" class="text-sm font-medium text-slate-700">Date to (optional)</label>
            <input
              id="offerToDate"
              v-model="toDate"
              type="date"
              class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <!-- Przycisk do pokazywania/ukrywania konfiguracji wykresu -->
        <div class="mt-2">
          <button
            type="button"
            class="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900"
            @click="isChartConfigVisible = !isChartConfigVisible"
          >
            <span class="underline">Chart configuration</span>
            <span>{{ isChartConfigVisible ? '▲' : '▼' }}</span>
          </button>
        </div>

        <!-- Sekcja konfiguracji wykresu (kolory + podpisy osi) -->
        <div
          v-if="isChartConfigVisible"
          class="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
        >
          <!-- Konfiguracja kolorów wykresu -->
          <div class="flex flex-wrap gap-4 text-xs text-slate-700">
            <div class="flex items-center gap-2">
              <label for="offerLineColor" class="font-medium">Line color:</label>
              <input
                id="offerLineColor"
                v-model="lineColor"
                type="color"
                class="w-8 h-6 border border-slate-300 rounded cursor-pointer bg-white"
              />
            </div>
            <div class="flex items-center gap-2">
              <label for="offerPointColor" class="font-medium">Point color:</label>
              <input
                id="offerPointColor"
                v-model="pointColor"
                type="color"
                class="w-8 h-6 border border-slate-300 rounded cursor-pointer bg-white"
              />
            </div>
            <div class="flex items-center gap-2">
              <label for="offerAxisLabelColor" class="font-medium">Axis label color:</label>
              <input
                id="offerAxisLabelColor"
                v-model="axisLabelColor"
                type="color"
                class="w-8 h-6 border border-slate-300 rounded cursor-pointer bg-white"
              />
            </div>
          </div>

          <!-- Konfiguracja podpisów osi -->
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
          </div>
        </div>

        <p v-if="submitError" class="text-sm text-red-600">{{ submitError }}</p>

        <button
          type="submit"
          :disabled="!canSubmit || isLoadingOffers"
          class="inline-flex justify-center items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ isLoadingOffers ? 'Searching...' : 'Search offers' }}
        </button>
      </form>
    </section>

    <section>
      <h3 class="text-lg font-semibold mb-3 text-slate-900">Search results</h3>

      <!-- Wykres liniowy czas vs cena -->
      <div v-if="offers.length > 0" class="mb-4 overflow-x-auto">
        <!-- Nagłówek wykresu -->
        <div class="mb-2">
          <span class="block text-sm font-medium text-slate-800">{{ chartTitle }}</span>
        </div>

        <div class="flex gap-4 items-start">
          <!-- Panel z podsumowaniem zapytania po lewej -->
          <div class="text-xs text-slate-700 min-w-[180px] space-y-1">
            <p>
              <span class="font-semibold">Expansion name:</span>
              <span class="ml-1">{{ selectedExpansionName || '-' }}</span>
            </p>
            <p>
              <span class="font-semibold">Card name:</span>
              <span class="ml-1">{{ selectedCardName || '-' }}</span>
            </p>
            <p>
              <span class="font-semibold">Data od:</span>
              <span class="ml-1">{{ displayDateRange.from ?? '-' }}</span>
            </p>
            <p>
              <span class="font-semibold">Data do:</span>
              <span class="ml-1">{{ displayDateRange.to ?? '-' }}</span>
            </p>
          </div>

          <!-- Sam wykres -->
          <div class="flex-1">
            <svg
              :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
              class="w-full max-w-full h-56 bg-slate-50 rounded-md border border-slate-200"
            >
              <!-- siatka pozioma (cena) -->
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

              <!-- siatka pionowa (czas) -->
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

              <!-- znaczniki (ticki) na osi Y przy każdej etykiecie ceny -->
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

              <!-- podpis osi Y - korzysta z konfigurowalnego tekstu i koloru -->
              <text
                :x="chartPaddingX - 36"
                :y="chartPaddingY + (chartHeight - 2 * chartPaddingY) / 2"
                text-anchor="middle"
                font-size="10"
                :fill="axisLabelColor"
                :transform="`rotate(-90, ${chartPaddingX - 36}, ${chartPaddingY + (chartHeight - 2 * chartPaddingY) / 2})`"
              >
                {{ yAxisLabel }} ({{ offers[0]?.currency ?? '' }})
              </text>

              <!-- podpis osi X - korzysta z konfigurowalnego tekstu i koloru -->
              <text
                :x="chartPaddingX + (chartWidth - 2 * chartPaddingX) / 2"
                :y="chartHeight - 4"
                text-anchor="middle"
                font-size="10"
                :fill="axisLabelColor"
              >
                {{ xAxisLabel }}
              </text>

              <!-- etykiety osi Y (cena) - korzystają z koloru etykiet osi -->
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

              <!-- etykiety osi X (czas) - korzystają z koloru etykiet osi -->
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

              <!-- linia wykresu - kolor ustawiany przez użytkownika -->
              <path
                v-if="offerChartPath"
                :d="offerChartPath"
                :stroke="lineColor"
                stroke-width="2"
                fill="none"
              />

              <!-- punkty na linii - kolor ustawiany przez użytkownika -->
              <circle
                v-for="(pt, idx) in offerChartDots"
                :key="idx"
                :cx="pt.x"
                :cy="pt.y"
                r="3"
                :fill="pointColor"
                stroke="white"
                stroke-width="1"
              />
            </svg>
          </div>
        </div>
      </div>

      <!-- Komunikaty o ładowaniu/błędach: ukrywamy przy wydruku, żeby nie zaśmiecały wydruku -->
      <p v-if="isLoadingOffers" class="text-sm text-slate-500 print:hidden">Loading offers...</p>
      <p v-else-if="offersError" class="text-sm text-red-600 print:hidden">{{ offersError }}</p>
      <p v-else-if="offers.length === 0" class="text-sm text-slate-500 print:hidden">
        No offers to display. Select expansion, card and run search.
      </p>

      <!-- Tabela z danymi ofert: powinna być widoczna również w wydruku -->
      <table
        v-else
        class="w-full border border-slate-200 text-sm mt-2"
      >
        <thead class="bg-slate-50">
          <tr>
            <th class="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Listed at</th>
            <th class="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Amount</th>
            <th class="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Currency</th>
            <th
              v-if="isAdmin"
              class="px-3 py-2 text-right font-medium text-slate-700 border-b border-slate-200 w-40 print:hidden"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="offer in offers"
            :key="offer.id"
            class="odd:bg-white even:bg-slate-50"
          >
            <td class="px-3 py-2 border-b border-slate-100 font-mono">{{ formatOfferDate(offer.listedAt) }}</td>
            <td class="px-3 py-2 border-b border-slate-100 font-mono">
              <template v-if="isAdmin && editingOfferId === offer.id">
                <input
                  v-model="editOfferAmount"
                  type="text"
                  class="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </template>
              <template v-else>
                {{ offer.amount }}
              </template>
            </td>
            <td class="px-3 py-2 border-b border-slate-100">
              {{ offer.currency }}
            </td>
            <td
              v-if="isAdmin"
              class="px-3 py-2 border-b border-slate-100 text-right space-x-2 print:hidden"
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

      <p v-if="editOfferError" class="text-xs text-red-600 mt-2 print:hidden">{{ editOfferError }}</p>
    </section>

    <!-- Panel dodawania oferty - tylko dla admina, po wybraniu ekspansji i karty i po wyszukaniu -->
    <section
      v-if="isAdmin && selectedExpansionName && selectedCardName && hasSearched && !isLoadingOffers && !offersError"
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
          <label for="newOfferAmount" class="text-xs font-medium text-slate-700">Amount</label>
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
            class="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="np. PLN"
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
