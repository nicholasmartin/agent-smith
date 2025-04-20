-- Migration: Refactor Authentication Flow
-- Description: Updates the database schema to support the new authentication flow
-- where users are created immediately at form submission

-- Remove invitation_pending column as it's no longer needed
ALTER TABLE public.jobs DROP COLUMN IF EXISTS invitation_pending;

-- Ensure user_id column exists and is properly indexed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_attribute 
        WHERE attrelid = 'public.jobs'::regclass 
        AND attname = 'user_id' 
        AND NOT attisdropped
    ) THEN
        ALTER TABLE public.jobs ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END
$$;

-- Create index on user_id if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'jobs' 
        AND indexname = 'jobs_user_id_idx'
    ) THEN
        CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON public.jobs(user_id);
    END IF;
END
$$;

-- Add email_sent column to track if the final email has been sent
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;

-- Create index on email_sent for efficient querying
CREATE INDEX IF NOT EXISTS jobs_email_sent_idx ON public.jobs(email_sent);

-- Update RLS policies to ensure proper access
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Create or replace policy for service role access
DROP POLICY IF EXISTS "Service role can do anything" ON public.jobs;
CREATE POLICY "Service role can do anything" ON public.jobs
    USING (true)
    WITH CHECK (true);

-- Create or replace policy for authenticated users to view their own jobs
DROP POLICY IF EXISTS "Users can view their own jobs" ON public.jobs;
CREATE POLICY "Users can view their own jobs" ON public.jobs
    FOR SELECT
    USING (auth.uid() = user_id);
