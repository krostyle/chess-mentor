package claude

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"chess-mentor/api/models"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

const systemPrompt = `Eres un Gran Maestro de ajedrez con experiencia como entrenador.
Tu rol es explicar el ajedrez de forma pedagógica, clara y personalizada.
REGLA OBLIGATORIA: Nunca uses "tú", "tu jugada" ni "jugaste". Siempre identifica el bando por color:
"las blancas jugaron X", "las negras cometieron un error", etc. Esto evita toda ambigüedad.
Responde siempre en español.`

type Client struct {
	client anthropic.Client
	model  anthropic.Model
}

func NewClient(apiKey string) *Client {
	c := anthropic.NewClient(option.WithAPIKey(apiKey))
	return &Client{
		client: c,
		model:  "claude-sonnet-4-20250514",
	}
}

// GenerateProfile generates a narrative player profile from the extracted metrics.
func (c *Client) GenerateProfile(ctx context.Context, metrics models.PlayerMetrics) (string, error) {
	metricsJSON, err := json.MarshalIndent(metrics, "", "  ")
	if err != nil {
		return "", err
	}

	userMsg := fmt.Sprintf(`Analiza estas métricas de un jugador de ajedrez y escribe un perfil pedagógico
en 3-4 párrafos. Identifica sus fortalezas, debilidades principales y el patrón de error más importante
que debe trabajar. Sé específico y usa los datos.

Métricas del jugador:
%s`, string(metricsJSON))

	msg, err := c.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     c.model,
		MaxTokens: 2048,
		System: []anthropic.TextBlockParam{
			{Text: systemPrompt},
		},
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock(userMsg)),
		},
	})
	if err != nil {
		return "", fmt.Errorf("claude API error: %w", err)
	}

	return extractText(msg.Content), nil
}

// ExplainMove generates a pedagogical explanation for a specific move in context.
func (c *Client) ExplainMove(ctx context.Context, req models.ExplainRequest) (models.ExplainResponse, error) {
	// Determine color labels
	movingColor := "las blancas"
	if req.MoveColor == "black" {
		movingColor = "las negras"
	}
	playerColor := "las blancas"
	if req.PlayerColor == "black" {
		playerColor = "las negras"
	}
	moveAuthor := movingColor + " (JUGADOR ANALIZADO)"
	if req.MoveColor != req.PlayerColor {
		moveAuthor = movingColor + " (CONTRINCANTE)"
	}

	// Eval is always from white's perspective; convert to player's perspective
	evalForPlayer := req.StockfishEval
	evalNote := "positivo = ventaja para las blancas"
	if req.PlayerColor == "black" {
		evalNote = "positivo = ventaja para las blancas, es decir, DESVENTAJA para el jugador analizado (negras)"
	}

	// Stockfish section
	var stockfishSection string
	if req.BestMoveSAN != "" && req.BestMoveSAN != req.Move {
		stockfishSection = fmt.Sprintf(
			"## Por qué Stockfish prefiere %s\n"+
				"Stockfish recomienda %s en lugar de %s (jugada de %s). "+
				"Explica en 2-3 oraciones qué ventaja concreta genera %s: "+
				"¿qué amenaza activa, qué debilidad explota, qué estructura mejora?",
			req.BestMoveSAN, req.BestMoveSAN, req.Move, movingColor, req.BestMoveSAN,
		)
	} else {
		stockfishSection = fmt.Sprintf(
			"## Por qué Stockfish prefiere esta jugada\n"+
				"%s eligió la jugada recomendada por Stockfish. "+
				"Explica en 2-3 oraciones qué hace %s especialmente buena en esta posición.",
			movingColor, req.Move,
		)
	}

	userMsg := fmt.Sprintf(`CONTEXTO DE LA JUGADA:
- Jugador analizado: %s
- Quién jugó: %s
- Jugada: %s
- Evaluación Stockfish tras la jugada: %s (%s)
- Mejor jugada según Stockfish: %s
- Fase: %s
- FEN tras la jugada: %s
- Perfil del jugador: %s

Nombra las piezas en español con su casilla: "el Caballo de g1 va a f3", "la Torre captura en e8". Nunca uses solo coordenadas.

Responde EXACTAMENTE con estas 5 secciones en markdown, sin agregar otras:

## Explicación
2-3 oraciones explicando qué hace la jugada de %s y por qué es buena o mala.

%s

## Plan del jugador
¿Qué idea o plan concreto persigue %s con este movimiento? ¿Qué amenaza o estructura busca crear?

## Plan del contrincante
¿Qué debería hacer el bando contrario en respuesta, y por qué? Si la jugada activa una amenaza, ¿cómo se neutraliza?

## ¿Qué estudiar?
Un concepto o patrón específico que el jugador analizado (%s) debería trabajar.`,
		playerColor,
		moveAuthor,
		req.Move,
		evalForPlayer, evalNote,
		func() string {
			if req.BestMoveSAN != "" {
				return req.BestMoveSAN
			}
			return "(misma jugada)"
		}(),
		req.GamePhase,
		req.FEN,
		req.PlayerProfileSummary,
		movingColor,
		stockfishSection,
		movingColor,
		playerColor,
	)

	msg, err := c.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     c.model,
		MaxTokens: 1024,
		System: []anthropic.TextBlockParam{
			{Text: systemPrompt},
		},
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock(userMsg)),
		},
	})
	if err != nil {
		return models.ExplainResponse{}, fmt.Errorf("claude API error: %w", err)
	}

	return models.ExplainResponse{
		Explanation: extractText(msg.Content),
	}, nil
}

