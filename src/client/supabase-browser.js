/**
 * Supabase Browser Client
 * 
 * This module provides a centralized way to access the Supabase client
 * in the browser, using cookie-based authentication via @supabase/ssr.
 */

import { createBrowserClient } from '@supabase/ssr';

// Initialize Supabase client with config from meta tags
function initializeSupabase() {
  // Get config from meta tags
  const supabaseUrl = document.querySelector('meta[name="supabase-url"]').content;
  const supabaseAnonKey = document.querySelector('meta[name="supabase-anon-key"]').content;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase configuration');
    return null;
  }
  
  // Create the browser client with cookie-based auth
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}

// Export the initialized client
export const supabaseClient = initializeSupabase();

// Helper functions
export const getUser = async () => {
  const { data } = await supabaseClient.auth.getUser();
  return data?.user || null;
};

export const getSession = async () => {
  const { data } = await supabaseClient.auth.getSession();
  return data?.session || null;
};

export const signOut = async () => {
  return await supabaseClient.auth.signOut();
};
