<script lang="ts">
import { defineComponent, onMounted, ref, watch } from 'vue'
import type { ExpansionResponse } from '@/api/expansion'
import { deleteExpansionByName, fetchAllExpansions, patchExpansion, upsertExpansion } from '@/api/expansion'

export default defineComponent({
  name: 'ExpansionListView',
  props: {
    isAdmin: {
      type: Boolean,
      default: false,
    },
  },
  setup(props) {
    const expansions = ref<ExpansionResponse[]>([])
    const isLoading = ref(false)
    const loadError = ref<string | null>(null)

    const isAddFormVisible = ref(false)
    const newExternalId = ref('')
    const newName = ref('')
    const addError = ref<string | null>(null)
    const isSavingNew = ref(false)

    const editingExternalId = ref<string | null>(null)
    const editName = ref('')
    const editError = ref<string | null>(null)
    const isSavingEdit = ref(false)

    const isDeletingId = ref<string | null>(null)

    async function loadExpansions() {
      isLoading.value = true
      loadError.value = null
      try {
        expansions.value = await fetchAllExpansions()
      } catch (e) {
        loadError.value = 'Failed to load expansions list'
      } finally {
        isLoading.value = false
      }
    }

    onMounted(() => {
      void loadExpansions()
    })

    function resetAddForm() {
      newExternalId.value = ''
      newName.value = ''
      addError.value = null
    }

    async function handleAddExpansion() {
      addError.value = null

      if (!newExternalId.value.trim() || !newName.value.trim()) {
        addError.value = 'Fill in External ID and Name'
        return
      }

      isSavingNew.value = true
      try {
        await upsertExpansion({ externalId: newExternalId.value.trim(), name: newName.value.trim() })
        resetAddForm()
        isAddFormVisible.value = false
        await loadExpansions()
      } catch (e) {
        addError.value = 'Failed to save expansion'
      } finally {
        isSavingNew.value = false
      }
    }

    function startEdit(exp: ExpansionResponse) {
      editingExternalId.value = exp.externalId
      editName.value = exp.name
      editError.value = null
    }

    function cancelEdit() {
      editingExternalId.value = null
      editName.value = ''
      editError.value = null
    }

    async function handleSaveEdit(externalId: string) {
      if (!editName.value.trim()) {
        editError.value = 'Name cannot be empty'
        return
      }

      isSavingEdit.value = true
      try {
        await patchExpansion(externalId, { name: editName.value.trim() })
        editingExternalId.value = null
        editName.value = ''
        editError.value = null
        await loadExpansions()
      } catch (e) {
        editError.value = 'Failed to update expansion'
      } finally {
        isSavingEdit.value = false
      }
    }

    async function handleDelete(name: string, externalId: string) {
      if (!window.confirm(`Are you sure you want to delete expansion ${name}?`)) return

      isDeletingId.value = externalId
      try {
        await deleteExpansionByName(name)
        await loadExpansions()
      } catch (e) {
        alert('Failed to delete expansion')
      } finally {
        isDeletingId.value = null
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

    return {
      // state
      expansions,
      isLoading,
      loadError,
      isAddFormVisible,
      newExternalId,
      newName,
      addError,
      isSavingNew,
      editingExternalId,
      editName,
      editError,
      isSavingEdit,
      isDeletingId,
      // methods
      handleAddExpansion,
      startEdit,
      cancelEdit,
      handleSaveEdit,
      handleDelete,
      resetAddForm,
    }
  },
})
</script>

<template>
  <div class="w-full max-w-3xl bg-white rounded-xl shadow-md p-6">
    <h2 class="text-xl font-semibold mb-4 text-slate-900">List of expansions</h2>

    <p v-if="isLoading" class="text-sm text-slate-500">Loading expansions...</p>
    <p v-else-if="loadError" class="text-sm text-red-600">{{ loadError }}</p>

    <template v-else>
      <table class="w-full border border-slate-200 text-sm mb-4">
        <thead class="bg-slate-50">
          <tr>
            <th class="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">External ID</th>
            <th class="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200">Name</th>
            <th
              v-if="isAdmin"
              class="px-3 py-2 text-right font-medium text-slate-700 border-b border-slate-200 w-40"
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="exp in expansions"
            :key="exp.externalId"
            class="odd:bg-white even:bg-slate-50"
          >
            <td class="px-3 py-2 border-b border-slate-100 font-mono">{{ exp.externalId }}</td>
            <td class="px-3 py-2 border-b border-slate-100">
              <template v-if="isAdmin && editingExternalId === exp.externalId">
                <input
                  v-model="editName"
                  type="text"
                  class="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  @keyup.enter="handleSaveEdit(exp.externalId)"
                />
              </template>
              <template v-else>
                {{ exp.name }}
              </template>
            </td>

            <td
              v-if="isAdmin"
              class="px-3 py-2 border-b border-slate-100 text-right space-x-2"
            >
              <template v-if="editingExternalId === exp.externalId">
                <button
                  type="button"
                  class="inline-flex items-center rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  :disabled="isSavingEdit"
                  @click="handleSaveEdit(exp.externalId)"
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
                  @click="startEdit(exp)"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="inline-flex items-center rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  :disabled="isDeletingId === exp.externalId"
                  @click="handleDelete(exp.name, exp.externalId)"
                >
                  Delete
                </button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>

      <p v-if="editError" class="text-xs text-red-600 mb-2">{{ editError }}</p>

      <div v-if="isAdmin" class="border-t border-slate-200 pt-3 mt-2">
        <button
          type="button"
          class="inline-flex items-center rounded border border-slate-300 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
          @click="isAddFormVisible = !isAddFormVisible"
        >
          {{ isAddFormVisible ? 'Ukryj formularz' : 'Add expansion' }}
        </button>

        <div
          v-if="isAddFormVisible"
          class="mt-3 flex flex-col gap-2 max-w-md"
        >
          <div class="flex flex-col gap-1">
            <label for="newExternalId" class="text-xs font-medium text-slate-700">External ID</label>
            <input
              id="newExternalId"
              v-model="newExternalId"
              type="text"
              class="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div class="flex flex-col gap-1">
            <label for="newName" class="text-xs font-medium text-slate-700">Name</label>
            <input
              id="newName"
              v-model="newName"
              type="text"
              class="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              @keyup.enter="handleAddExpansion"
            />
          </div>

          <p v-if="addError" class="text-xs text-red-600">{{ addError }}</p>

          <div class="flex gap-2 mt-1">
            <button
              type="button"
              class="inline-flex items-center rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              :disabled="isSavingNew"
              @click="handleAddExpansion"
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
    </template>
  </div>
</template>
