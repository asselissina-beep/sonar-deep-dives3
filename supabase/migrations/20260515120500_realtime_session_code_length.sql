-- Match 6-character session codes and join-token hardening in gameChannel.ts.

DROP POLICY IF EXISTS "anon can receive game session broadcast" ON realtime.messages;
DROP POLICY IF EXISTS "anon can send game session broadcast" ON realtime.messages;

CREATE POLICY "anon can receive game session broadcast"
ON realtime.messages
FOR SELECT
TO anon, authenticated
USING (
  realtime.messages.extension = 'broadcast'
  AND (SELECT realtime.topic()) ~ '^abyssal_session_[A-HJ-NP-Z2-9]{6}$'
);

CREATE POLICY "anon can send game session broadcast"
ON realtime.messages
FOR INSERT
TO anon, authenticated
WITH CHECK (
  realtime.messages.extension = 'broadcast'
  AND (SELECT realtime.topic()) ~ '^abyssal_session_[A-HJ-NP-Z2-9]{6}$'
);
