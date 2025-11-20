<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import ExpansionListView from '@/components/ExpansionListView.vue'
import CardSearchView from '@/components/CardSearchView.vue'
import OfferSearchView from '@/components/OfferSearchView.vue'

const auth = useAuthStore()
const router = useRouter()

// aktywna sekcja ekranu, domyślnie pusty Home
const activeSection = ref<'Home' | 'ExpansionView' | 'CardSearch' | 'OfferSearch'>('Home')

const isAdmin = computed(() => auth.user?.roles.includes('ROLE_ADMIN'))

function openHome() {
  activeSection.value = 'Home'
}

function openExpansionView() {
  activeSection.value = 'ExpansionView'
}

function openCardSearch() {
  activeSection.value = 'CardSearch'
}

function openOfferSearch() {
  activeSection.value = 'OfferSearch'
}

async function handleLogout() {
  auth.logout()
  await router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen flex flex-col bg-slate-100">
    <!-- Górny pasek nawigacji -->
    <header class="w-full bg-slate-900 text-white shadow-md print:hidden">
      <div class="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-6">
          <button
            type="button"
            class="relative text-sm font-medium hover:text-blue-300"
            @click="openHome"
          >
            Home
          </button>

          <button
            type="button"
            class="relative text-sm font-medium hover:text-blue-300"
            @click="openExpansionView"
          >
            Expansion
          </button>

          <button
            type="button"
            class="relative text-sm font-medium hover:text-blue-300"
            @click="openCardSearch"
          >
            Card
          </button>

          <button
            type="button"
            class="relative text-sm font-medium hover:text-blue-300"
            @click="openOfferSearch"
          >
            Offer
          </button>
        </div>

        <div class="flex items-center gap-4 text-sm">
          <span class="text-slate-200">{{ auth.user?.username }}</span>
          <button
            type="button"
            class="rounded-lg border border-slate-500 px-3 py-1 text-xs font-medium hover:bg-slate-800"
            @click="handleLogout"
          >
            Log out
          </button>
        </div>
      </div>
    </header>

    <!-- Główna treść -->
    <main class="flex-1 flex items-center justify-center px-4">
      <p v-if="activeSection === 'Home'" class="text-slate-700 text-base">
        Welcome to the application. Select one of the options in the top menu to continue.
      </p>
      <ExpansionListView v-else-if="activeSection === 'ExpansionView'" :is-admin="isAdmin" />
      <CardSearchView v-else-if="activeSection === 'CardSearch'" :is-admin="isAdmin" />
      <OfferSearchView v-else-if="activeSection === 'OfferSearch'" />
    </main>
  </div>
</template>
