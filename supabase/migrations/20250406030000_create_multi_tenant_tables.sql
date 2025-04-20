-- Create extension for UUID generation if it doesn't exist (should already exist from previous migrations)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  description TEXT,
  website TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- Create prompt_templates table
CREATE TABLE IF NOT EXISTS public.prompt_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template TEXT NOT NULL,
  tone VARCHAR(50) DEFAULT 'conversational',
  style VARCHAR(50) DEFAULT 'formal',
  max_length INTEGER DEFAULT 200,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_companies_api_key ON public.companies(api_key);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_company_id ON public.prompt_templates(company_id, active);

-- Add RLS policies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;

-- Create policy for service role access
CREATE POLICY "Service role can do all operations on companies"
  ON public.companies
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can do all operations on prompt_templates"
  ON public.prompt_templates
  USING (true)
  WITH CHECK (true);
