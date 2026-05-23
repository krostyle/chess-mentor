package handlers

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"chess-mentor/api/models"
	chessanalyzer "chess-mentor/api/services/chess"
	"chess-mentor/api/services/claude"
	"chess-mentor/api/services/stockfish"
)

const stockfishDepthGame = 10

// NarrateGame generates a coach-style narrative for a full game.
func NarrateGame(claudeClient *claude.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Game           models.Game `json:"game" binding:"required"`
			PlayerUsername string      `json:"player_username"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "game requerido"})
			return
		}

		slog.Info("NarrateGame request", "id", body.Game.ID, "player", body.PlayerUsername)
		narrative, err := claudeClient.AnalyzeFullGame(c.Request.Context(), body.Game, body.PlayerUsername)
		if err != nil {
			slog.Error("NarrateGame claude error", "err", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudo generar el análisis"})
			return
		}

		slog.Info("NarrateGame success", "id", body.Game.ID)
		c.JSON(http.StatusOK, gin.H{"narrative": narrative})
	}
}

// AnalyzeGame receives a PGN in the request body and returns the game
// annotated with Stockfish evaluations. No second Lichess call needed.
func AnalyzeGame(sfEngine *stockfish.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			PGN string `json:"pgn" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "pgn requerido"})
			return
		}

		analyzer := chessanalyzer.NewAnalyzer()
		game, err := analyzer.AnalyzeGame(body.PGN)
		if err != nil {
			slog.Error("AnalyzeGame: parse failed", "err", err)
			c.JSON(http.StatusUnprocessableEntity, gin.H{"error": "PGN inválido"})
			return
		}

		game = chessanalyzer.AnnotateGame(c.Request.Context(), game, sfEngine, stockfishDepthGame)
		slog.Info("AnalyzeGame: done", "id", game.ID, "moves", len(game.Moves))
		c.JSON(http.StatusOK, game)
	}
}
