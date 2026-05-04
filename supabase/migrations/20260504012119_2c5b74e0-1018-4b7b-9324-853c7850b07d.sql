-- Restrict Realtime channel subscriptions to family members
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "family members can read realtime topics" ON realtime.messages;

CREATE POLICY "family members can read realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- topics are formatted as 'tx:<family_id>', 'profiles:<family_id>', 'presence:<family_id>'
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        realtime.topic() = 'tx:'       || p.family_id::text
     OR realtime.topic() = 'profiles:' || p.family_id::text
     OR realtime.topic() = 'presence:' || p.family_id::text
      )
  )
);

DROP POLICY IF EXISTS "family members can write realtime topics" ON realtime.messages;

CREATE POLICY "family members can write realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND (
        realtime.topic() = 'tx:'       || p.family_id::text
     OR realtime.topic() = 'profiles:' || p.family_id::text
     OR realtime.topic() = 'presence:' || p.family_id::text
      )
  )
);