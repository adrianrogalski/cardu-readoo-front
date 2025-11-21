import { apiUrl } from './config'

export interface ExpansionResponse {
  externalId: string
  name: string
}

export interface UpsertExpansionRequest {
  externalId: string
  name: string
}

export interface PatchExpansionRequest {
  name: string
}

const BASE_URL = apiUrl('/api/expansions')

export async function fetchAllExpansions(): Promise<ExpansionResponse[]> {
  const response = await fetch(BASE_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to fetch expansions')
  }

  return (await response.json()) as ExpansionResponse[]
}

export async function upsertExpansion(payload: UpsertExpansionRequest): Promise<void> {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Failed to upsert expansion')
  }
}

export async function patchExpansion(externalId: string, payload: PatchExpansionRequest): Promise<void> {
  const url = `${BASE_URL}/${encodeURIComponent(externalId)}`

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Failed to patch expansion')
  }
}

export async function deleteExpansionByName(name: string): Promise<void> {
  const url = `${BASE_URL}/by-name/${encodeURIComponent(name)}`

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to delete expansion')
  }
}
