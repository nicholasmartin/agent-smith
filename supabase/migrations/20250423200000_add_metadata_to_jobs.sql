-- Migration: Add metadata column to jobs table
-- This migration adds a JSONB column to store additional metadata like trial_id and name components

-- Add the metadata column as JSONB with a default empty object
ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create an index on the trial_id within metadata to improve query performance
CREATE INDEX IF NOT EXISTS idx_jobs_metadata_trial_id ON jobs ((metadata->>'trial_id'));

-- Log that the migration was applied
DO $$
BEGIN
  RAISE NOTICE 'Migration applied: Added metadata JSONB column to jobs table';
END $$;
