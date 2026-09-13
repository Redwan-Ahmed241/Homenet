-- Step 1: Create the trigger function
CREATE OR REPLACE FUNCTION assign_default_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO "UserRole" (id, user_id, role_id, assigned_by, created_at)
  VALUES (
    gen_random_uuid()::text,
    NEW.id,
    'role-buyer-001',
    NULL,
    NOW()
  )
  ON CONFLICT (user_id, role_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 2: Attach the trigger to the User table
CREATE TRIGGER trg_assign_default_role
  AFTER INSERT ON "User"
  FOR EACH ROW
  EXECUTE FUNCTION assign_default_role();
