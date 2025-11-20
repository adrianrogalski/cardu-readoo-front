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

const BASE_URL = '/api/cards'

export async function fetchCardsByExpansionName(
  expansionName: string,
  page = 0,
  size = 50,
): Promise<CardResponse[]> {
  const url = new URL(`${BASE_URL}/by-expansion-name`, window.location.origin)
  url.searchParams.set('expansionName', expansionName)
  url.searchParams.set('page', String(page))
  url.searchParams.set('size', String(size))

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch cards by expansion name')
  }

  return (await response.json()) as CardResponse[]
}

export async function upsertCard(payload: UpsertCardRequest): Promise<void> {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Failed to upsert card')
  }
}

export async function patchCard(expExternalId: string, cardNumber: string, payload: PatchCardRequest): Promise<void> {
  const url = new URL(`${BASE_URL}/${encodeURIComponent(cardNumber)}`, window.location.origin)
  url.searchParams.set('expExternalId', expExternalId)

  const response = await fetch(url.toString(), {
    method: 'PATCH',
    headers: {
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
  const url = new URL('/api/cards/by-number', window.location.origin)
  url.searchParams.set('expansion', expExternalId)
  url.searchParams.set('number', cardNumber)

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to delete card')
  }
}
