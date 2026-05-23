package claude

import (
	"context"
	"encoding/json"
	"fmt"

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

Responde EXACTAMENTE con estas 5 secciones en markdown, sin agregar otras:

## Explicación
2-3 oraciones explicando qué hace este movimiento y por qué es bueno o malo.

## ¿Por qué no otra jugada?
Menciona 1-2 alternativas concretas y por qué este movimiento es mejor o peor que ellas.

## Plan del jugador
¿Qué idea o plan concreto persigue quien jugó este movimiento?

## Plan del contrincante
¿Qué debe intentar hacer el contrincante en respuesta? ¿Cuál es su mejor continuación?

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

func extractText(blocks []anthropic.ContentBlockUnion) string {
	for _, block := range blocks {
		if block.Type == "text" {
			return block.Text
		}
	}
	return ""
}
