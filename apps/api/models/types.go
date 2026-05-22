package models

type OpeningStat struct {
	Games   int     `json:"games"`
	WinRate float64 `json:"win_rate"`
}

type TimePressureMetrics struct {
	AvgTimePerMoveSeconds        float64 `json:"avg_time_per_move_seconds"`
	AvgTimeInCriticalPositions   float64 `json:"avg_time_in_critical_positions"`
	ErrorRateUnder10s            float64 `json:"error_rate_under_10s"`
}

type MistakePatterns struct {
	Moves20To30LossRate         float64 `json:"moves_20_to_30_loss_rate"`
	ImpulsiveErrorsPercentage   float64 `json:"impulsive_errors_percentage"`
}

type PlayerMetrics struct {
	Username                 string                     `json:"username"`
	Elo                      int                        `json:"elo"`
	TotalGamesAnalyzed       int                        `json:"total_games_analyzed"`
	OpeningStats             map[string]OpeningStat     `json:"opening_stats"`
	TimePressure             TimePressureMetrics        `json:"time_pressure"`
	MistakePatterns          MistakePatterns            `json:"mistake_patterns"`
	PerformanceWithAdvantage float64                    `json:"performance_with_advantage"`
	PerformanceInDisadvantage float64                   `json:"performance_in_disadvantage"`
	MostCommonErrorType      string                     `json:"most_common_error_type"`
}

type Move struct {
	SAN              string  `json:"san"`
	UCI              string  `json:"uci"`
	FENAfter         string  `json:"fen_after"`
	MoveNumber       int     `json:"move_number"`
	Color            string  `json:"color"`
	TimeSpentSeconds float64 `json:"time_spent_seconds,omitempty"`
	StockfishEval    float64 `json:"stockfish_eval,omitempty"`
	IsMistake        bool    `json:"is_mistake,omitempty"`
	IsBlunder        bool    `json:"is_blunder,omitempty"`
	BestMove         string  `json:"best_move,omitempty"`
}

type Game struct {
	ID          string `json:"id"`
	White       string `json:"white"`
	Black       string `json:"black"`
	Result      string `json:"result"`
	Date        string `json:"date"`
	Opening     string `json:"opening"`
	TimeControl string `json:"time_control"`
	Moves       []Move `json:"moves"`
	PGN         string `json:"pgn"`
}

type PlayerProfile struct {
	Username   string        `json:"username"`
	Elo        int           `json:"elo"`
	Metrics    PlayerMetrics `json:"metrics"`
	Narrative  string        `json:"narrative"`
	Games      []Game        `json:"games"`
	AnalyzedAt string        `json:"analyzed_at"`
}

type ExplainRequest struct {
	FEN                  string `json:"fen"`
	Move                 string `json:"move"`
	StockfishEval        string `json:"stockfish_eval"`
	GamePhase            string `json:"game_phase"`
	PlayerProfileSummary string `json:"player_profile_summary"`
}

type ExplainResponse struct {
	Explanation          string   `json:"explanation"`
	Concepts             []string `json:"concepts,omitempty"`
	SuggestedAlternatives []string `json:"suggested_alternatives,omitempty"`
}
