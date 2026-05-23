export default function Loading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      <div className="text-center space-y-1">
        <p className="text-white font-medium">Analizando tu juego…</p>
        <p className="text-gray-500 text-sm">
          Lichess · Stockfish · Claude — puede tardar ~15 segundos
        </p>
      </div>
    </main>
  )
}
