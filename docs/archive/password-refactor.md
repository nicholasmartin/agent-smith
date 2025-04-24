# Password-Based Authentication Refactor

## Current Problems with Magic Link Authentication

The Agent Smith application has encountered persistent issues with Supabase magic link authentication:

1. **Token Consumption Issues**: Magic link tokens are being consumed before the user can use them, likely by email security scanners or prefetching.
2. **Complex Redirect Chain**: The current flow involves multiple redirects that can break the authentication state.
3. **Hash Fragment Limitations**: Authentication tokens in URL hash fragments aren't accessible to server-side code.
4. **Session Establishment Timing**: Race conditions between token processing and middleware authentication checks.
5. **Debug Challenges**: Difficult to trace issues due to limited visibility into the token flow.

## Current Implementation (Problems)

The current authentication implementation is spread across several files with overlapping and sometimes conflicting responsibilities:

### Magic Link Generation
- `src/auth/magicLinkGenerator.js`: Generates magic links but struggles with parameter handling
- `src/emailDelivery.js`: Determines when to generate magic links based on complex conditions

### Authentication Handling
- `api/auth/callback.js`: Attempts to handle tokens but can't access hash fragments
- `public/js/auth-handler.js`: Client-side processing that competes with server redirects
- `public/js/supabase-client.js`: Contains duplicate auth logic mixed with other functionality

### Routing and Middleware
- `src/middleware/auth.js`: Authentication middleware that breaks the magic link flow
- `src/routes/dashboard.js`: Dashboard routes with middleware that requires authentication
- `server.js`: Multiple middleware layers and route handling with confusing precedence

## Proposed Solution: Password-Based Authentication

We'll implement a simpler, more reliable email + password authentication flow:

1. User submits the webform
2. System sends email with link to "Create Password" page
3. User creates password and is immediately logged in
4. User is redirected to dashboard with their job results

### Benefits
- No one-time tokens that can be prematurely consumed
- Simpler, more standard authentication flow
- Better user experience with clear steps
- Elimination of complex redirect chains
- More reliable debugging and troubleshooting

## Implementation Plan

### 1. New Files to Create

#### A. Backend (Server-side)
- `src/auth/passwordAuth.js`: Centralized password authentication handling
- `src/routes/auth/create-password.js`: Route handler for password creation
- `src/routes/auth/login.js`: Route handler for standard login

#### B. Frontend (Client-side)
- `public/create-password.html`: Password creation page
- `public/js/create-password.js`: Client-side code for password creation
- `public/js/auth.js`: Simplified authentication utilities

### 2. Files to Modify

- `src/emailDelivery.js`: Update to send links to password creation page
- `src/emailService.js`: Update email templates for password flow
- `server.js`: Update routes and middleware for new authentication flow
- `public/dashboard.html`: Update to work with new authentication
- `public/login.html`: Update for standard login

### 3. Files to Remove (After Implementation)

- `src/auth/magicLinkGenerator.js`: No longer needed
- `api/auth/callback.js`: No longer needed
- `public/js/auth-handler.js`: Replaced by simpler auth.js

## Detailed Implementation Steps

### Step 1: Create Password Authentication Module

Create a new file `src/auth/passwordAuth.js` that will handle all password-related authentication:

```javascript
/**
 * Password Authentication Module for Agent Smith
 * 
 * This module provides a centralized place for handling password authentication.
 */

const supabase = require('../supabaseClient');

/**
 * Create a user account with email and password
 * 
 * @param {string} email - User's email address
 * @param {string} password - User's chosen password
 * @param {Object} metadata - Additional user data
 * @returns {Promise<Object>} Result of the operation
 */
async function createUserWithPassword(email, password, metadata = {}) {
  console.log(`[AUTH] Creating user account for: ${email}`);
  
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // Auto-confirm email
    user_metadata: metadata
  });
  
  if (error) {
    console.error(`[AUTH] Error creating user: ${error.message}`);
    throw error;
  }
  
  console.log(`[AUTH] User account created successfully for: ${email}`);
  return data;
}

/**
 * Generate a password creation link
 * 
 * @param {string} email - User's email address
 * @param {string} jobId - ID of the job
 * @returns {string} URL for password creation
 */
function generatePasswordCreationLink(email, jobId) {
  // Create a secure link to the password creation page
  const baseUrl = process.env.BASE_URL || 'https://agent-smith.magloft.com';
  const encodedEmail = encodeURIComponent(email);
  const encodedJobId = encodeURIComponent(jobId);
  
  return `${baseUrl}/create-password?email=${encodedEmail}&job_id=${encodedJobId}`;
}

module.exports = {
  createUserWithPassword,
  generatePasswordCreationLink
};
```

### Step 2: Update Email Delivery

Modify `src/emailDelivery.js` to use the new password creation flow:

