package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"chess-mentor/api/services/chess"
	"chess-mentor/api/services/claude"
	"chess-mentor/api/services/lichess"
)

func GetProfile(lichessClient *lichess.Client, claudeClient *claude.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		username := c.Param("username")

		pgns, err := lichessClient.FetchGames(c.Request.Context(), username, 50)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "no se pudo obtener las partidas de Lichess"})
			return
		}

		if len(pgns) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "usuario no encontrado o sin partidas públicas"})
			return
		}

		analyzer := chess.NewAnalyzer()
		games, metrics, err := analyzer.AnalyzeGames(pgns, username)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "error al analizar partidas"})
			return
		}

		narrative, err := claudeClient.GenerateProfile(c.Request.Context(), metrics)
		if err != nil {
			narrative = "Análisis narrativo no disponible temporalmente."
		}

		profile := buildProfile(username, games, metrics, narrative)
		c.JSON(http.StatusOK, profile)
	}
}
