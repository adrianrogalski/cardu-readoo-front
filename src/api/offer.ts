import { apiUrl } from './config'
import { useAuthStore } from '@/stores/auth'

export interface OfferPointResponse {
  id: number
  listedAt: string
  amount: number
  currency: string
}

export interface AddOfferRequest {
  expExternalId: string
  cardNumber: string
  amount: string
  currency: string
  listedAt: string
  cardName: string
  cardRarity: string
}

export interface PatchOfferRequest {
  amount?: string | null
  currency?: string | null
  listedAt?: string | null
}

const BASE_URL = apiUrl('/api/offers')

export async function fetchOffersByCardName(
  expExternalId: string,
  cardName: string,
  from?: string,
  to?: string,
): Promise<OfferPointResponse[]> {
  const auth = useAuthStore()

  // GET /api/offers?expId=...&cardName=...&from=...&to=...
  const url = new URL(BASE_URL, window.location.origin)
  url.searchParams.set('expId', expExternalId)
  url.searchParams.set('cardName', cardName)
  if (from) url.searchParams.set('from', from)
  if (to) url.searchParams.set('to', to)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      ...auth.authHeaders(),
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch offers by card name')
  }

  return (await response.json()) as OfferPointResponse[]
}

export async function addOffer(payload: AddOfferRequest): Promise<void> {
  const auth = useAuthStore()
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      ...auth.authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Failed to add offer')
  }
}

export async function patchOffer(id: number, payload: PatchOfferRequest): Promise<void> {
  const auth = useAuthStore()
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: 'PATCH',
    headers: {
      ...auth.authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Failed to patch offer')
  }
}

export async function deleteOffer(id: number): Promise<void> {
  const auth = useAuthStore()
  const response = await fetch(`${BASE_URL}/${id}`, {
    method: 'DELETE',
    headers: {
      ...auth.authHeaders(),
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to delete offer')
  }
}
