package handlers

import (
	"net/http"
	"strings"

	"github.com/clerk/clerk-sdk-go/v2"
	"github.com/clerk/clerk-sdk-go/v2/jwt"
	"github.com/gin-gonic/gin"
)

// ClerkAuth returns a Gin middleware that verifies Clerk JWT tokens.
func ClerkAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "autenticación requerida"})
			return
		}

		token := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := jwt.Verify(c.Request.Context(), &jwt.VerifyParams{Token: token})
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token inválido"})
			return
		}

		c.Set("clerk_user_id", claims.Subject)
		c.Next()
	}
}

// InitClerk initialises the Clerk SDK with the given secret key.
func InitClerk(secretKey string) {
	clerk.SetKey(secretKey)
}
