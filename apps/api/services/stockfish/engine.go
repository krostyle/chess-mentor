package stockfish

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os/exec"
	"strconv"
	"strings"
	"sync"
)

// EvalResult holds the evaluation of a chess position.
// Score is in pawns from white's perspective (+2.0 = white winning by 2 pawns).
type EvalResult struct {
	Score    float64
	BestMove string
	PV       []string // principal variation: first N best moves in UCI
	IsMate   bool
	MateIn   int
}

// Engine is a pool of persistent Stockfish processes.
type Engine struct {
	workers chan *sfWorker
	path    string
}

type sfWorker struct {
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout *bufio.Reader
	mu     sync.Mutex
}

// NewEngine creates an Engine with poolSize persistent Stockfish processes.
// Returns an error if the binary cannot be started.
func NewEngine(path string, poolSize int) (*Engine, error) {
	e := &Engine{
		workers: make(chan *sfWorker, poolSize),
		path:    path,
	}
	for range poolSize {
		w, err := newWorker(path)
		if err != nil {
			e.Close()
			return nil, fmt.Errorf("failed to start stockfish worker: %w", err)
		}
		e.workers <- w
	}
	return e, nil
}

// EvaluateFEN evaluates a single FEN position at the given depth.
// Score is normalised to white's perspective regardless of side to move.
func (e *Engine) EvaluateFEN(ctx context.Context, fen string, depth int) (*EvalResult, error) {
	select {
	case w := <-e.workers:
		defer func() { e.workers <- w }()
		return w.evaluate(fen, depth)
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// EvaluateFENs evaluates a slice of FENs concurrently using the worker pool.
// Results are returned in the same order as the input slice.
func (e *Engine) EvaluateFENs(ctx context.Context, fens []string, depth int) ([]*EvalResult, error) {
	results := make([]*EvalResult, len(fens))
	errs := make([]error, len(fens))

	var wg sync.WaitGroup
	for i, fen := range fens {
		wg.Add(1)
		go func(idx int, f string) {
			defer wg.Done()
			r, err := e.EvaluateFEN(ctx, f, depth)
			results[idx] = r
			errs[idx] = err
		}(i, fen)
	}
	wg.Wait()

	for _, err := range errs {
		if err != nil {
			return results, err
		}
	}
	return results, nil
}

// Close shuts down all Stockfish worker processes.
func (e *Engine) Close() {
	close(e.workers)
	for w := range e.workers {
		fmt.Fprintln(w.stdin, "quit")
		w.cmd.Wait()
	}
}

// ─── Worker ──────────────────────────────────────────────────────────────────

func newWorker(path string) (*sfWorker, error) {
	cmd := exec.Command(path)

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, err
	}
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		return nil, err
	}

	if err := cmd.Start(); err != nil {
		return nil, err
	}

	w := &sfWorker{
		cmd:    cmd,
		stdin:  stdin,
		stdout: bufio.NewReader(stdoutPipe),
	}

	// UCI handshake
	fmt.Fprintln(w.stdin, "uci")
	if err := w.waitFor("uciok"); err != nil {
		cmd.Process.Kill()
		return nil, fmt.Errorf("uci handshake failed: %w", err)
	}

	fmt.Fprintln(w.stdin, "isready")
	if err := w.waitFor("readyok"); err != nil {
		cmd.Process.Kill()
		return nil, fmt.Errorf("isready handshake failed: %w", err)
	}

	return w, nil
}

func (w *sfWorker) evaluate(fen string, depth int) (*EvalResult, error) {
	w.mu.Lock()
	defer w.mu.Unlock()

	fmt.Fprintf(w.stdin, "position fen %s\n", fen)
	fmt.Fprintf(w.stdin, "go depth %d\n", depth)

	result := &EvalResult{}
	sideToMove := fenSideToMove(fen)

	for {
		line, err := w.stdout.ReadString('\n')
		if err != nil {
			return result, err
		}
		line = strings.TrimSpace(line)

		if strings.HasPrefix(line, "info") && strings.Contains(line, " depth ") {
			if strings.Contains(line, "score cp") {
				cp := parseField(line, "cp")
				score := cp / 100.0
				// Normalise to white's perspective
				if sideToMove == 'b' {
					score = -score
				}
				result.Score = score
			} else if strings.Contains(line, "score mate") {
				result.IsMate = true
				mateIn := int(parseField(line, "mate"))
				result.MateIn = mateIn
				if mateIn > 0 {
					result.Score = 99.0
				} else {
					result.Score = -99.0
				}
				if sideToMove == 'b' {
					result.Score = -result.Score
				}
			}
			if pv := parsePV(line, 5); len(pv) > 0 {
				result.BestMove = pv[0]
				result.PV = pv
			}
		}

		if strings.HasPrefix(line, "bestmove") {
			parts := strings.Fields(line)
			if len(parts) >= 2 && parts[1] != "(none)" {
				result.BestMove = parts[1]
			}
			break
		}
	}
	return result, nil
}

func (w *sfWorker) waitFor(token string) error {
	for {
		line, err := w.stdout.ReadString('\n')
		if err != nil {
			return err
		}
		if strings.TrimSpace(line) == token {
			return nil
		}
	}
}

// ─── FEN / output helpers ─────────────────────────────────────────────────────

// fenSideToMove returns 'w' or 'b' from a FEN string.
func fenSideToMove(fen string) byte {
	parts := strings.Fields(fen)
	if len(parts) >= 2 && len(parts[1]) > 0 {
		return parts[1][0]
	}
	return 'w'
}

// parseField finds a token in a Stockfish info line and returns the float64 after it.
func parseField(line, token string) float64 {
	idx := strings.Index(line, " "+token+" ")
	if idx < 0 {
		return 0
	}
	rest := line[idx+len(token)+2:]
	parts := strings.Fields(rest)
	if len(parts) == 0 {
		return 0
	}
	v, _ := strconv.ParseFloat(parts[0], 64)
	return v
}

// parsePV extracts up to maxMoves moves from the PV (principal variation) field.
func parsePV(line string, maxMoves int) []string {
	idx := strings.Index(line, " pv ")
	if idx < 0 {
		return nil
	}
	parts := strings.Fields(strings.TrimSpace(line[idx+4:]))
	if len(parts) == 0 {
		return nil
	}
	if len(parts) > maxMoves {
		parts = parts[:maxMoves]
	}
	return parts
}
