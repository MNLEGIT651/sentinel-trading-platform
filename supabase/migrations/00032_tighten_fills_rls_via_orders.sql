-- Tighten fills SELECT: scope through orders.user_id instead of open read
-- Fills are linked to orders via order_id FK; users should only see fills
-- for their own orders.

DROP POLICY IF EXISTS "Authenticated users can read fills" ON fills;

CREATE POLICY "fills_owner_select" ON fills
  FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders WHERE user_id = (SELECT auth.uid())
    )
  );

-- Also tighten fills INSERT: users can only create fills for their own orders
DROP POLICY IF EXISTS "Authenticated users can insert fills" ON fills;

CREATE POLICY "fills_owner_insert" ON fills
  FOR INSERT TO authenticated
  WITH CHECK (
    order_id IN (
      SELECT id FROM orders WHERE user_id = (SELECT auth.uid())
    )
  );

-- Ensure service_role can still manage fills (for broker webhooks/agents)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'fills' AND policyname = 'fills_service_all'
  ) THEN
    CREATE POLICY "fills_service_all" ON fills
      FOR ALL TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