// AnalyzeFullGame generates a coach-style narrative for the entire game.
func (c *Client) AnalyzeFullGame(ctx context.Context, game models.Game, playerUsername string) (string, error) {
	isWhite := strings.EqualFold(game.White, playerUsername)
	playerColor := "blancas"
	if !isWhite {
		playerColor = "negras"
	}

	// chessNotation converts absolute move index to standard chess notation.
	chessNotation := func(m models.Move) string {
		chessMove := (m.MoveNumber + 1) / 2
		if m.Color == "white" {
			return fmt.Sprintf("%d.%s", chessMove, m.SAN)
		}
		return fmt.Sprintf("%d...%s", chessMove, m.SAN)
	}

	// evalLabel formats the Stockfish eval (always white's perspective) with
	// an explicit label so Claude never needs to infer who benefits.
	evalLabel := func(eval float64) string {
		if eval >= 0 {
			return fmt.Sprintf("+%.2f (ventaja para las blancas)", eval)
		}
		return fmt.Sprintf("%.2f (ventaja para las negras)", eval)
	}

	// Build a compact summary — only critical moves to save tokens
	var summary strings.Builder
	mistakes, blunders := 0, 0
	for _, m := range game.Moves {
		if m.IsBlunder {
			blunders++
			fmt.Fprintf(&summary, "%s — BLUNDER eval=%s\n", chessNotation(m), evalLabel(m.StockfishEval))
		} else if m.IsMistake {
			mistakes++
			fmt.Fprintf(&summary, "%s — error eval=%s\n", chessNotation(m), evalLabel(m.StockfishEval))
		} else if m.TimeSpentSeconds > 0 && m.TimeSpentSeconds < 5 && m.MoveNumber > 15 {
			fmt.Fprintf(&summary, "%s — jugada rápida (%.1fs)\n", chessNotation(m), m.TimeSpentSeconds)
		}
	}

	totalChessMoves := (len(game.Moves) + 1) / 2

	userMsg := fmt.Sprintf(`Analiza esta partida como un entrenador de ajedrez.

Partida: %s (%d) vs %s (%d) — Resultado: %s
Apertura: %s | Control: %s | Total: %d jugadas
Jugador analizado: %s (juega %s)
Errores del jugador: %d errores, %d blunders

NOTA: La notación usa formato estándar: "12.Nd4" = blancas jugada 12, "12...Nd4" = negras jugada 12.
La evaluación es siempre desde perspectiva de las blancas. Cuando cites un valor, indica SIEMPRE para quién es la ventaja: "+4.56 (ventaja para las blancas)" o "-3.20 (ventaja para las negras)". Nunca cites solo el número.

Movimientos críticos (errores e imprecisiones):
%s
Escribe un análisis narrativo de 3-4 párrafos:
1. Resumen general de cómo fue la partida
2. El momento bisagra (indica la jugada exacta en notación estándar) y qué debió hacerse
3. Patrón principal de error del jugador analizado en esta partida
4. Una recomendación concreta de qué trabajar`,
		game.White, game.WhiteElo,
		game.Black, game.BlackElo,
		game.Result, game.Opening, game.TimeControl, totalChessMoves,
		playerUsername, playerColor,
		mistakes, blunders,
		summary.String(),
	)

	msg, err := c.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     c.model,
		MaxTokens: 1024,
		System: []anthropic.TextBlockParam{
			{Text: systemPrompt},
		},
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock(userMsg)),
		},
	})
	if err != nil {
		return "", fmt.Errorf("claude API error: %w", err)
	}
	return extractText(msg.Content), nil
}

func extractText(blocks []anthropic.ContentBlockUnion) string {
	for _, block := range blocks {
		if block.Type == "text" {
			return block.Text
		}
	}
	return ""
}
