package chess

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"chess-mentor/api/models"

	"github.com/notnil/chess"
)

var (
	clockRe       = regexp.MustCompile(`\[%clk (\d+):(\d+):(\d+)\]`)
	timeControlRe = regexp.MustCompile(`^(\d+)\+(\d+)$`)
	siteIDRe      = regexp.MustCompile(`/([A-Za-z0-9]+)$`)
)

// Piece material values in pawns
var pieceValue = map[byte]int{
	'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9,
	'p': 1, 'n': 3, 'b': 3, 'r': 5, 'q': 9,
}

type Analyzer struct{}

func NewAnalyzer() *Analyzer { return &Analyzer{} }

// gameData holds per-game aggregation data for metrics computation.
type gameData struct {
	result      string
	elapsedMine []float64
	matAt20     int
	totalMoves  int
}

// AnalyzeGames parses PGNs and returns games + aggregate metrics for username.
func (a *Analyzer) AnalyzeGames(pgns []string, username string) ([]models.Game, models.PlayerMetrics, error) {
	games := make([]models.Game, 0, len(pgns))
	aggData := make([]gameData, 0, len(pgns))
	openingStats := make(map[string]struct{ wins, total int })
	latestElo := 0

	for _, pgn := range pgns {
		g, err := a.AnalyzeGame(pgn)
		if err != nil {
			continue
		}

		isWhite := strings.EqualFold(g.White, username)
		res := playerResult(g.Result, isWhite)

		opening := g.Opening
		if opening == "" {
			opening = "Unknown"
		}
		stat := openingStats[opening]
		stat.total++
		if res == "win" {
			stat.wins++
		}
		openingStats[opening] = stat

		if latestElo == 0 {
			if isWhite {
				latestElo = g.WhiteElo
			} else {
				latestElo = g.BlackElo
			}
		}

		aggData = append(aggData, gameData{
			result:      res,
			elapsedMine: playerElapsedTimes(g.Moves, isWhite),
			matAt20:     materialBalanceAt(g.Moves, 20, isWhite),
			totalMoves:  len(g.Moves),
		})
		games = append(games, g)
	}

	metrics := buildMetrics(username, latestElo, aggData, openingStats)
	return games, metrics, nil
}

// AnalyzeGame parses a single PGN string into a Game with moves and clock data.
func (a *Analyzer) AnalyzeGame(pgn string) (models.Game, error) {
	reader := strings.NewReader(pgn)
	pgnReader, err := chess.PGN(reader)
	if err != nil {
		return models.Game{}, fmt.Errorf("invalid PGN: %w", err)
	}

	game := chess.NewGame(pgnReader)
	tags := buildTagMap(game)

	clocks := parseClocks(pgn)
	initSecs := parseTimeControlSecs(tags["TimeControl"])
	elapsed := computeElapsedTimes(clocks, initSecs)

	return models.Game{
		ID:          extractGameID(tags["Site"]),
		White:       tags["White"],
		Black:       tags["Black"],
		WhiteElo:    atoiSafe(tags["WhiteElo"]),
		BlackElo:    atoiSafe(tags["BlackElo"]),
		Result:      tags["Result"],
		Date:        tags["Date"],
		Opening:     tags["Opening"],
		TimeControl: tags["TimeControl"],
		Moves:       buildMoves(game, elapsed),
		PGN:         pgn,
	}, nil
}

// ─── Move building ────────────────────────────────────────────────────────────

