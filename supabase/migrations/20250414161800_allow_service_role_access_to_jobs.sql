-- Migration: Allow service role access to jobs table
-- This migration ensures the Supabase edge function can access job data
-- by creating appropriate RLS policies for the service role

-- Enable RLS on jobs table if not already enabled
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows the service role to access all rows in the jobs table
CREATE POLICY "Service Role Full Access" ON jobs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Grant all permissions to the service role
GRANT ALL ON jobs TO service_role;

-- Optional: Create a policy for authenticated users to see only their own jobs
CREATE POLICY "Users can view own jobs" ON jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Log that the migration was applied
DO $$
BEGIN
  RAISE NOTICE 'Migration applied: Allow service role access to jobs table';
END $$;
