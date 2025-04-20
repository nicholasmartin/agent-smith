-- Migration: Remove Edge Function
-- Description: Removes the send-email-hook edge function as it's no longer needed with the new authentication flow

-- Drop the edge function if it exists
DROP FUNCTION IF EXISTS supabase_functions.http_request();

-- Note: The actual edge function files will remain in the repository for reference,
-- but they will no longer be deployed or used in the new authentication flow.
