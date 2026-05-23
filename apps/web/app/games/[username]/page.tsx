import { getGames } from '@/lib/api'
import { GameList } from '@/components/GameList'

interface Props {
  params: Promise<{ username: string }>
}

export default async function GamesPage({ params }: Props) {
  const { username } = await params
  const games = await getGames(username)

  if (games.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-xl font-semibold">Sin partidas</p>
          <p className="text-gray-400 text-sm">
            No se encontraron partidas públicas para <span className="text-white">{username}</span>.
          </p>
          <a href="/" className="text-indigo-400 hover:underline text-sm">← Volver</a>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-4 lg:p-6">
      <div className="mx-auto max-w-7xl">
        <GameList username={username} games={games} />
      </div>
    </main>
  )
}
