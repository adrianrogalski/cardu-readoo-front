import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { apiUrl } from '@/api/config.ts'

interface LoginRequest {
  username: string
  password: string
}

interface LoginResponse {
  username: string
  roles: string[]
  token: string
}

interface User {
  username: string
  roles: string[]
  token: string
}

const STORAGE_KEY = 'auth_user'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)

  const isAuthenticated = computed(() => user.value !== null)

  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      user.value = JSON.parse(saved) as User
    } catch {
      user.value = null
    }
  }

  async function login(username: string, password: string): Promise<void> {
    const body: LoginRequest = { username, password }

    const response = await fetch(apiUrl('/api/auth/login'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error('Login failed')
    }

    const data = (await response.json()) as LoginResponse

    user.value = {
      username: data.username,
      roles: data.roles,
      token: data.token,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(user.value))
  }

  function authHeaders(): HeadersInit {
    if (!user.value?.token) {
      return {}
    }
    return {
      Authorization: `Bearer ${user.value.token}`,
    }
  }

  function logout() {
    user.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return { user, isAuthenticated, login, logout, authHeaders }
})
