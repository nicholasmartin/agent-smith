# Supabase Authentication Setup

This document outlines the configuration steps for setting up Supabase Authentication with magic link emails and password management.

## 1. Supabase Project Configuration

### Authentication Settings

1. In the Supabase dashboard, navigate to **Authentication > Settings**
2. Configure the following settings:

```
Site URL: https://agent-smith.magloft.com (match your SITE_URL env variable)
Redirect URLs: https://agent-smith.magloft.com/auth/callback
```

3. Under **Email Auth**:
   - Enable **Email Signup**
   - Enable **Email Confirm**
   - Set **Secure Email Change** to ON
   - Set **Custom SMTP** configuration to use Mailtrap

### Configure Email Templates

1. Navigate to **Authentication > Email Templates**
2. Select the **Magic Link** template
3. Configure the email hook URL to point to your Supabase Edge Function:

```
Hook URL: https://jnpdszffuosiirapfvwp.functions.supabase.co/send-email-hook
```

4. Add a shared secret in the **Email Hooks** section:

```
SEND_EMAIL_HOOK_SECRET: your_secure_random_string
```

5. Update this same secret in your edge function environment variables

## 2. Edge Function Deployment

The edge function for intercepting magic link emails has already been implemented. Deploy it to Supabase:

```bash
# Navigate to the function directory
cd supabase/functions/send-email-hook

# Deploy the function
supabase functions deploy send-email-hook --project-ref jnpdszffuosiirapfvwp
```

### Configure Edge Function Environment Variables

Set the required environment variables for the edge function:

```bash
supabase secrets set MAILTRAP_API_TOKEN="your_mailtrap_token" --project-ref jnpdszffuosiirapfvwp
supabase secrets set MAILTRAP_SENDER_EMAIL="agent.smith@example.com" --project-ref jnpdszffuosiirapfvwp
supabase secrets set SEND_EMAIL_HOOK_SECRET="your_secure_random_string" --project-ref jnpdszffuosiirapfvwp
```

## 3. Password Setting Modal

Create a password setting component for the dashboard that appears when a user first authenticates but hasn't set a password.

### Frontend Implementation

Create a new file `public/js/auth-handler.js`:

```javascript
/**
 * Auth Handler for Agent Smith Dashboard
 * Manages authentication state and password setting
 */

// Password setting modal handler
function setupPasswordModal() {
  const modal = document.getElementById('password-modal');
  const form = document.getElementById('password-form');
  const statusEl = document.getElementById('password-status');
  
  if (!modal || !form) return;
  
  // Check if user needs to set password
  checkPasswordRequirement();
  
  // Handle form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const password = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    // Clear previous status
    statusEl.textContent = '';
    statusEl.className = '';
    
    // Basic validation
    if (password.length < 8) {
      statusEl.textContent = 'Password must be at least 8 characters';
      statusEl.className = 'error';
      return;
    }
    
    if (password !== confirmPassword) {
      statusEl.textContent = 'Passwords do not match';
      statusEl.className = 'error';
      return;
    }
    
    try {
      // Update password via Supabase
      const { error } = await window.supabase.auth.updateUser({
        password: password
      });
      
      if (error) throw error;
      
      // Update user profile
      const { error: profileError } = await window.supabase
        .from('profiles')
        .update({ account_completed: true })
        .eq('id', window.supabase.auth.user().id);
      
      // Show success and close modal
      statusEl.textContent = 'Password set successfully!';
      statusEl.className = 'success';
      
      // Close modal after delay
      setTimeout(() => {
        closeModal();
      }, 1500);
      
    } catch (error) {
      console.error('Error setting password:', error);
      statusEl.textContent = error.message || 'Error setting password';
      statusEl.className = 'error';
    }
  });
  
  // Helper functions
  function showModal() {
    modal.style.display = 'flex';
  }
  
  function closeModal() {
    modal.style.display = 'none';
  }
  
  // Check if user needs to set password
  async function checkPasswordRequirement() {
    try {
      const { data: profile, error } = await window.supabase
        .from('profiles')
        .select('account_completed')
        .eq('id', window.supabase.auth.user().id)
        .single();
      
      if (error) throw error;
      
      // If account is not completed, show password modal
      if (!profile.account_completed) {
        showModal();
      }
    } catch (error) {
      console.error('Error checking profile:', error);
    }
  }
}

// Initialize auth state
async function initializeAuth() {
  // Get Supabase client from global scope
  const supabase = window.supabase;
  if (!supabase) {
    console.error('Supabase client not available');
    return;
  }
  
  // Listen for auth state changes
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      console.log('User signed in');
      // Initialize the dashboard with authenticated user
      setupPasswordModal();
      updateUserInfo();
    } else if (event === 'SIGNED_OUT') {
      console.log('User signed out');
      // Redirect to login page
      window.location.href = '/login.html';
    }
  });
  
  // Update UI with user info
  function updateUserInfo() {
    const user = supabase.auth.user();
    if (!user) return;
    
    // Update user display elements
    const userNameElements = document.querySelectorAll('.user-name');
    const userEmailElements = document.querySelectorAll('.user-email');
    
    userNameElements.forEach(el => {
      el.textContent = user.user_metadata?.name || 'User';
    });
    
    userEmailElements.forEach(el => {
      el.textContent = user.email;
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeAuth();
});
```

