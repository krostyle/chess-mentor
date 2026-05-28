package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"chess-mentor/api/models"
	chessanalyzer "chess-mentor/api/services/chess"
	"chess-mentor/api/services/lichess"
	"chess-mentor/api/services/stockfish"
)

const maxStudyChapters = 30
const stockfishDepthStudy = 12

func GetStudies(lichessClient *lichess.Client, sfEngine *stockfish.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		username := c.Param("username")

		pgns, err := lichessClient.FetchStudies(c.Request.Context(), username)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "no se pudo obtener los estudios de Lichess"})
			return
		}
		if len(pgns) == 0 {
			c.JSON(http.StatusOK, gin.H{"chapters": []models.Game{}})
			return
		}

		if len(pgns) > maxStudyChapters {
			pgns = pgns[:maxStudyChapters]
		}

		analyzer := chessanalyzer.NewAnalyzer()
		chapters := make([]models.Game, 0, len(pgns))
		for _, pgn := range pgns {
			g, err := analyzer.AnalyzeGame(pgn)
			if err != nil {
				continue
			}
			chapters = append(chapters, g)
		}

		chapters = chessanalyzer.AnnotateGamesLastN(
			c.Request.Context(),
			chapters,
			len(chapters),
			sfEngine,
			stockfishDepthStudy,
		)

		c.JSON(http.StatusOK, gin.H{"chapters": chapters})
	}
}
