package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	chessanalyzer "chess-mentor/api/services/chess"
	"chess-mentor/api/services/claude"
	"chess-mentor/api/services/lichess"
	"chess-mentor/api/services/stockfish"
)

const stockfishAnnotateN = 5  // annotate this many recent games with Stockfish
const stockfishDepthProfile = 12

func GetProfile(
	lichessClient *lichess.Client,
	claudeClient *claude.Client,
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

		// Annotate the N most recent games with Stockfish evals.
		games = chessanalyzer.AnnotateGamesLastN(c.Request.Context(), games, stockfishAnnotateN, sfEngine, stockfishDepthProfile)

		narrative, err := claudeClient.GenerateProfile(c.Request.Context(), metrics)
		if err != nil {
			narrative = "Análisis narrativo no disponible temporalmente."
		}

		c.JSON(http.StatusOK, buildProfile(username, games, metrics, narrative))
	}
}
