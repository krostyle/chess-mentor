export interface OpeningStat {
  games: number
  win_rate: number
}

export interface TimePressureMetrics {
  avg_time_per_move_seconds: number
  avg_time_in_critical_positions: number
  error_rate_under_10s: number
}

export interface MistakePatterns {
  moves_20_to_30_loss_rate: number
  impulsive_errors_percentage: number
}

export interface PlayerMetrics {
  username: string
  elo: number
  total_games_analyzed: number
  opening_stats: Record<string, OpeningStat>
  time_pressure: TimePressureMetrics
  mistake_patterns: MistakePatterns
  performance_with_advantage: number
  performance_in_disadvantage: number
  most_common_error_type: string
}

export interface Move {
  san: string
  uci: string
  fen_after: string
  move_number: number
  color: 'white' | 'black'
  game_phase?: 'opening' | 'middlegame' | 'endgame'
  time_spent_seconds?: number
  stockfish_eval?: number
  is_mistake?: boolean
  is_blunder?: boolean
  best_move?: string
  best_line?: string[]
}

export interface Game {
  id: string
  white: string
  black: string
  white_elo?: number
  black_elo?: number
  result: '1-0' | '0-1' | '1/2-1/2'
  date: string
  opening: string
  time_control: string
  moves: Move[]
  pgn: string
}

export interface MoveAnalysis {
  move: string
  fen: string
  explanation: string
  stockfish_eval: number
  best_move?: string
  game_phase: 'opening' | 'middlegame' | 'endgame'
  concepts?: string[]
}

export interface PlayerProfile {
  username: string
  elo: number
  metrics: PlayerMetrics
  narrative: string
  games: Game[]
  analyzed_at: string
}

export interface ExplainRequest {
  fen: string
  move: string
  stockfish_eval: string
  game_phase: 'opening' | 'middlegame' | 'endgame'
  player_profile_summary: string
  best_move_san?: string
  player_color: 'white' | 'black'
  move_color: 'white' | 'black'
}

export interface ExplainResponse {
  explanation: string
  concepts?: string[]
  suggested_alternatives?: string[]
}

export interface GameViewState {
  selectedGameId: string | null
  currentMoveIndex: number
}
