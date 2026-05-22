import { getProfile } from '@/lib/api'
import { AnalysisPanel } from '@/components/AnalysisPanel'
import { PlayerProfile } from '@/components/PlayerProfile'
import { GameSelector } from '@/components/GameSelector'
import { ChessBoardWrapper } from '@/components/ChessBoard'

interface Props {
  params: Promise<{ username: string }>
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params
  const profile = await getProfile(username)

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-xl font-semibold">Usuario no encontrado</p>
          <p className="text-gray-400">Verifica que el nombre de usuario de Lichess sea correcto.</p>
          <a href="/" className="text-indigo-400 hover:underline text-sm">← Volver</a>
        </div>
      </main>
    )
  }

  const firstGame = profile.games[0] ?? null

  return (
    <main className="min-h-screen p-4 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{profile.username}</h1>
            <p className="text-gray-400 text-sm">ELO {profile.elo} · {profile.metrics.total_games_analyzed} partidas analizadas</p>
          </div>
          <a href="/" className="text-sm text-indigo-400 hover:underline">← Nueva búsqueda</a>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <GameSelector games={profile.games} />
            <ChessBoardWrapper game={firstGame} profileSummary={profile.narrative} />
          </div>

          <div className="space-y-4">
            <PlayerProfile profile={profile} />
            <AnalysisPanel profileSummary={profile.narrative} />
          </div>
        </div>
      </div>
    </main>
  )
}
