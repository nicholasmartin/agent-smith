/**
 * Login Route Handler for Agent Smith
 * 
 * This route handler processes standard login requests with email and password.
 */

const express = require('express');
const router = express.Router();
const { signInWithPassword } = require('../../auth/passwordAuth');

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing email or password' });
    }
    
    // Attempt to sign in the user
    const { session, user } = await signInWithPassword(email, password);
    
    // Set the session cookie
    if (req.supabase) {
      await req.supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });
    }
    
    res.status(200).json({ success: true, user });
    
  } catch (error) {
    console.error('[AUTH] Login error:', error);
    
    // Provide a user-friendly error message
    let errorMessage = 'Invalid email or password';
    if (error.message.includes('rate limit')) {
      errorMessage = 'Too many login attempts. Please try again later.';
    }
    
    res.status(401).json({ error: errorMessage });
  }
});

module.exports = router;