## 4. Authentication Redirection

Create a script to handle authentication redirects in `public/js/supabase-client.js`:

```javascript
/**
 * Supabase Client for Agent Smith
 * Initialize Supabase client for browser usage
 */

/**
 * Supabase Client for Agent Smith
 * Initialize Supabase client for browser usage
 */

// Initialize Supabase client using environment variables passed to the frontend
// These are public keys, but still better to use a configuration approach
const supabaseUrl = window.AGENT_SMITH_CONFIG?.supabaseUrl || '';
const supabaseAnonKey = window.AGENT_SMITH_CONFIG?.supabaseAnonKey || '';

// Create client
window.supabase = supabase.createClient(supabaseUrl, supabaseAnonKey);

// Re// Serve the configuration variables as a JavaScript module
app.get('/js/config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  
  // Generate a CSRF token
  const csrfToken = crypto.randomBytes(16).toString('hex');
  
  // Send configuration as JavaScript
  res.send(`
    window.AGENT_SMITH_CONFIG = {
      websiteFormSecret: "${process.env.WEBSITE_FORM_SECRET}",
      csrfToken: "${csrfToken}",
      supabaseUrl: "${process.env.NEXT_PUBLIC_SUPABASE_URL}",
      supabaseAnonKey: "${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}"
    };
  `);
});direct handling
async function handleAuthRedirect() {
  // Check if we're in a redirect
  const hash = window.location.hash;
  
  if (hash && hash.includes('access_token')) {
    // We're in a redirect from magic link
    try {
      // Process the hash (Supabase will handle this)
      const { error } = await window.supabase.auth.getUser();
      
      if (error) throw error;
      
      // Redirect to dashboard
      window.location.href = '/dashboard.html';
    } catch (error) {
      console.error('Auth redirect error:', error);
      displayAuthError(error.message);
    }
  }
}

// Display auth error message
function displayAuthError(message) {
  const errorContainer = document.getElementById('auth-error');
  if (errorContainer) {
    errorContainer.textContent = message;
    errorContainer.style.display = 'block';
  }
}

// Handle redirects on page load
document.addEventListener('DOMContentLoaded', () => {
  handleAuthRedirect();
});
```

## 5. Login Page

