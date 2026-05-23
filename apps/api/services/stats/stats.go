package stats

import "sync"

type EndpointStats struct {
	Calls        int64 `json:"calls"`
	InputTokens  int64 `json:"input_tokens"`
	OutputTokens int64 `json:"output_tokens"`
}

type Store struct {
	mu   sync.Mutex
	data map[string]*EndpointStats
}

var Global = &Store{data: make(map[string]*EndpointStats)}

func (s *Store) Record(endpoint string, inputTokens, outputTokens int64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.data[endpoint]; !ok {
		s.data[endpoint] = &EndpointStats{}
	}
	e := s.data[endpoint]
	e.Calls++
	e.InputTokens += inputTokens
	e.OutputTokens += outputTokens
}

func (s *Store) Snapshot() map[string]EndpointStats {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make(map[string]EndpointStats, len(s.data))
	for k, v := range s.data {
		out[k] = *v
	}
	return out
}
