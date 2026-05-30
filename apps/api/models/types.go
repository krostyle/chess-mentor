package models

type OpeningRecord struct {
	Name    string  `json:"name"`
	Games   int     `json:"games"`
	WinRate float64 `json:"win_rate"`
}

type StyleMetrics struct {
	StyleLabel         string          `json:"style_label"`
	AggressionIndex    float64         `json:"aggression_index"`
	TacticalVolatility float64         `json:"tactical_volatility"`
	AvgGameLength      float64         `json:"avg_game_length"`
	OpeningAccuracy    float64         `json:"opening_accuracy"`
	MiddlegameAccuracy float64         `json:"middlegame_accuracy"`
	EndgameAccuracy    float64         `json:"endgame_accuracy"`
	TopOpeningsWhite   []OpeningRecord `json:"top_openings_white"`
	TopOpeningsBlack   []OpeningRecord `json:"top_openings_black"`
}

type OpeningStat struct {
	Games   int     `json:"games"`
	WinRate float64 `json:"win_rate"`
}

type TimePressureMetrics struct {
	AvgTimePerMoveSeconds      float64 `json:"avg_time_per_move_seconds"`
	AvgTimeInCriticalPositions float64 `json:"avg_time_in_critical_positions"`
	ErrorRateUnder10s          float64 `json:"error_rate_under_10s"`
}

type MistakePatterns struct {
	Moves20To30LossRate       float64 `json:"moves_20_to_30_loss_rate"`
	ImpulsiveErrorsPercentage float64 `json:"impulsive_errors_percentage"`
}

type PlayerMetrics struct {
	Username                  string                 `json:"username"`
	Elo                       int                    `json:"elo"`
	TotalGamesAnalyzed        int                    `json:"total_games_analyzed"`
	OpeningStats              map[string]OpeningStat `json:"opening_stats"`
	TimePressure              TimePressureMetrics    `json:"time_pressure"`
	MistakePatterns           MistakePatterns        `json:"mistake_patterns"`
	PerformanceWithAdvantage  float64                `json:"performance_with_advantage"`
	PerformanceInDisadvantage float64                `json:"performance_in_disadvantage"`
	MostCommonErrorType       string                 `json:"most_common_error_type"`
}

type Move struct {
	SAN              string  `json:"san"`
	UCI              string  `json:"uci"`
	FENAfter         string  `json:"fen_after"`
	MoveNumber       int     `json:"move_number"`
	Color            string  `json:"color"`
	GamePhase        string  `json:"game_phase,omitempty"`
	TimeSpentSeconds float64 `json:"time_spent_seconds,omitempty"`
	StockfishEval    float64 `json:"stockfish_eval,omitempty"`
	IsMistake        bool    `json:"is_mistake,omitempty"`
	IsBlunder        bool    `json:"is_blunder,omitempty"`
	BestMove         string   `json:"best_move,omitempty"`
	BestLine         []string `json:"best_line,omitempty"`
}

type Game struct {
	ID          string `json:"id"`
	White       string `json:"white"`
	Black       string `json:"black"`
	WhiteElo    int    `json:"white_elo,omitempty"`
	BlackElo    int    `json:"black_elo,omitempty"`
	Result      string `json:"result"`
	Date        string `json:"date"`
	Opening     string `json:"opening"`
	TimeControl string `json:"time_control"`
	Moves       []Move `json:"moves"`
	PGN         string `json:"pgn"`
}

type PlayerProfile struct {
	Username     string        `json:"username"`
	Elo          int           `json:"elo"`
	Metrics      PlayerMetrics `json:"metrics"`
	StyleMetrics StyleMetrics  `json:"style_metrics"`
	Narrative    string        `json:"narrative"`
	Games        []Game        `json:"games"`
	AnalyzedAt   string        `json:"analyzed_at"`
}

type ChatMessage struct {
	Role    string `json:"role"`    // "user" | "assistant"
	Content string `json:"content"`
}

type GameChatRequest struct {
	Game           Game          `json:"game" binding:"required"`
	PlayerUsername string        `json:"player_username"`
	Messages       []ChatMessage `json:"messages" binding:"required"`
}

type ExplainRequest struct {
	FEN                  string `json:"fen"`
	Move                 string `json:"move"`
	StockfishEval        string `json:"stockfish_eval"`
	GamePhase            string `json:"game_phase"`
	PlayerProfileSummary string `json:"player_profile_summary"`
	BestMoveSAN          string `json:"best_move_san,omitempty"`
	PlayerColor          string `json:"player_color"`
	MoveColor            string `json:"move_color"`
}

type ExplainResponse struct {
	Explanation           string   `json:"explanation"`
	Concepts              []string `json:"concepts,omitempty"`
	SuggestedAlternatives []string `json:"suggested_alternatives,omitempty"`
}
