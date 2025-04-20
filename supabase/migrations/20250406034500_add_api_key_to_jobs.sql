-- Add api_key column to jobs table for multi-tenant support
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS api_key TEXT;

-- Create an index on api_key for faster queries
CREATE INDEX IF NOT EXISTS idx_jobs_api_key ON public.jobs(api_key);
