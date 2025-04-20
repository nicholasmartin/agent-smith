/**
 * Sentry Browser SDK initialization
 * This file sets up error tracking and performance monitoring for the client-side
 */

// Initialize Sentry
(function() {
  // Load Sentry from CDN
  const script = document.createElement('script');
  script.src = 'https://browser.sentry-cdn.com/7.64.0/bundle.min.js';
  script.crossOrigin = 'anonymous';
  script.integrity = 'sha384-VUqjZblCwQwpgE0LBfQRvdzZNVL1+0gP6LiQzKN1lxdWbmR6HJQz6t9PL2eMzK7';
  
  script.onload = function() {
    // Initialize Sentry after the script is loaded
    Sentry.init({
      dsn: "https://4fe1c5d44ea42012e0459f20f41949d7@o4509169229168640.ingest.us.sentry.io/4509169236770816",
      integrations: [
        new Sentry.BrowserTracing(),
      ],
      // Performance monitoring
      tracesSampleRate: 1.0,
      // Session replay for debugging UI issues
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      
      // Add useful context information
      beforeSend(event) {
        // Add URL and auth state information
        event.tags = event.tags || {};
        event.tags.url = window.location.href;
        event.tags.hasHash = window.location.hash ? 'yes' : 'no';
        
        // Try to determine auth state
        try {
          if (window.supabase) {
            window.supabase.auth.getSession().then(({ data }) => {
              event.tags.authenticated = data.session ? 'yes' : 'no';
            }).catch(() => {
              event.tags.authenticated = 'error-checking';
            });
          } else {
            event.tags.authenticated = 'no-supabase';
          }
        } catch (e) {
          event.tags.authenticated = 'error';
        }
        
        return event;
      }
    });
    
    // Add authentication state tracking
    if (window.supabase) {
      window.supabase.auth.onAuthStateChange((event, session) => {
        Sentry.setTag('authEvent', event);
        Sentry.setTag('hasSession', !!session);
        
        if (session && session.user) {
          Sentry.setUser({
            id: session.user.id,
            email: session.user.email
          });
        } else {
          Sentry.setUser(null);
        }
      });
    }
    
    // Special tracking for authentication issues
    const originalReplaceState = history.replaceState;
    history.replaceState = function() {
      // Capture when URL hash is being cleaned
      if (arguments[2] && window.location.hash && !arguments[2].includes('#')) {
        Sentry.addBreadcrumb({
          category: 'auth',
          message: 'URL hash cleaned',
          data: {
            from: window.location.href,
            to: arguments[2]
          },
          level: 'info'
        });
      }
      return originalReplaceState.apply(this, arguments);
    };
    
    console.log('Sentry Browser SDK initialized');
  };
  
  document.head.appendChild(script);
})();

// Helper function to capture auth-related errors
window.captureAuthError = function(message, data) {
  if (window.Sentry) {
    Sentry.captureMessage(`Auth Error: ${message}`, {
      level: 'error',
      extra: data
    });
  }
  console.error('Auth Error:', message, data);
};