Create a login page for returning users in `public/login.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login | Agent Smith</title>
    <link rel="icon" href="images/favicon.png" type="image/png">
    <link rel="stylesheet" href="css/main.css">
    <link rel="stylesheet" href="css/form-handlers.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://kit.fontawesome.com/3b49ef8fb1.js" crossorigin="anonymous"></script>
    <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
    <script src="/js/supabase-client.js"></script>
</head>
<body>
    <header>
        <div class="header-container container">
            <div class="logo">
                <span class="logo-text">Agent<span class="highlight">Smith</span></span>
            </div>
            <div class="nav-links">
                <a href="index.html">Home</a>
                <a href="login.html" class="active">Login</a>
            </div>
        </div>
    </header>

    <section class="auth-container">
        <div class="container">
            <div class="auth-form-wrapper">
                <h1>Welcome Back</h1>
                <p>Sign in to access your Agent Smith dashboard</p>
                
                <div id="auth-error" class="error-message" style="display: none;"></div>
                
                <form id="login-form" class="auth-form">
                    <div class="form-row">
                        <label for="email">Email Address</label>
                        <input type="email" id="email" name="email" required>
                    </div>
                    <div class="form-row">
                        <label for="password">Password</label>
                        <input type="password" id="password" name="password" required>
                    </div>
                    <div class="form-row">
                        <button type="submit" class="button primary">Sign In</button>
                    </div>
                    <div class="form-divider">
                        <span>OR</span>
                    </div>
                    <div class="form-row">
                        <button type="button" id="magic-link-btn" class="button secondary">Send Magic Link</button>
                    </div>
                </form>
                
                <div id="magic-link-form" class="auth-form" style="display: none;">
                    <div class="form-row">
                        <label for="magic-email">Email Address</label>
                        <input type="email" id="magic-email" name="magic-email" required>
                    </div>
                    <div class="form-row">
                        <button type="button" id="send-magic-link" class="button primary">Send Magic Link</button>
                    </div>
                    <div class="form-row">
                        <button type="button" id="back-to-login" class="button text">Back to Login</button>
                    </div>
                </div>
                
                <div id="magic-link-success" style="display: none;">
                    <div class="success-message">
                        <i class="fas fa-check-circle"></i>
                        <h3>Magic Link Sent!</h3>
                        <p>Check your email for a sign in link. It will expire in 24 hours.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <script>
    document.addEventListener('DOMContentLoaded', () => {
        const loginForm = document.getElementById('login-form');
        const magicLinkBtn = document.getElementById('magic-link-btn');
        const magicLinkForm = document.getElementById('magic-link-form');
        const sendMagicLink = document.getElementById('send-magic-link');
        const backToLogin = document.getElementById('back-to-login');
        const magicLinkSuccess = document.getElementById('magic-link-success');
        const errorContainer = document.getElementById('auth-error');
        
        // Handle standard login
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                errorContainer.style.display = 'none';
                
                const { error } = await window.supabase.auth.signInWithPassword({
                    email,
                    password
                });
                
                if (error) throw error;
                
                // Redirect to dashboard on success
                window.location.href = '/dashboard.html';
            } catch (error) {
                console.error('Login error:', error);
                errorContainer.textContent = error.message;
                errorContainer.style.display = 'block';
            }
        });
        
        // Show magic link form
        magicLinkBtn.addEventListener('click', () => {
            loginForm.style.display = 'none';
            magicLinkForm.style.display = 'block';
        });
        
        // Back to login
        backToLogin.addEventListener('click', () => {
            loginForm.style.display = 'block';
            magicLinkForm.style.display = 'none';
        });
        
        // Send magic link
        sendMagicLink.addEventListener('click', async () => {
            const email = document.getElementById('magic-email').value;
            
            if (!email) {
                errorContainer.textContent = 'Please enter your email address';
                errorContainer.style.display = 'block';
                return;
            }
            
            try {
                errorContainer.style.display = 'none';
                
                const { error } = await window.supabase.auth.signInWithOtp({
                    email,
                    options: {
                        redirectTo: `${window.location.origin}/auth/callback`
                    }
                });
                
                if (error) throw error;
                
                // Show success message
                magicLinkForm.style.display = 'none';
                magicLinkSuccess.style.display = 'block';
            } catch (error) {
                console.error('Magic link error:', error);
                errorContainer.textContent = error.message;
                errorContainer.style.display = 'block';
            }
        });
    });
    </script>
</body>
</html>
```

## Next Steps

After implementing the authentication setup, proceed to the [User Interface](./04-user-interface.md) document to implement the dashboard.
