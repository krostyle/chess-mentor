package handlers

import (
	"time"

	"chess-mentor/api/models"
)

func buildProfile(username string, games []models.Game, metrics models.PlayerMetrics, narrative string) models.PlayerProfile {
	elo := 0
	if len(games) > 0 {
		elo = metrics.Elo
	}

	return models.PlayerProfile{
		Username:   username,
		Elo:        elo,
		Metrics:    metrics,
		Narrative:  narrative,
		Games:      games,
		AnalyzedAt: time.Now().UTC().Format(time.RFC3339),
	}
}
