package main

import (
	"bufio"
	"log/slog"
	"os"
	"strings"

	"github.com/gin-gonic/gin"

	"chess-mentor/api/handlers"
	"chess-mentor/api/services/claude"
	"chess-mentor/api/services/lichess"
	"chess-mentor/api/services/stockfish"
)

func main() {
	loadEnvFile(".env.local")

	port := envOr("PORT", "8080")
	apiKey := os.Getenv("ANTHROPIC_API_KEY")
	clerkKey := os.Getenv("CLERK_SECRET_KEY")
	adminKey := os.Getenv("ADMIN_KEY")
	lichessBase := envOr("LICHESS_API_BASE", "https://lichess.org/api")
	sfPath := envOr("STOCKFISH_PATH", "stockfish")

	if apiKey == "" {
		slog.Warn("ANTHROPIC_API_KEY not set — Claude features will be unavailable")
	}
	if clerkKey == "" {
		slog.Warn("CLERK_SECRET_KEY not set — AI routes will be unprotected")
	} else {
		handlers.InitClerk(clerkKey)
	}

	lichessClient := lichess.NewClient(lichessBase)
	claudeClient := claude.NewClient(apiKey)

	// Stockfish is optional — if the binary is unavailable, the app keeps working
	// without move evaluations.
	sfEngine, err := stockfish.NewEngine(sfPath, 3)
	if err != nil {
		slog.Warn("Stockfish unavailable — move evals will be skipped", "err", err)
		sfEngine = nil
	} else {
		slog.Info("Stockfish ready", "path", sfPath, "workers", 3)
		defer sfEngine.Close()
	}

	r := gin.Default()
	r.Use(corsMiddleware())

	r.GET("/api/health", handlers.Health)
	r.GET("/api/profile/:username", handlers.GetProfile(lichessClient, sfEngine))

	// Routes that consume AI credits require a valid Clerk session token.
	ai := r.Group("/api")
	if clerkKey != "" {
		ai.Use(handlers.ClerkAuth())
	}
	ai.POST("/profile/narrative", handlers.NarrateProfile(claudeClient))
	ai.POST("/game/analyze", handlers.AnalyzeGame(sfEngine))
	ai.POST("/game/narrative", handlers.NarrateGame(claudeClient))
	ai.POST("/game/chat", handlers.ChatGame(claudeClient))
	ai.POST("/explain", handlers.ExplainMove(claudeClient))

	r.GET("/api/admin/usage", handlers.GetUsage(adminKey))

	slog.Info("chess-mentor API starting", "port", port)
	if err := r.Run(":" + port); err != nil {
		slog.Error("server error", "err", err)
		os.Exit(1)
	}
}

func loadEnvFile(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		if os.Getenv(strings.TrimSpace(k)) == "" {
			os.Setenv(strings.TrimSpace(k), strings.TrimSpace(v))
		}
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
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
