-- Migration: Add user_id to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON public.jobs(user_id);

-- Add Row Level Security (RLS) policies for user access
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Users can view their own jobs
CREATE POLICY "Users can view own jobs" 
  ON public.jobs 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Admin access for service role
CREATE POLICY "Service role has full access to jobs" 
  ON public.jobs 
  USING (auth.role() = 'service_role');
