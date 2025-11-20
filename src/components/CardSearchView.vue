<script lang="ts">
import { defineComponent, computed, onMounted, ref, watch } from 'vue'
import type { ExpansionResponse } from '@/api/expansion'
import { fetchAllExpansions } from '@/api/expansion'
import type { CardResponse } from '@/api/card'
import { deleteCardByNumber, fetchCardsByExpansionName, patchCard, upsertCard } from '@/api/card'

export default defineComponent({
  name: 'CardSearchView',
  props: {
    isAdmin: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const expansions = ref<ExpansionResponse[]>([])
    const isLoadingExpansions = ref(false)
    const loadExpansionsError = ref<string | null>(null)

    const selectedExpansionName = ref<string | null>(null)
    const submitError = ref<string | null>(null)

    const isSearchingCards = ref(false)
    const searchError = ref<string | null>(null)
    const cards = ref<CardResponse[]>([])

    const hasSearched = ref(false)

    const canSubmit = computed(() => !!selectedExpansionName.value)

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

    async function refreshCards() {
      if (!selectedExpansionName.value) return
      isSearchingCards.value = true
      searchError.value = null
      try {
        cards.value = await fetchCardsByExpansionName(selectedExpansionName.value)
        hasSearched.value = true
      } catch {
        searchError.value = 'Failed to load cards for selected expansion'
      } finally {
        isSearchingCards.value = false
      }
    }

    async function handleSubmit() {
      submitError.value = null
      searchError.value = null

      if (!canSubmit.value || !selectedExpansionName.value) {
        submitError.value = 'Please select expansion name'
        return
      }

      cards.value = []
      await refreshCards()
    }

    onMounted(() => {
      void loadExpansions()
    })

    // ADMIN: stan dodawania nowej karty
    const isAddFormVisible = ref(false)
    const newCardNumber = ref('')
    const newCardName = ref('')
    const newCardRarity = ref('')
    const addError = ref<string | null>(null)
    const isSavingNew = ref(false)

    function resetAddForm() {
      newCardNumber.value = ''
      newCardName.value = ''
      newCardRarity.value = ''
      addError.value = null
    }

    async function handleAddCard() {
      addError.value = null

      if (!selectedExpansionName.value) {
        addError.value = 'Please select expansion first'
        return
      }
      if (!newCardNumber.value.trim() || !newCardName.value.trim() || !newCardRarity.value.trim()) {
        addError.value = 'Fill in all new card fields'
        return
      }

      const exp = expansions.value.find((e) => e.name === selectedExpansionName.value)
      if (!exp) {
        addError.value = 'Could not find expansion identifier'
        return
      }

      isSavingNew.value = true
      try {
        await upsertCard({
          expExternalId: exp.externalId,
          cardNumber: newCardNumber.value.trim(),
          cardName: newCardName.value.trim(),
          cardRarity: newCardRarity.value.trim(),
        })
        resetAddForm()
        isAddFormVisible.value = false
        await refreshCards()
      } catch {
        addError.value = 'Failed to save card'
      } finally {
        isSavingNew.value = false
      }
    }

    // ADMIN: stan edycji istniejącej karty (name + rarity)
    const editingKey = ref<string | null>(null) // klucz: expExternalId-cardNumber
    const editName = ref('')
    const editRarity = ref('')
    const editError = ref<string | null>(null)
    const isSavingEdit = ref(false)

    function startEdit(card: CardResponse) {
      editingKey.value = `${card.expExternalId}-${card.cardNumber}`
      editName.value = card.cardName
      editRarity.value = card.cardRarity
      editError.value = null
    }

    function cancelEdit() {
      editingKey.value = null
      editName.value = ''
      editRarity.value = ''
      editError.value = null
    }

    async function handleSaveEdit(card: CardResponse) {
      if (!editName.value.trim() && !editRarity.value.trim()) {
        editError.value = 'Provide new name or rarity'
        return
      }

      isSavingEdit.value = true
      try {
        await patchCard(card.expExternalId, card.cardNumber, {
          name: editName.value.trim() || null,
          rarity: editRarity.value.trim() || null,
        })
        cancelEdit()
        await refreshCards()
      } catch {
        editError.value = 'Failed to update card'
      } finally {
        isSavingEdit.value = false
      }
    }

    // ADMIN: usuwanie karty po numerze + expExternalId
    const deletingKey = ref<string | null>(null)

    async function handleDelete(card: CardResponse) {
      if (!window.confirm(`Are you sure you want to delete card ${card.cardNumber} (${card.cardName})?`)) return

      deletingKey.value = `${card.expExternalId}-${card.cardNumber}`
      try {
        await deleteCardByNumber(card.expExternalId, card.cardNumber)
        await refreshCards()
      } catch {
        alert('Failed to delete card')
      } finally {
        deletingKey.value = null
      }
    }

    watch(
      () => props.isAdmin,
      () => {
        if (!props.isAdmin) {
          isAddFormVisible.value = false
          resetAddForm()
          cancelEdit()
        }
      },
    )

    watch(selectedExpansionName, () => {
      // zmiana ekspansji przed ponownym wyszukiwaniem: ukryj panel dodawania
      isAddFormVisible.value = false
      resetAddForm()
      cards.value = []
      searchError.value = null
      hasSearched.value = false
    })

    return {
      // wyszukiwanie
      expansions,
      isLoadingExpansions,
      loadExpansionsError,
      selectedExpansionName,
      submitError,
      isSearchingCards,
      searchError,
      cards,
      canSubmit,
      handleSubmit,
      hasSearched,

      // admin: dodawanie
      isAddFormVisible,
      newCardNumber,
      newCardName,
      newCardRarity,
      addError,
      isSavingNew,
      handleAddCard,
      resetAddForm,

      // admin: edycja
      editingKey,
      editName,
      editRarity,
      editError,
      isSavingEdit,
      startEdit,
      cancelEdit,
      handleSaveEdit,

      // admin: usuwanie
      deletingKey,
      handleDelete,

      // props
      isAdmin: props.isAdmin,
    }
  },
})
</script>

