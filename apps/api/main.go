package main

import (
	"log/slog"
	"os"

	"github.com/gin-gonic/gin"

	"chess-mentor/api/handlers"
	"chess-mentor/api/services/claude"
	"chess-mentor/api/services/lichess"
)

func main() {
	port := envOr("PORT", "8080")
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	lichessBase := envOr("LICHESS_API_BASE", "https://lichess.org/api")

	if apiKey == "" {
		slog.Warn("ANTHROPIC_API_KEY not set — Claude features will be unavailable")
	}

	lichessClient := lichess.NewClient(lichessBase)
	claudeClient := claude.NewClient(apiKey)

	r := gin.Default()

	r.Use(corsMiddleware())

	r.GET("/api/health", handlers.Health)
	r.GET("/api/profile/:username", handlers.GetProfile(lichessClient, claudeClient))
	r.GET("/api/games/:username", handlers.GetGames(lichessClient))
	r.GET("/api/game/:game_id", handlers.GetGame(lichessClient))
	r.POST("/api/explain", handlers.ExplainMove(claudeClient))

	slog.Info("chess-mentor API starting", "port", port)
	if err := r.Run(":" + port); err != nil {
		slog.Error("server error", "err", err)
		os.Exit(1)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
