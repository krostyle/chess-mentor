package handlers

import (
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

		resp, err := claudeClient.ExplainMove(c.Request.Context(), req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudo generar la explicación"})
			return
		}

		c.JSON(http.StatusOK, resp)
	}
}