<template>
  <div class="w-full max-w-5xl bg-white rounded-xl shadow-md p-6 flex flex-col gap-6">
    <section>
      <h2 class="text-xl font-semibold mb-4 text-slate-900">Card - Search</h2>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div class="flex flex-col gap-2 max-w-md">
          <label for="cardExpansionName" class="text-sm font-medium text-slate-700">Expansion name</label>
          <select
            id="cardExpansionName"
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

        <p v-if="submitError" class="text-sm text-red-600">{{ submitError }}</p>

        <button
          type="submit"
          :disabled="!canSubmit || isSearchingCards"
          class="inline-flex justify-center items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ isSearchingCards ? 'Searching...' : 'Search cards' }}
        </button>
      </form>
    </section>

    <section>
      <h3 class="text-lg font-semibold mb-3 text-slate-900">Search results</h3>

      <p v-if="isSearchingCards" class="text-sm text-slate-500">Loading cards...</p>
      <p v-else-if="searchError" class="text-sm text-red-600">{{ searchError }}</p>
      <p v-else-if="!hasSearched" class="text-sm text-slate-500">
        Select expansion and run search to see cards.
      </p>
      <p v-else-if="cards.length === 0" class="text-sm text-slate-500">
        No cards to display for selected expansion.
      </p>

      <template v-else>
        <table class="w-full border border-slate-200 text-sm mt-2 mb-3">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Expansion External ID</th>
              <th class="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Card Number</th>
              <th class="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Card Name</th>
              <th class="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Rarity</th>
              <th
                v-if="isAdmin"
                class="px-3 py-2 text-right font-medium text-slate-700 border-b border-slate-200 w-48"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="card in cards"
              :key="`${card.expExternalId}-${card.cardNumber}`"
              class="odd:bg-white even:bg-slate-50"
            >
              <td class="px-3 py-2 border-b border-slate-100 font-mono">{{ card.expExternalId }}</td>
              <td class="px-3 py-2 border-b border-slate-100 font-mono">{{ card.cardNumber }}</td>
              <td class="px-3 py-2 border-b border-slate-100">
                <template v-if="isAdmin && editingKey === `${card.expExternalId}-${card.cardNumber}`">
                  <input
                    v-model="editName"
                    type="text"
                    class="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </template>
                <template v-else>
                  {{ card.cardName }}
                </template>
              </td>
              <td class="px-3 py-2 border-b border-slate-100">
                <template v-if="isAdmin && editingKey === `${card.expExternalId}-${card.cardNumber}`">
                  <input
                    v-model="editRarity"
                    type="text"
                    class="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </template>
                <template v-else>
                  {{ card.cardRarity }}
                </template>
              </td>
              <td
                v-if="isAdmin"
                class="px-3 py-2 border-b border-slate-100 text-right space-x-2"
              >
                <template v-if="editingKey === `${card.expExternalId}-${card.cardNumber}`">
                  <button
                    type="button"
                    class="inline-flex items-center rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    :disabled="isSavingEdit"
                    @click="handleSaveEdit(card)"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    :disabled="isSavingEdit"
                    @click="cancelEdit"
                  >
                    Cancel
                  </button>
                </template>
                <template v-else>
                  <button
                    type="button"
                    class="inline-flex items-center rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    @click="startEdit(card)"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="inline-flex items-center rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    :disabled="deletingKey === `${card.expExternalId}-${card.cardNumber}`"
                    @click="handleDelete(card)"
                  >
                    Delete
                  </button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>

        <p v-if="editError" class="text-red-600 text-sm mt-2">{{ editError }}</p>
      </template>
    </section>

    <!-- Panel dodawania nowej karty - tylko dla admina, po wyszukaniu konkretnej ekspansji -->
    <div
      v-if="isAdmin && selectedExpansionName && hasSearched && !isSearchingCards && !searchError"
      class="border-t border-slate-200 pt-3 mt-2"
    >
      <button
        type="button"
        class="inline-flex items-center rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
        @click="isAddFormVisible = !isAddFormVisible"
      >
        {{ isAddFormVisible ? 'Hide form' : 'Add card' }}
      </button>

      <div
        v-if="isAddFormVisible"
        class="mt-3 flex flex-col gap-2 max-w-md"
      >
        <div class="flex flex-col gap-1">
          <label for="newCardNumber" class="text-xs font-medium text-slate-700">Card Number</label>
          <input
            id="newCardNumber"
            v-model="newCardNumber"
            type="text"
            class="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label for="newCardName" class="text-xs font-medium text-slate-700">Card Name</label>
          <input
            id="newCardName"
            v-model="newCardName"
            type="text"
            class="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label for="newCardRarity" class="text-xs font-medium text-slate-700">Rarity</label>
          <input
            id="newCardRarity"
            v-model="newCardRarity"
            type="text"
            class="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <p v-if="addError" class="text-xs text-red-600">{{ addError }}</p>

        <div class="flex gap-2 mt-1">
          <button
            type="button"
            class="inline-flex items-center rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            :disabled="isSavingNew"
            @click="handleAddCard"
          >
            {{ isSavingNew ? 'Saving...' : 'Save' }}
          </button>
          <button
            type="button"
            class="inline-flex items-center rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            :disabled="isSavingNew"
            @click="() => { isAddFormVisible = false; resetAddForm() }"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
