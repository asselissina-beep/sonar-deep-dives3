CREATE POLICY "Anyone can delete sessions" ON public.game_sessions FOR DELETE USING (true);
CREATE POLICY "Anyone can delete scores" ON public.game_scores FOR DELETE USING (true);