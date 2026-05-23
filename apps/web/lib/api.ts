import type { PlayerProfile, Game, ExplainRequest, ExplainResponse } from '@/types'

function apiUrl(): string {
  if (typeof window === 'undefined') {
    // Server-side: prefer API_INTERNAL_URL, fall back to NEXT_PUBLIC_API_URL
    return process.env.API_INTERNAL_URL
      ?? process.env.NEXT_PUBLIC_API_URL
      ?? 'http://localhost:8080'
  }
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
}

export async function getProfile(username: string): Promise<PlayerProfile | null> {
  try {
    const res = await fetch(
      `${apiUrl()}/api/profile/${encodeURIComponent(username)}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    return res.json() as Promise<PlayerProfile>
  } catch {
    return null
  }
}

// Fast — no Stockfish, just PGN parsing. Used for the initial games list.
export async function getGames(username: string): Promise<Game[]> {
  try {
    const res = await fetch(
      `${apiUrl()}/api/games/${encodeURIComponent(username)}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return []
    return res.json() as Promise<Game[]>
  } catch {
    return []
  }
}

// Full game with Stockfish evals at depth 15. Called client-side on demand.
export async function getGameById(gameId: string): Promise<Game | null> {
  try {
    const res = await fetch(`${apiUrl()}/api/game/${encodeURIComponent(gameId)}`)
    if (!res.ok) return null
    return res.json() as Promise<Game>
  } catch {
    return null
  }
}

export async function explainMove(req: ExplainRequest): Promise<ExplainResponse | null> {
  try {
    const res = await fetch(`${apiUrl()}/api/explain`, {
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
