-- Create extension for UUID generation if it doesn't exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  scrape_job_id TEXT,
  scrape_result JSONB,
  email_draft JSONB,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0
);

-- Create an index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);

-- Create a function to increment retry count
CREATE OR REPLACE FUNCTION public.increment(row_id UUID)
RETURNS INTEGER
LANGUAGE SQL
AS $$
  UPDATE public.jobs
  SET retry_count = retry_count + 1
  WHERE id = row_id
  RETURNING retry_count;
$$;

-- Add RLS policies
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access
CREATE POLICY "Service role can do all operations on jobs"
  ON public.jobs
  USING (true)
  WITH CHECK (true);
