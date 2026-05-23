package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	chessanalyzer "chess-mentor/api/services/chess"
	"chess-mentor/api/services/lichess"
	"chess-mentor/api/services/stockfish"
)

const stockfishDepthGame = 15

func GetGames(lichessClient *lichess.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		username := c.Param("username")

		pgns, err := lichessClient.FetchGames(c.Request.Context(), username, 20)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "no se pudo obtener las partidas"})
			return
		}

		analyzer := chessanalyzer.NewAnalyzer()
		games, _, err := analyzer.AnalyzeGames(pgns, username)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "error al procesar las partidas"})
			return
		}

		c.JSON(http.StatusOK, games)
	}
}

func GetGame(lichessClient *lichess.Client, sfEngine *stockfish.Engine) gin.HandlerFunc {
	return func(c *gin.Context) {
		gameID := c.Param("game_id")

		pgn, err := lichessClient.FetchGame(c.Request.Context(), gameID)
		if err != nil {
			c.JSON(http.StatusBadGateway, gin.H{"error": "no se pudo obtener la partida"})
			return
		}

		analyzer := chessanalyzer.NewAnalyzer()
		game, err := analyzer.AnalyzeGame(pgn)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "error al procesar la partida"})
			return
		}

		game = chessanalyzer.AnnotateGame(c.Request.Context(), game, sfEngine, stockfishDepthGame)
		c.JSON(http.StatusOK, game)
	}
}
