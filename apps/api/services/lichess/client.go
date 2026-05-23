package lichess

import (
	"bufio"
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const scannerBufSize = 4 * 1024 * 1024 // 4 MB — enough for 50 long games

type Client struct {
	baseURL    string
	httpClient *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// FetchGames downloads up to max games for the given username in PGN format.
// Returns one PGN string per game.
func (c *Client) FetchGames(ctx context.Context, username string, max int) ([]string, error) {
	url := fmt.Sprintf("%s/games/user/%s?max=%d&clocks=true&opening=true&perfType=rapid,blitz,classical,bullet", c.baseURL, username, max)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/x-chess-pgn")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("lichess API returned status %d", resp.StatusCode)
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, scannerBufSize), scannerBufSize)
	return splitPGNs(scanner), nil
}

// FetchGame downloads a single game by ID in PGN format.
func (c *Client) FetchGame(ctx context.Context, gameID string) (string, error) {
	url := fmt.Sprintf("%s/game/export/%s?clocks=true&opening=true", c.baseURL, gameID)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/x-chess-pgn")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("lichess API returned status %d", resp.StatusCode)
	}

	var sb strings.Builder
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, scannerBufSize), scannerBufSize)
	for scanner.Scan() {
		sb.WriteString(scanner.Text())
		sb.WriteByte('\n')
	}
	return sb.String(), scanner.Err()
}

// splitPGNs splits a multi-game PGN stream into individual PGN strings.
// Lichess separates games with a blank line between them; each game starts
// with an [Event "..."] tag.
func splitPGNs(scanner *bufio.Scanner) []string {
	var games []string
	var current strings.Builder
	var inMoves bool

	flush := func() {
		if current.Len() > 0 && inMoves {
			games = append(games, current.String())
		}
		current.Reset()
		inMoves = false
	}

	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "[Event ") && current.Len() > 0 {
			flush()
		}
		current.WriteString(line)
		current.WriteByte('\n')
		if line != "" && !strings.HasPrefix(line, "[") {
			inMoves = true
		}
	}
	flush()
	return games
}
