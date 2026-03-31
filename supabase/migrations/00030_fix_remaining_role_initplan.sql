-- Migration 00030: Fix 3 remaining auth.role() initplan issues
-- These were missed in 00029 — user_profiles and operator_actions role-based policies.

-- user_profiles: authenticated_read_profiles
DROP POLICY IF EXISTS "authenticated_read_profiles" ON public.user_profiles;
CREATE POLICY "authenticated_read_profiles" ON public.user_profiles FOR SELECT TO authenticated USING ((select auth.role()) = 'authenticated');

-- user_profiles: operators_insert_profiles
DROP POLICY IF EXISTS "operators_insert_profiles" ON public.user_profiles;
CREATE POLICY "operators_insert_profiles" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK ((select auth.role()) = 'authenticated');

-- operator_actions: Authenticated users can read operator actions
DROP POLICY IF EXISTS "Authenticated users can read operator actions" ON public.operator_actions;
CREATE POLICY "Authenticated users can read operator actions" ON public.operator_actions FOR SELECT TO authenticated USING ((select auth.role()) = 'authenticated');
