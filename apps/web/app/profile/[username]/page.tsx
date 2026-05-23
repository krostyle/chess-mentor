import { auth } from '@clerk/nextjs/server'
import { UserButton } from '@clerk/nextjs'
import { getProfile } from '@/lib/api'
import { PlayerProfile } from '@/components/PlayerProfile'
import { GameViewer } from '@/components/GameViewer'

interface Props {
  params: Promise<{ username: string }>
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params
  const { getToken } = await auth()
  const token = await getToken()

  const profile = await getProfile(username, token ?? undefined)

  if (!profile) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-xl font-semibold">Usuario no encontrado</p>
          <p className="text-gray-400">
            Verifica que el nombre de usuario de Lichess sea correcto y que tenga partidas públicas.
          </p>
          <a href="/" className="text-indigo-400 hover:underline text-sm">← Volver</a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-4 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{profile.username}</h1>
            <p className="text-gray-400 text-sm">
              ELO {profile.elo} · {profile.metrics.total_games_analyzed} partidas analizadas
            </p>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="text-sm text-indigo-400 hover:underline">← Nueva búsqueda</a>
            <UserButton />
          </div>
        </header>

        <PlayerProfile profile={profile} />

        {profile.games.length > 0 && (
          <GameViewer
            games={profile.games}
            profileSummary={profile.metrics.most_common_error_type}
            profileNarrative={profile.narrative}
            username={username}
          />
        )}
      </div>
    </main>
  )
}
