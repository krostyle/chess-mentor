package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"chess-mentor/api/models"
	chessanalyzer "chess-mentor/api/services/chess"
	"chess-mentor/api/services/claude"
	"chess-mentor/api/services/lichess"
	"chess-mentor/api/services/stockfish"
)

const stockfishAnnotateN = 5
const stockfishDepthProfile = 12

func GetProfile(
	lichessClient *lichess.Client,
	sfEngine *stockfish.Engine,
) gin.HandlerFunc {
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

		analyzer := chessanalyzer.NewAnalyzer()
		games, metrics, err := analyzer.AnalyzeGames(pgns, username)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "error al analizar partidas"})
			return
		}

		games = chessanalyzer.AnnotateGamesLastN(c.Request.Context(), games, stockfishAnnotateN, sfEngine, stockfishDepthProfile)

		c.JSON(http.StatusOK, buildProfile(username, games, metrics, ""))
	}
}

// NarrateProfile generates an AI narrative for a player profile on demand.
func NarrateProfile(claudeClient *claude.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		var body struct {
			Username string               `json:"username"`
			Metrics  models.PlayerMetrics `json:"metrics"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "datos inválidos"})
			return
		}

		narrative, err := claudeClient.GenerateProfile(c.Request.Context(), body.Metrics)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "no se pudo generar el análisis"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"narrative": narrative})
	}
}
