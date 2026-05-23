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
Tu rol es explicar el ajedrez de forma pedagógica, clara y personalizada
al perfil específico del jugador. No eres un motor de ajedrez — eres un
entrenador humano que interpreta datos y da feedback útil y memorable.
Responde siempre en el idioma del jugador.`

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
	userMsg := fmt.Sprintf(`Analiza el movimiento %s en la posición FEN: %s
Evaluación Stockfish: %s | Fase: %s | Perfil: %s

Al referirte a piezas, usa siempre su nombre en español (Rey, Reina, Torre, Alfil, Caballo, Peón) seguido de la casilla. Por ejemplo: "el Caballo de g1 va a f3" o "la Torre captura en e8". Nunca uses solo coordenadas como "g1f3".

Responde EXACTAMENTE con estas 5 secciones en markdown, sin agregar otras:

## Explicación
2-3 oraciones explicando qué hace este movimiento y por qué es bueno o malo.

## Jugadas alternativas
Menciona 1-2 jugadas que también se podían considerar en esta posición. Para cada una, explica brevemente qué hubiera conseguido — sin juzgar si la jugada elegida fue mejor o peor, solo muestra las opciones disponibles.

## Plan del jugador
¿Qué idea o plan concreto persigue quien jugó este movimiento? ¿Qué amenaza o estructura busca crear?

## Plan del contrincante
Si esta jugada es del contrincante: ¿qué amenaza o idea activa con este movimiento? ¿Cuál es su plan a corto y largo plazo?
Si esta jugada es del jugador analizado: ¿cómo debería responder el contrincante? ¿Qué plan tiene disponible?

## ¿Qué estudiar?
Un concepto o patrón específico que el jugador debería trabajar basándose en esta posición.`,
		req.Move, req.FEN, req.StockfishEval, req.GamePhase, req.PlayerProfileSummary)

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

	// Build a compact summary — only critical moves to save tokens
	var summary strings.Builder
	mistakes, blunders := 0, 0
	turningPoint := 0
	for _, m := range game.Moves {
		if m.IsBlunder {
			blunders++
			if turningPoint == 0 {
				turningPoint = m.MoveNumber
			}
			fmt.Fprintf(&summary, "Mov %d (%s) %s — BLUNDER eval=%.2f\n", m.MoveNumber, m.Color, m.SAN, m.StockfishEval)
		} else if m.IsMistake {
			mistakes++
			fmt.Fprintf(&summary, "Mov %d (%s) %s — error eval=%.2f\n", m.MoveNumber, m.Color, m.SAN, m.StockfishEval)
		} else if m.TimeSpentSeconds > 0 && m.TimeSpentSeconds < 5 && m.MoveNumber > 15 {
			fmt.Fprintf(&summary, "Mov %d (%s) %s — jugada rápida (%.1fs)\n", m.MoveNumber, m.Color, m.SAN, m.TimeSpentSeconds)
		}
	}

	userMsg := fmt.Sprintf(`Analiza esta partida como un entrenador de ajedrez.

Partida: %s (%s) vs %s (%s) — Resultado: %s
Apertura: %s | Control: %s | Total movimientos: %d
Jugador analizado: %s (juega %s)
Errores: %d errores, %d blunders

Movimientos críticos:
%s

Escribe un análisis narrativo de 3-4 párrafos:
1. Resumen general de cómo fue la partida
2. El momento bisagra y qué debió hacerse
3. Patrón principal de error del jugador en esta partida
4. Una recomendación concreta de qué trabajar`,
		game.White, fmt.Sprintf("%d", game.WhiteElo),
		game.Black, fmt.Sprintf("%d", game.BlackElo),
		game.Result, game.Opening, game.TimeControl, len(game.Moves),
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
