package chess

import (
	"fmt"
	"strings"

	"chess-mentor/api/models"

	"github.com/notnil/chess"
)

type Analyzer struct{}

func NewAnalyzer() *Analyzer {
	return &Analyzer{}
}

// AnalyzeGames parses a list of PGN strings and returns the games + aggregate metrics.
func (a *Analyzer) AnalyzeGames(pgns []string, username string) ([]models.Game, models.PlayerMetrics, error) {
	games := make([]models.Game, 0, len(pgns))
	openingStats := make(map[string]struct{ wins, total int })

	for _, pgn := range pgns {
		g, err := a.AnalyzeGame(pgn)
		if err != nil {
			continue
		}

		isWhite := strings.EqualFold(g.White, username)
		playerResult := playerResult(g.Result, isWhite)

		opening := g.Opening
		if opening == "" {
			opening = "Unknown"
		}
		stat := openingStats[opening]
		stat.total++
		if playerResult == "win" {
			stat.wins++
		}
		openingStats[opening] = stat

		games = append(games, g)
	}

	metrics := buildMetrics(username, games, openingStats)
	return games, metrics, nil
}

// AnalyzeGame parses a single PGN string into a Game struct.
func (a *Analyzer) AnalyzeGame(pgn string) (models.Game, error) {
	reader := strings.NewReader(pgn)
	pgnReader, err := chess.PGN(reader)
	if err != nil {
		return models.Game{}, fmt.Errorf("invalid PGN: %w", err)
	}

	game := chess.NewGame(pgnReader)
	tags := game.TagPairs()
	tagMap := make(map[string]string, len(tags))
	for _, t := range tags {
		tagMap[t.Key] = t.Value
	}

	moves := buildMoves(game)

	return models.Game{
		ID:          tagMap["Site"],
		White:       tagMap["White"],
		Black:       tagMap["Black"],
		Result:      tagMap["Result"],
		Date:        tagMap["Date"],
		Opening:     tagMap["Opening"],
		TimeControl: tagMap["TimeControl"],
		Moves:       moves,
		PGN:         pgn,
	}, nil
}

func buildMoves(game *chess.Game) []models.Move {
	positions := game.Positions()
	chessMoves := game.Moves()
	moves := make([]models.Move, 0, len(chessMoves))

	for i, m := range chessMoves {
		color := "white"
		if i%2 == 1 {
			color = "black"
		}
		var fenAfter string
		if i+1 < len(positions) {
			fenAfter = positions[i+1].String()
		}
		moves = append(moves, models.Move{
			SAN:        m.String(),
			UCI:        moveToUCI(m),
			FENAfter:   fenAfter,
			MoveNumber: i + 1,
			Color:      color,
		})
	}
	return moves
}

func moveToUCI(m *chess.Move) string {
	from := m.S1().String()
	to := m.S2().String()
	promo := ""
	if p := m.Promo(); p != chess.NoPieceType {
		promo = strings.ToLower(p.String())
	}
	return from + to + promo
}

func playerResult(result string, isWhite bool) string {
	switch result {
	case "1-0":
		if isWhite {
			return "win"
		}
		return "loss"
	case "0-1":
		if !isWhite {
			return "win"
		}
		return "loss"
	default:
		return "draw"
	}
}

func buildMetrics(username string, games []models.Game, openingStats map[string]struct{ wins, total int }) models.PlayerMetrics {
	opStats := make(map[string]models.OpeningStat, len(openingStats))
	for name, s := range openingStats {
		wr := 0.0
		if s.total > 0 {
			wr = float64(s.wins) / float64(s.total)
		}
		opStats[name] = models.OpeningStat{Games: s.total, WinRate: wr}
	}

	// Placeholder metrics — will be computed from real Stockfish evals in later phase
	return models.PlayerMetrics{
		Username:           username,
		Elo:                parseElo(games),
		TotalGamesAnalyzed: len(games),
		OpeningStats:       opStats,
		TimePressure: models.TimePressureMetrics{
			AvgTimePerMoveSeconds:      8.0,
			AvgTimeInCriticalPositions: 4.0,
			ErrorRateUnder10s:          0.5,
		},
		MistakePatterns: models.MistakePatterns{
			Moves20To30LossRate:       0.5,
			ImpulsiveErrorsPercentage: 0.4,
		},
		PerformanceWithAdvantage:  0.5,
		PerformanceInDisadvantage: 0.6,
		MostCommonErrorType:       "por determinar con análisis de Stockfish",
	}
}

func parseElo(games []models.Game) int {
	// Lichess PGN doesn't expose ELO in a predictable tag; return 0 for now
	_ = games
	return 0
}

