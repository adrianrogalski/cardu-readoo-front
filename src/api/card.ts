import { apiUrl } from './config'
import { useAuthStore } from '@/stores/auth'

export interface CardResponse {
  expExternalId: string
  cardNumber: string
  cardName: string
  cardRarity: string
}

export interface UpsertCardRequest {
  expExternalId: string
  cardNumber: string
  cardName: string
  cardRarity: string
}

export interface PatchCardRequest {
  name?: string | null
  rarity?: string | null
}

const CARDS_COLLECTION_URL = apiUrl('/api/cards')

export async function fetchCardsByExpansionName(
  expansionName: string,
  page = 0,
  size = 50,
): Promise<CardResponse[]> {
  const auth = useAuthStore()

  const url = new URL(CARDS_COLLECTION_URL, window.location.origin)
  url.searchParams.set('expansionName', expansionName)
  url.searchParams.set('page', String(page))
  url.searchParams.set('size', String(size))

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      ...auth.authHeaders(),
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch cards by expansion name')
  }

  return (await response.json()) as CardResponse[]
}

export async function upsertCard(payload: UpsertCardRequest): Promise<void> {
  const auth = useAuthStore()

  // POST /api/expansions/{expExternalId}/cards
  const url = apiUrl(`/api/expansions/${encodeURIComponent(payload.expExternalId)}/cards`)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...auth.authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      expExternalId: payload.expExternalId,
      cardNumber: payload.cardNumber,
      cardName: payload.cardName,
      cardRarity: payload.cardRarity,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to upsert card')
  }
}

export async function patchCard(expExternalId: string, cardNumber: string, payload: PatchCardRequest): Promise<void> {
  const auth = useAuthStore()

  // PATCH /api/expansions/{expExternalId}/cards/{cardNumber}
  const url = apiUrl(`/api/expansions/${encodeURIComponent(expExternalId)}/cards/${encodeURIComponent(cardNumber)}`)

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      ...auth.authHeaders(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Failed to patch card')
  }
}

export async function deleteCardByNumber(expExternalId: string, cardNumber: string): Promise<void> {
  const auth = useAuthStore()

  // DELETE /api/expansions/{expExternalId}/cards/{cardNumber}
  const url = apiUrl(`/api/expansions/${encodeURIComponent(expExternalId)}/cards/${encodeURIComponent(cardNumber)}`)

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      ...auth.authHeaders(),
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to delete card')
  }
}
