package chess

import (
	"math"
	"sort"
	"strings"

	"chess-mentor/api/models"
)

type openingStat struct{ wins, total int }

// ComputeStyleMetrics derives playing-style metrics from a set of games for username.
// SAN-based metrics (aggression, game length, openings) use all games.
// Eval-based metrics (phase accuracy, tactical volatility) use only Stockfish-annotated games.
func ComputeStyleMetrics(games []models.Game, username string) models.StyleMetrics {
	if len(games) == 0 {
		return models.StyleMetrics{}
	}

	whiteOpenings := make(map[string]*openingStat)
	blackOpenings := make(map[string]*openingStat)

	var totalPlayerMoves, aggressiveMoves int
	var gameLengths []float64
	var openingMistakes, openingTotal int
	var middleMistakes, middleTotal int
	var endMistakes, endTotal int
	var gameVolatilities []float64

	for _, g := range games {
		isWhite := strings.EqualFold(g.White, username)
		isWin := (g.Result == "1-0" && isWhite) || (g.Result == "0-1" && !isWhite)

		name := g.Opening
		if name == "" {
			name = "Desconocida"
		}

		gameLengths = append(gameLengths, float64(len(g.Moves)))

		tbl := blackOpenings
		if isWhite {
			tbl = whiteOpenings
		}
		if tbl[name] == nil {
			tbl[name] = &openingStat{}
		}
		tbl[name].total++
		if isWin {
			tbl[name].wins++
		}

		// Detect Stockfish annotation: any move has non-zero eval or mistake flag
		annotated := false
		for _, m := range g.Moves {
			if m.StockfishEval != 0 || m.IsMistake || m.IsBlunder {
				annotated = true
				break
			}
		}

		var gameEvals []float64
		for _, m := range g.Moves {
			isPlayerMove := (m.Color == "white") == isWhite

			if isPlayerMove {
				totalPlayerMoves++
				san := m.SAN
				if strings.Contains(san, "x") || strings.Contains(san, "+") || strings.Contains(san, "#") {
					aggressiveMoves++
				}
			}

			if annotated && isPlayerMove {
				switch m.GamePhase {
				case "opening":
					openingTotal++
					if m.IsMistake || m.IsBlunder {
						openingMistakes++
					}
				case "middlegame":
					middleTotal++
					if m.IsMistake || m.IsBlunder {
						middleMistakes++
					}
				case "endgame":
					endTotal++
					if m.IsMistake || m.IsBlunder {
						endMistakes++
					}
				}
				gameEvals = append(gameEvals, m.StockfishEval)
			}
		}

		if annotated && len(gameEvals) > 2 {
			gameVolatilities = append(gameVolatilities, styleStdDev(gameEvals))
		}
	}

	aggIdx := ratio(aggressiveMoves, totalPlayerMoves)
	tactVol := mean(gameVolatilities)
	avgLen := mean(gameLengths)
	openingAcc := 1.0 - ratio(openingMistakes, openingTotal)
	middleAcc := 1.0 - ratio(middleMistakes, middleTotal)
	endAcc := 1.0 - ratio(endMistakes, endTotal)

	return models.StyleMetrics{
		StyleLabel:         classifyStyle(aggIdx, tactVol, openingAcc, middleAcc, endAcc, avgLen),
		AggressionIndex:    round2(aggIdx),
		TacticalVolatility: round2(tactVol),
		AvgGameLength:      round2(avgLen),
		OpeningAccuracy:    round2(openingAcc),
		MiddlegameAccuracy: round2(middleAcc),
		EndgameAccuracy:    round2(endAcc),
		TopOpeningsWhite:   buildOpeningRecords(whiteOpenings, 4),
		TopOpeningsBlack:   buildOpeningRecords(blackOpenings, 4),
	}
}

func classifyStyle(aggIdx, volatility, openingAcc, middleAcc, endAcc, avgLen float64) string {
	switch {
	case aggIdx > 0.22 && volatility > 2.5:
		return "táctico agresivo"
	case aggIdx > 0.22:
		return "agresivo pero sólido"
	case aggIdx < 0.14 && volatility < 1.5:
		return "posicional sólido"
	case endAcc < middleAcc-0.15 && endAcc < 0.80:
		return "fuerte en medio juego, débil en finales"
	case openingAcc < 0.80:
		return "improvisador (débil en apertura)"
	case avgLen < 35:
		return "prefiere partidas cortas"
	default:
		return "equilibrado"
	}
}

func buildOpeningRecords(stats map[string]*openingStat, n int) []models.OpeningRecord {
	type kv struct {
		name string
		s    *openingStat
	}
	var list []kv
	for name, s := range stats {
		if s.total >= 2 {
			list = append(list, kv{name, s})
		}
	}
	sort.Slice(list, func(i, j int) bool { return list[i].s.total > list[j].s.total })
	if len(list) > n {
		list = list[:n]
	}
	records := make([]models.OpeningRecord, len(list))
	for i, kv := range list {
		records[i] = models.OpeningRecord{
			Name:    kv.name,
			Games:   kv.s.total,
			WinRate: round2(float64(kv.s.wins) / float64(kv.s.total)),
		}
	}
	return records
}

func styleStdDev(vals []float64) float64 {
	if len(vals) == 0 {
		return 0
	}
	m := mean(vals)
	var sum float64
	for _, v := range vals {
		d := v - m
		sum += d * d
	}
	return math.Sqrt(sum / float64(len(vals)))
}
