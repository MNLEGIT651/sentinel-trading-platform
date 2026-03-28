-- Migration: Operator Roles & Approval Tiers
-- Adds role-based access control for the Sentinel Trading Platform.
-- Roles: observer (read-only), reviewer (can comment), approver (can approve trades), operator (full control)

-- 1. User profiles table with role assignment
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'operator'
    CHECK (role IN ('observer', 'reviewer', 'approver', 'operator')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE user_profiles IS 'User profiles with operator role assignments';
COMMENT ON COLUMN user_profiles.role IS 'observer=read-only, reviewer=can comment, approver=can approve trades, operator=full control';

-- Auto-create profile on first sign-in (default to operator for solo users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'operator'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE TRIGGER set_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);

-- 2. RLS policies for user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all profiles (needed for display names in UI)
CREATE POLICY "authenticated_read_profiles"
  ON user_profiles FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can update their own display_name only (role changes require operator)
CREATE POLICY "users_update_own_profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Only operators can insert profiles (auto-trigger handles normal creation)
CREATE POLICY "operators_insert_profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 3. Helper function to check user role
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
  SELECT COALESCE(
    (SELECT role FROM public.user_profiles WHERE id = p_user_id),
    'operator'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 4. Helper function to check if user has minimum role level
CREATE OR REPLACE FUNCTION public.has_role_level(
  p_required_role TEXT,
  p_user_id UUID DEFAULT auth.uid()
) RETURNS BOOLEAN AS $$
DECLARE
  v_user_role TEXT;
  v_role_levels JSONB := '{"observer": 1, "reviewer": 2, "approver": 3, "operator": 4}'::jsonb;
BEGIN
  v_user_role := public.get_user_role(p_user_id);
  RETURN (v_role_levels->>v_user_role)::int >= (v_role_levels->>p_required_role)::int;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 5. Role change audit log
CREATE TABLE IF NOT EXISTS role_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  old_role TEXT NOT NULL,
  new_role TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE role_change_log ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read role change history
CREATE POLICY "authenticated_read_role_changes"
  ON role_change_log FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only operators can insert role change records
CREATE POLICY "operators_insert_role_changes"
  ON role_change_log FOR INSERT
  WITH CHECK (public.has_role_level('operator'));

-- 6. Add approved_by to agent_recommendations if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_recommendations' AND column_name = 'reviewed_by'
  ) THEN
    ALTER TABLE agent_recommendations
      ADD COLUMN reviewed_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- 7. Enable realtime for user_profiles
ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;

-- 8. Create indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_role_change_log_target ON role_change_log(target_user_id, created_at DESC);
