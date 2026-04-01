-- Migration 00031: Lock down user_profiles and catalyst_events to owner-only access
--
-- BEFORE:
--   user_profiles SELECT: any authenticated user sees ALL profiles
--   user_profiles INSERT: any authenticated user can insert for ANY user
--   catalyst_events SELECT: any authenticated user sees ALL catalysts
--
-- AFTER:
--   user_profiles SELECT: users see only their own profile
--   user_profiles INSERT: users can only create their own profile
--   catalyst_events SELECT: users see only their own catalysts
--
-- The /api/roles operator endpoint uses service_role to bypass RLS
-- for legitimate admin operations (role management, listing all users).

BEGIN;

-- ─── user_profiles: restrict SELECT to own profile ─────────────────
DROP POLICY IF EXISTS "authenticated_read_profiles" ON public.user_profiles;
CREATE POLICY "users_read_own_profile"
  ON public.user_profiles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = id);

-- ─── user_profiles: restrict INSERT to own profile ─────────────────
DROP POLICY IF EXISTS "operators_insert_profiles" ON public.user_profiles;
CREATE POLICY "users_insert_own_profile"
  ON public.user_profiles
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = id);

-- ─── catalyst_events: restrict SELECT to own catalysts ─────────────
DROP POLICY IF EXISTS "Authenticated users can read catalysts" ON public.catalyst_events;
CREATE POLICY "users_read_own_catalysts"
  ON public.catalyst_events
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

COMMIT;