func buildMoves(game *chess.Game, elapsed []float64) []models.Move {
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
		var timeSpent float64
		if i < len(elapsed) {
			timeSpent = elapsed[i]
		}
		moves = append(moves, models.Move{
			SAN:              m.String(),
			UCI:              moveToUCI(m),
			FENAfter:         fenAfter,
			MoveNumber:       i + 1,
			Color:            color,
			GamePhase:        gamePhase(i + 1),
			TimeSpentSeconds: timeSpent,
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

// ─── Clock / time parsing ────────────────────────────────────────────────────

// parseClocks extracts remaining clock values in seconds from Lichess PGN annotations.
// Format: { [%clk 0:04:57] }
func parseClocks(pgn string) []float64 {
	matches := clockRe.FindAllStringSubmatch(pgn, -1)
	clocks := make([]float64, len(matches))
	for i, m := range matches {
		h, _ := strconv.Atoi(m[1])
		min, _ := strconv.Atoi(m[2])
		sec, _ := strconv.Atoi(m[3])
		clocks[i] = float64(h*3600 + min*60 + sec)
	}
	return clocks
}

// parseTimeControlSecs returns the base time in seconds from "300+3". Default 300.
func parseTimeControlSecs(tc string) float64 {
	if m := timeControlRe.FindStringSubmatch(tc); m != nil {
		base, _ := strconv.Atoi(m[1])
		return float64(base)
	}
	return 300
}

// computeElapsedTimes derives time spent per move from remaining clock values.
// clocks[i] is the remaining time after move i; same-color prev is clocks[i-2].
func computeElapsedTimes(clocks []float64, initSecs float64) []float64 {
	elapsed := make([]float64, len(clocks))
	for i, clk := range clocks {
		prev := initSecs
		if i >= 2 {
			prev = clocks[i-2]
		}
		e := prev - clk
		if e < 0 {
			e = 0
		}
		elapsed[i] = e
	}
	return elapsed
}

// ─── Material balance ─────────────────────────────────────────────────────────

// materialBalance returns white_material - black_material from a FEN string.
func materialBalance(fen string) int {
	board := strings.Fields(fen)[0]
	white, black := 0, 0
	for i := 0; i < len(board); i++ {
		c := board[i]
		v, ok := pieceValue[c]
		if !ok {
			continue
		}
		if c >= 'A' && c <= 'Z' {
			white += v
		} else {
			black += v
		}
	}
	return white - black
}

// materialBalanceAt returns material balance from the player's perspective at move n.
func materialBalanceAt(moves []models.Move, n int, isWhite bool) int {
	idx := n - 1
	if idx >= len(moves) {
		idx = len(moves) - 1
	}
	if idx < 0 || moves[idx].FENAfter == "" {
		return 0
	}
	bal := materialBalance(moves[idx].FENAfter)
	if !isWhite {
		return -bal
	}
	return bal
}

// playerElapsedTimes returns only the elapsed times for the player's own moves.
func playerElapsedTimes(moves []models.Move, isWhite bool) []float64 {
	var times []float64
	for _, m := range moves {
		if (m.Color == "white") == isWhite && m.TimeSpentSeconds > 0 {
			times = append(times, m.TimeSpentSeconds)
		}
	}
	return times
}

// ─── Metrics aggregation ─────────────────────────────────────────────────────

func buildMetrics(
	username string,
	elo int,
	aggs []gameData,
	openingStats map[string]struct{ wins, total int },
) models.PlayerMetrics {
	// Opening stats
	opStats := make(map[string]models.OpeningStat, len(openingStats))
	for name, s := range openingStats {
		wr := 0.0
		if s.total > 0 {
			wr = float64(s.wins) / float64(s.total)
		}
		opStats[name] = models.OpeningStat{Games: s.total, WinRate: wr}
	}

	// Time metrics
	var allTimes, midTimes []float64
	underTen, impulsive, totalMoves := 0, 0, 0
	for _, ag := range aggs {
		for i, t := range ag.elapsedMine {
			allTimes = append(allTimes, t)
			totalMoves++
			if t < 10 {
				underTen++
			}
			if t < 3 {
				impulsive++
			}
			if i >= 7 && i <= 14 { // ~moves 15-30 for this player
				midTimes = append(midTimes, t)
			}
		}
	}

	errorRateUnder10 := ratio(underTen, totalMoves)
	impulsivePct := ratio(impulsive, totalMoves)

	// Middlegame loss rate (games decided in 20-40 total moves)
	midLoss, midTotal := 0, 0
	for _, ag := range aggs {
		if ag.totalMoves >= 20 && ag.totalMoves <= 40 {
			midTotal++
			if ag.result == "loss" {
				midLoss++
			}
		}
	}

	// Performance with/without material advantage at move 20
	advWins, advTotal, disadvWins, disadvTotal := 0, 0, 0, 0
	for _, ag := range aggs {
		switch {
		case ag.matAt20 >= 2:
			advTotal++
			if ag.result == "win" {
				advWins++
			}
		case ag.matAt20 <= -2:
			disadvTotal++
			if ag.result == "win" {
				disadvWins++
			}
		}
	}

	perfAdv := winRate(advWins, advTotal)
	perfDisadv := winRate(disadvWins, disadvTotal)
	moves20Loss := ratio(midLoss, midTotal)

	return models.PlayerMetrics{
		Username:           username,
		Elo:                elo,
		TotalGamesAnalyzed: len(aggs),
		OpeningStats:       opStats,
		TimePressure: models.TimePressureMetrics{
			AvgTimePerMoveSeconds:      round2(mean(allTimes)),
			AvgTimeInCriticalPositions: round2(mean(midTimes)),
			ErrorRateUnder10s:          round2(errorRateUnder10),
		},
		MistakePatterns: models.MistakePatterns{
			Moves20To30LossRate:       round2(moves20Loss),
			ImpulsiveErrorsPercentage: round2(impulsivePct),
		},
		PerformanceWithAdvantage:  round2(perfAdv),
		PerformanceInDisadvantage: round2(perfDisadv),
		MostCommonErrorType:       classifyMainError(errorRateUnder10, moves20Loss, perfAdv, impulsivePct),
	}
}

func classifyMainError(errorRateUnder10, moves20LossRate, perfAdv, impulsivePct float64) string {
	switch {
	case perfAdv < 0.45:
		return "dificultad para convertir ventajas materiales"
	case moves20LossRate > 0.60:
		return "pierde la concentración en el medio juego (movimientos 20-40)"
	case errorRateUnder10 > 0.55:
		return "jugadas impulsivas bajo presión de tiempo"
	case impulsivePct > 0.30:
		return "tendencia a jugar demasiado rápido sin evaluar las consecuencias"
	default:
		return "inconsistencia en la calidad de las jugadas a lo largo de la partida"
	}
}

// ─── Small helpers ────────────────────────────────────────────────────────────

func gamePhase(moveNum int) string {
	switch {
	case moveNum <= 10:
		return "opening"
	case moveNum <= 30:
		return "middlegame"
	default:
		return "endgame"
	}
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

func buildTagMap(game *chess.Game) map[string]string {
	m := make(map[string]string)
	for _, t := range game.TagPairs() {
		m[t.Key] = t.Value
	}
	return m
}

func extractGameID(site string) string {
	if m := siteIDRe.FindStringSubmatch(site); m != nil {
		return m[1]
	}
	return site
}

func atoiSafe(s string) int {
	v, _ := strconv.Atoi(s)
	return v
}

func mean(vals []float64) float64 {
	if len(vals) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range vals {
		sum += v
	}
	return sum / float64(len(vals))
}

func ratio(num, den int) float64 {
	if den == 0 {
		return 0
	}
	return float64(num) / float64(den)
}

func winRate(wins, total int) float64 {
	if total == 0 {
		return 0.5
	}
	return float64(wins) / float64(total)
}

func round2(f float64) float64 {
	return float64(int(f*100+0.5)) / 100
}
