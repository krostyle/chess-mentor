package handlers

import (
	"net/http"

	"chess-mentor/api/services/stats"

	"github.com/gin-gonic/gin"
)

// GetUsage returns accumulated Claude API usage since last restart.
// Protected by X-Admin-Key header when adminKey is non-empty.
func GetUsage(adminKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if adminKey != "" && c.GetHeader("X-Admin-Key") != adminKey {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			return
		}

		snap := stats.Global.Snapshot()

		var totalCalls, totalInput, totalOutput int64
		for _, s := range snap {
			totalCalls += s.Calls
			totalInput += s.InputTokens
			totalOutput += s.OutputTokens
		}

		// claude-sonnet-4-20250514: $3/MTok input, $15/MTok output
		estimatedCost := float64(totalInput)*3/1_000_000 + float64(totalOutput)*15/1_000_000

		c.JSON(http.StatusOK, gin.H{
			"endpoints": snap,
			"totals": gin.H{
				"calls":              totalCalls,
				"input_tokens":       totalInput,
				"output_tokens":      totalOutput,
				"estimated_cost_usd": estimatedCost,
			},
		})
	}
}