```javascript
// Replace magic link generation with password creation link
const { generatePasswordCreationLink } = require('./auth/passwordAuth');

// In the sendJobCompletionEmail function:
async function sendJobCompletionEmail(job, requiresAuth = false) {
  // ... existing code ...
  
  let inviteLink = null;
  if (requiresAuth) {
    // Generate password creation link instead of magic link
    inviteLink = generatePasswordCreationLink(job.email, job.id);
    console.log(`[EMAIL] Generated password creation link for job ${job.id}`);
  }
  
  // ... rest of function ...
}
```

### Step 3: Create Password Creation Page and Handlers

Create a new file `public/create-password.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Create Password - Agent Smith</title>
  <link rel="stylesheet" href="/css/styles.css">
  
  <!-- Supabase -->
  <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
  <script src="/js/supabase-client.js" defer></script>
  <script src="/js/create-password.js" defer></script>
</head>
<body>
  <div class="container">
    <div class="auth-form">
      <h1>Create Your Password</h1>
      <p>Set a password to access your Agent Smith dashboard.</p>
      
      <div id="error-message" class="error-message hidden"></div>
      <div id="success-message" class="success-message hidden"></div>
      
      <form id="password-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" disabled>
        </div>
        
        <div class="form-group">
          <label for="password">Password</label>
          <input type="password" id="password" name="password" minlength="8" required>
          <small>Must be at least 8 characters</small>
        </div>
        
        <div class="form-group">
          <label for="confirm-password">Confirm Password</label>
          <input type="password" id="confirm-password" name="confirm-password" minlength="8" required>
        </div>
        
        <button type="submit" class="btn btn-primary">Create Password & Sign In</button>
      </form>
    </div>
  </div>
</body>
</html>
```

Create client-side handler `public/js/create-password.js`:

```javascript
document.addEventListener('DOMContentLoaded', () => {
  // Get URL parameters
  const params = new URLSearchParams(window.location.search);
  const email = params.get('email');
  const jobId = params.get('job_id');
  
  // Set email field value
  const emailField = document.getElementById('email');
  if (emailField && email) {
    emailField.value = email;
  }
  
  // Handle form submission
  const form = document.getElementById('password-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');
    
    // Clear previous messages
    errorMessage.textContent = '';
    errorMessage.classList.add('hidden');
    successMessage.classList.add('hidden');
    
    // Validate passwords match
    if (password !== confirmPassword) {
      errorMessage.textContent = 'Passwords do not match';
      errorMessage.classList.remove('hidden');
      return;
    }
    
    try {
      // Create user account with password
      const { data, error } = await fetch('/api/auth/create-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          password,
          jobId
        })
      }).then(res => res.json());
      
      if (error) {
        throw new Error(error);
      }
      
      // Show success message
      successMessage.textContent = 'Password created! Signing you in...';
      successMessage.classList.remove('hidden');
      
      // Sign in the user
      const { error: signInError } = await window.supabase.auth.signInWithPassword({
        email,
        password
      });
      
      if (signInError) {
        throw new Error(signInError.message);
      }
      
      // Redirect to dashboard
      window.location.href = '/dashboard';
      
    } catch (error) {
      errorMessage.textContent = error.message || 'An error occurred';
      errorMessage.classList.remove('hidden');
    }
  });
});
```

### Step 4: Create API Endpoint for Password Creation

Create a new route handler `src/routes/auth/create-password.js`:

```javascript
const express = require('express');
const router = express.Router();
const { createUserWithPassword } = require('../../auth/passwordAuth');
const { getJobById } = require('../../jobStore');

router.post('/create-password', async (req, res) => {
  try {
    const { email, password, jobId } = req.body;
    
    if (!email || !password || !jobId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Verify job exists and belongs to this email
    const job = await getJobById(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    if (job.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    
    // Create the user with password
    const userData = await createUserWithPassword(email, password, {
      name: job.name || email.split('@')[0],
      source: 'agent_smith'
    });
    
    res.status(200).json({ success: true, user: userData.user });
    
  } catch (error) {
    console.error('[AUTH] Password creation error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### Step 5: Update Server.js with New Routes

Update `server.js` to include the new routes:

```javascript
// Add the new auth routes
const createPasswordRoute = require('./src/routes/auth/create-password');
app.use('/api/auth', createPasswordRoute);

// Add route for password creation page
app.get('/create-password', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'create-password.html'));
});
```

### Step 6: Create a Simplified Auth Client

Create a new file `public/js/auth.js` to replace complex auth handling:

```javascript
/**
 * Simplified Authentication Utilities for Agent Smith
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
```

## Cleanup Plan

After implementing the new authentication flow, we should remove or refactor these files:

1. `src/auth/magicLinkGenerator.js` (REMOVE)
2. `api/auth/callback.js` (REMOVE)
3. `public/js/auth-handler.js` (REMOVE)
4. Simplify `public/js/supabase-client.js` to remove magic link handling

## Migration Strategy

1. Implement the new system alongside the existing one
2. Test thoroughly with new users
3. Remove deprecated code once the new system is verified

## Conclusion

This refactoring will significantly simplify the authentication flow in Agent Smith, making it more reliable and easier to maintain. By switching from magic links to password-based authentication, we eliminate the complex token handling and redirect chains that have caused persistent issues.
