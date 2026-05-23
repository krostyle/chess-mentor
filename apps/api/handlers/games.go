package handlers

import (
	"log/slog"
	"net/http"

	"github.com/gin-gonic/gin"

	chessanalyzer "chess-mentor/api/services/chess"
	"chess-mentor/api/services/lichess"
	"chess-mentor/api/services/stockfish"
)

const stockfishDepthGame = 10

func GetGames(lichessClient *lichess.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		username := c.Param("username")

		pgns, err := lichessClient.FetchGames(c.Request.Context(), username, 20)
		if err != nil {
			slog.Error("GetGames: lichess fetch failed", "username", username, "err", err)
			c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
			return
		}
		if len(pgns) == 0 {
			slog.Warn("GetGames: no PGNs returned from lichess", "username", username)
			c.JSON(http.StatusOK, []any{})
			return
		}

		analyzer := chessanalyzer.NewAnalyzer()
		games, _, err := analyzer.AnalyzeGames(pgns, username)
		if err != nil {
			slog.Error("GetGames: analysis failed", "username", username, "err", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "error al procesar las partidas"})
			return
		}

		slog.Info("GetGames: success", "username", username, "games", len(games))
		c.JSON(http.StatusOK, games)
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
