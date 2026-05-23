# ── Build stage ───────────────────────────────────────────────────────────────
FROM golang:1.24-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /chess-mentor-api .

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends stockfish ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /chess-mentor-api /usr/local/bin/chess-mentor-api

ENV PORT=8080
ENV STOCKFISH_PATH=/usr/games/stockfish
ENV LICHESS_API_BASE=https://lichess.org/api

EXPOSE 8080
CMD ["/usr/local/bin/chess-mentor-api"]
