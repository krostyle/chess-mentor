package handlers

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	"chess-mentor/api/models"
	"chess-mentor/api/services/claude"
)

func ExplainMove(claudeClient *claude.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.ExplainRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "payload inválido"})
			return
		}

		slog.Info("ExplainMove request", "move", req.Move, "phase", req.GamePhase)
		resp, err := claudeClient.ExplainMove(c.Request.Context(), req)
		if err != nil {
			slog.Error("ExplainMove claude error", "err", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudo generar la explicación"})
			return
		}

		slog.Info("ExplainMove success", "move", req.Move)
		c.JSON(http.StatusOK, resp)
	}
}
