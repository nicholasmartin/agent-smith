-- Migration: Add invitation_pending column to jobs table
-- This migration adds a boolean column to track if an invitation email needs to be sent

-- Add the invitation_pending column with a default value of false
ALTER TABLE jobs 
ADD COLUMN invitation_pending BOOLEAN DEFAULT FALSE;

-- Add an index to improve query performance when filtering by invitation_pending
CREATE INDEX idx_jobs_invitation_pending ON jobs (invitation_pending) 
WHERE invitation_pending = TRUE;

-- Log that the migration was applied
DO $$
BEGIN
  RAISE NOTICE 'Migration applied: Added invitation_pending column to jobs table';
END $$;
