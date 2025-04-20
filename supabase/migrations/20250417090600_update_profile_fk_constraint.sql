-- Migration: Update Profile Foreign Key Constraint
-- Description: Modifies the foreign key constraint on profiles table to include CASCADE delete

-- First drop the existing constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Then recreate it with CASCADE delete
ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_id_fkey 
  FOREIGN KEY (id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- Add a comment explaining the change
COMMENT ON CONSTRAINT profiles_id_fkey ON public.profiles IS 
  'Automatically deletes profile records when the associated user is deleted';
