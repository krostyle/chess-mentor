package chess

import (
	"context"
	"strings"

	"chess-mentor/api/models"
	"chess-mentor/api/services/stockfish"
)

const (
	mistakeThreshold = 1.5 // eval drop in pawns → mistake
	blunderThreshold = 3.0 // eval drop in pawns → blunder
	startFEN         = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
)

// AnnotateGame adds StockfishEval, BestMove, IsMistake, and IsBlunder to each
// move in the game. Positions are evaluated from the start (or move skipFirst
// onward to skip opening theory). Score is always white's perspective.
func AnnotateGame(ctx context.Context, game models.Game, engine *stockfish.Engine, depth int) models.Game {
	if engine == nil || len(game.Moves) == 0 {
		return game
	}

	// Build the list of FENs to evaluate: starting position + every FENAfter.
	fens := make([]string, len(game.Moves)+1)
	fens[0] = startFEN
	for i, m := range game.Moves {
		if m.FENAfter != "" {
			fens[i+1] = m.FENAfter
		} else {
			fens[i+1] = fens[i] // fallback, shouldn't happen
		}
	}

	results, err := engine.EvaluateFENs(ctx, fens, depth)
	if err != nil || len(results) != len(fens) {
		return game
	}

	// whiteAdv[i] = white's advantage (in pawns) for fens[i].
	// EvaluateFEN already normalises to white's perspective.
	whiteAdv := make([]float64, len(results))
	for i, r := range results {
		if r != nil {
			whiteAdv[i] = clampEval(r.Score)
		}
	}

	// Annotate each move.
	annotated := make([]models.Move, len(game.Moves))
	copy(annotated, game.Moves)

	for i := range annotated {
		evalBefore := whiteAdv[i]   // position before this move
		evalAfter := whiteAdv[i+1]  // position after this move
		bestMove := ""
		if results[i] != nil {
			bestMove = results[i].BestMove
		}

		// Eval drop from the moving player's perspective.
		var drop float64
		if annotated[i].Color == "white" {
			drop = evalBefore - evalAfter // positive = got worse for white
		} else {
			drop = evalAfter - evalBefore // positive = got worse for black (eval went up for white)
		}

		annotated[i].StockfishEval = roundEval(evalAfter)
		annotated[i].BestMove = bestMove
		annotated[i].IsMistake = drop >= mistakeThreshold && drop < blunderThreshold
		annotated[i].IsBlunder = drop >= blunderThreshold
	}

	game.Moves = annotated
	return game
}

// AnnotateGamesLastN annotates only the last n games (most recent from Lichess)
// and returns the updated slice. Games beyond n are returned unchanged.
func AnnotateGamesLastN(ctx context.Context, games []models.Game, n int, engine *stockfish.Engine, depth int) []models.Game {
	if engine == nil {
		return games
	}

	limit := n
	if limit > len(games) {
		limit = len(games)
	}

	// Annotate in parallel — the engine pool controls concurrency.
	var mu context.Context = ctx
	_ = mu

	type result struct {
		idx  int
		game models.Game
	}
	ch := make(chan result, limit)

	for i := range limit {
		go func(idx int) {
			ch <- result{idx: idx, game: AnnotateGame(ctx, games[idx], engine, depth)}
		}(i)
	}

	for range limit {
		r := <-ch
		games[r.idx] = r.game
	}
	return games
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// clampEval limits mate scores to ±20 for display purposes.
func clampEval(score float64) float64 {
	switch {
	case score > 20:
		return 20
	case score < -20:
		return -20
	default:
		return score
	}
}

func roundEval(f float64) float64 {
	return float64(int(f*100+0.5)) / 100
}

// SideToMove returns "white" or "black" from a FEN string.
func SideToMove(fen string) string {
	parts := strings.Fields(fen)
	if len(parts) >= 2 && parts[1] == "b" {
		return "black"
	}
	return "white"
}
