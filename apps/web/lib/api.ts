import type { PlayerProfile, Game, ExplainRequest, ExplainResponse } from '@chess-mentor/types'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'

export async function getProfile(username: string): Promise<PlayerProfile | null> {
  try {
    const res = await fetch(`${API_URL}/api/profile/${encodeURIComponent(username)}`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    return res.json() as Promise<PlayerProfile>
  } catch {
    return null
  }
}

export async function getGames(username: string): Promise<Game[]> {
  const res = await fetch(`${API_URL}/api/games/${encodeURIComponent(username)}`)
  if (!res.ok) return []
  return res.json() as Promise<Game[]>
}

export async function explainMove(req: ExplainRequest): Promise<ExplainResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/explain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    })
    if (!res.ok) return null
    return res.json() as Promise<ExplainResponse>
  } catch {
    return null
  }
}
