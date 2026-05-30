package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"chess-mentor/api/models"
	"chess-mentor/api/services/claude"
)

func ScoutPlayer(claudeClient *claude.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Metrics      models.PlayerMetrics `json:"metrics" binding:"required"`
			StyleMetrics models.StyleMetrics  `json:"style_metrics"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "datos inválidos"})
			return
		}

		report, err := claudeClient.GenerateScouting(c.Request.Context(), body.Metrics, body.StyleMetrics)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudo generar el informe"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"report": report})
	}
}
