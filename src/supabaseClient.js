/**
 * Supabase client module for Agent Smith
 * Provides a configured Supabase client for database operations
 */
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
