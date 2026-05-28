
-- Game sessions table
CREATE TABLE public.game_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code TEXT NOT NULL,
  player_name TEXT,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'ended')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sessions" ON public.game_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can create sessions" ON public.game_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update sessions" ON public.game_sessions FOR UPDATE USING (true);

CREATE INDEX idx_game_sessions_code ON public.game_sessions (session_code);
CREATE INDEX idx_game_sessions_status ON public.game_sessions (status);

-- Game scores table
CREATE TABLE public.game_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  session_code TEXT NOT NULL,
  player_name TEXT NOT NULL DEFAULT 'PILOT',
  score INTEGER NOT NULL DEFAULT 0,
  depth INTEGER NOT NULL DEFAULT 0,
  wave INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read scores" ON public.game_scores FOR SELECT USING (true);
CREATE POLICY "Anyone can create scores" ON public.game_scores FOR INSERT WITH CHECK (true);

CREATE INDEX idx_game_scores_session ON public.game_scores (session_code);
CREATE INDEX idx_game_scores_score ON public.game_scores (score DESC);
