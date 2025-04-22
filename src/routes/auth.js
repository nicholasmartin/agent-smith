/**
 * Authentication Routes for Agent Smith
 * 
 * This module contains all routes related to authentication and user management.
 */

const express = require('express');
const path = require('path');
const router = express.Router();

// Import middleware
const { protectedRouteMiddleware } = require('../middleware/auth');

// Clean URLs for auth pages (no .html)
router.get('/login', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'login.html'));
});

router.get('/signup', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'signup.html'));
});

router.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'forgot-password.html'));
});

// Serve confirmation page for authentication verification
router.get('/confirm*', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'confirm.html'));
});

// User profile endpoints
router.get('/api/user/profile', protectedRouteMiddleware, async (req, res) => {
  try {
    // User is already authenticated via middleware
    const user = req.user;
    
    // Get user's profile
    const { data: profile, error: profileError } = await req.supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
      
    if (profileError) {
      return res.status(500).json({ error: 'Error retrieving profile' });
    }
    
    return res.status(200).json({ 
      profile,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Error in user profile endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile
router.put('/api/user/profile', protectedRouteMiddleware, async (req, res) => {
  try {
    // User is already authenticated via middleware
    const user = req.user;
    
    // Get profile data from request
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Update profile
    const { data: profile, error: profileError } = await req.supabase
      .from('profiles')
      .update({ 
        name,
        updated_at: new Date()
      })
      .eq('id', user.id)
      .select()
      .single();
      
    if (profileError) {
      return res.status(500).json({ error: 'Error updating profile' });
    }
    
    return res.status(200).json({ profile });
  } catch (error) {
    console.error('Error in update profile endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user jobs
router.get('/api/user/jobs', protectedRouteMiddleware, async (req, res) => {
  try {
    // User is already authenticated via middleware
    const user = req.user;
    
    // Get user's jobs
    const { data: jobs, error: jobsError } = await req.supabase
      .from('jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
      
    if (jobsError) {
      return res.status(500).json({ error: 'Error retrieving jobs' });
    }
    
    return res.status(200).json({ jobs });
  } catch (error) {
    console.error('Error in user jobs endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
