-- Migration to clean up JOBS table for new API key system

-- Step 1: Add company_id column (api_key_id and from_website already exist)
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

-- Step 2: Create missing indexes
CREATE INDEX IF NOT EXISTS idx_jobs_from_website ON public.jobs(from_website);
CREATE INDEX IF NOT EXISTS idx_jobs_company_id ON public.jobs(company_id);

-- Step 3: Update companies table to use the new API key system
ALTER TABLE public.companies DROP COLUMN IF EXISTS api_key;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS default_api_key_id UUID REFERENCES public.api_keys(id);

-- Step 4: We'll keep the legacy api_key column for now and remove it later
-- after all data has been migrated to the new system
