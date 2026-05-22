package stockfish

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os/exec"
	"strconv"
	"strings"
)

type Engine struct {
	path string
}

func NewEngine(path string) *Engine {
	return &Engine{path: path}
}

type EvalResult struct {
	Score    float64
	BestMove string
}

// EvaluateFEN starts a short Stockfish analysis on the given FEN and returns
// the centipawn score (from the current side's perspective) and best move.
func (e *Engine) EvaluateFEN(ctx context.Context, fen string, depth int) (*EvalResult, error) {
	cmd := exec.CommandContext(ctx, e.path)

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("stockfish not available: %w", err)
	}
	defer cmd.Process.Kill()

	go func() {
		defer stdin.Close()
		fmt.Fprintf(stdin, "position fen %s\n", fen)
		fmt.Fprintf(stdin, "go depth %d\n", depth)
	}()

	result := &EvalResult{}
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "info") && strings.Contains(line, "score cp") {
			result.Score = parseCP(line) / 100.0
		}
		if strings.HasPrefix(line, "bestmove") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				result.BestMove = parts[1]
			}
			break
		}
	}

	io.Copy(io.Discard, stdout)
	return result, nil
}

func parseCP(line string) float64 {
	parts := strings.Fields(line)
	for i, p := range parts {
		if p == "cp" && i+1 < len(parts) {
			v, _ := strconv.ParseFloat(parts[i+1], 64)
			return v
		}
	}
	return 0
}
