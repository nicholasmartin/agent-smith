// Form configuration endpoint for Agent Smith
// This provides necessary security tokens for form submissions

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
module.exports = (req, res) => {
  try {
    // Generate a random token for CSRF protection
    const csrfToken = Math.random().toString(36).substring(2, 15) + 
                      Math.random().toString(36).substring(2, 15);
    
    // Get the website form secret from environment variable or use a default for dev
    const websiteFormSecret = process.env.WEBSITE_FORM_SECRET || 'local-dev-form-secret';
    
    // Return configuration values
    res.status(200).json({
      websiteFormSecret,
      csrfToken
    });
  } catch (error) {
    console.error('Error generating form configuration:', error);
    res.status(500).json({ error: 'Failed to generate form configuration' });
  }
};
