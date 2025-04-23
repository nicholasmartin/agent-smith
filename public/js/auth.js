/**
 * Simplified Authentication Utilities for Agent Smith
 * 
 * This module provides client-side authentication utilities for the Agent Smith application.
 */

// Check if user is authenticated
async function isAuthenticated() {
  const { data: { session } } = await window.supabase.auth.getSession();
  return !!session;
}

// Sign out the current user
async function signOut() {
  const { error } = await window.supabase.auth.signOut();
  if (!error) {
    window.location.href = '/login';
  }
  return { error };
}

// Get the current user
async function getCurrentUser() {
  const { data: { user } } = await window.supabase.auth.getUser();
  return user;
}

// Export utilities
window.AuthUtils = {
  isAuthenticated,
  signOut,
  getCurrentUser
};
