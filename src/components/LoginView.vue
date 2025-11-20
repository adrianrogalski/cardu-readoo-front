<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const username = ref('')
const password = ref('')
const errorMessage = ref('')
const isSubmitting = ref(false)

const router = useRouter()
const auth = useAuthStore()

async function onSubmit() {
  errorMessage.value = ''
  isSubmitting.value = true
  try {
    await auth.login(username.value, password.value)
    await router.push({ name: 'home' })
  } catch (err) {
    errorMessage.value = 'Nieprawidłowy login lub hasło'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-slate-900">
    <div class="w-full max-w-sm bg-white rounded-xl shadow-lg p-8">
      <h1 class="text-2xl font-semibold mb-6 text-center text-slate-900">Log in</h1>

      <form @submit.prevent="onSubmit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1" for="username">
            Login
          </label>
          <input
            id="username"
            v-model="username"
            type="text"
            autocomplete="username"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1" for="password">
            Password
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <p v-if="errorMessage" class="text-sm text-red-600">
          {{ errorMessage }}
        </p>

        <button
          type="submit"
          :disabled="isSubmitting"
          class="w-full inline-flex justify-center items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ isSubmitting ? 'Logging in...' : 'Log in' }}
        </button>
      </form>
    </div>
  </div>
</template>
