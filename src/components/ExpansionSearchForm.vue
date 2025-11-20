<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ExpansionResponse } from '@/api/expansion'
import { fetchAllExpansions } from '@/api/expansion'

const expansions = ref<ExpansionResponse[]>([])
const isLoading = ref(false)
const loadError = ref<string | null>(null)

const selectedExpansionName = ref<string | null>(null)
const submitError = ref<string | null>(null)

const canSubmit = computed(() => !!selectedExpansionName.value)

async function loadExpansions() {
  isLoading.value = true
  loadError.value = null
  try {
    expansions.value = await fetchAllExpansions()
  } catch {
    loadError.value = 'Failed to load expansions list'
  } finally {
    isLoading.value = false
  }
}

async function handleSubmit() {
  submitError.value = null

  if (!selectedExpansionName.value) {
    submitError.value = 'Please select expansion name'
    return
  }

  console.log('Search cards for expansion', {
    name: selectedExpansionName.value,
  })
}

onMounted(() => {
  void loadExpansions()
})
</script>

<template>
  <div class="w-full max-w-xl bg-white rounded-xl shadow-md p-6">
    <h2 class="text-xl font-semibold mb-4 text-slate-900">Expansion - Search</h2>

    <form @submit.prevent="handleSubmit" class="space-y-4">
      <div class="flex flex-col gap-2">
        <label for="expansionName" class="text-sm font-medium text-slate-700">Expansion name</label>
        <select
          id="expansionName"
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
        <p v-if="isLoading" class="text-xs text-slate-500">Loading expansions...</p>
        <p v-if="loadError" class="text-xs text-red-600">{{ loadError }}</p>
      </div>

      <p v-if="submitError" class="text-sm text-red-600">{{ submitError }}</p>

      <button
        type="submit"
        :disabled="isLoading"
        class="inline-flex justify-center items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Search
      </button>
    </form>
  </div>
</template>
