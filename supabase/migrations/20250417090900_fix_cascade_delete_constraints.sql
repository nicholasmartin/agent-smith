-- Migration: Fix Cascade Delete Constraints
-- Description: Comprehensive fix for foreign key constraints to enable cascade delete

-- Check if we're dealing with public.profiles or profiles schema
DO $$
DECLARE
  schema_name text;
  constraint_name text;
BEGIN
  -- Find the schema and constraint name
  SELECT tc.constraint_schema, tc.constraint_name
  INTO schema_name, constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu ON tc.constraint_catalog = ccu.constraint_catalog
    AND tc.constraint_schema = ccu.constraint_schema
    AND tc.constraint_name = ccu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'profiles'
    AND ccu.table_schema = 'auth'
    AND ccu.table_name = 'users';

  -- If we found a constraint, drop it and recreate with CASCADE
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I.profiles DROP CONSTRAINT %I', schema_name, constraint_name);
    EXECUTE format('ALTER TABLE %I.profiles ADD CONSTRAINT %I FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE', 
                  schema_name, constraint_name);
    RAISE NOTICE 'Updated constraint % in schema %', constraint_name, schema_name;
  ELSE
    RAISE NOTICE 'No matching constraint found';
  END IF;
END
$$;

-- Also check for any jobs table constraints referencing user_id
DO $$
DECLARE
  schema_name text;
  constraint_name text;
BEGIN
  -- Find the schema and constraint name
  SELECT tc.constraint_schema, tc.constraint_name
  INTO schema_name, constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu ON tc.constraint_catalog = ccu.constraint_catalog
    AND tc.constraint_schema = ccu.constraint_schema
    AND tc.constraint_name = ccu.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'jobs'
    AND ccu.table_schema = 'auth'
    AND ccu.table_name = 'users';

  -- If we found a constraint, drop it and recreate with CASCADE
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I.jobs DROP CONSTRAINT %I', schema_name, constraint_name);
    EXECUTE format('ALTER TABLE %I.jobs ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE', 
                  schema_name, constraint_name);
    RAISE NOTICE 'Updated constraint % in schema %', constraint_name, schema_name;
  ELSE
    RAISE NOTICE 'No matching constraint found in jobs table';
  END IF;
END
$$;

-- Directly try to update the profiles table in public schema
ALTER TABLE IF EXISTS public.profiles 
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE IF EXISTS public.profiles 
  ADD CONSTRAINT profiles_id_fkey 
  FOREIGN KEY (id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Try with the auth schema as well
ALTER TABLE IF EXISTS auth.profiles 
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE IF EXISTS auth.profiles 
  ADD CONSTRAINT profiles_id_fkey 
  FOREIGN KEY (id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Also check for any other tables that might reference auth.users
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT tc.table_schema, tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_catalog = ccu.constraint_catalog
      AND tc.constraint_schema = ccu.constraint_schema
      AND tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'auth'
      AND ccu.table_name = 'users'
  ) LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', 
                  r.table_schema, r.table_name, r.constraint_name);
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%s) REFERENCES auth.users(id) ON DELETE CASCADE', 
                  r.table_schema, r.table_name, r.constraint_name,
                  CASE WHEN r.table_name = 'profiles' THEN 'id' ELSE 'user_id' END);
    RAISE NOTICE 'Updated constraint % on table %.%', r.constraint_name, r.table_schema, r.table_name;
  END LOOP;
END
$$;
