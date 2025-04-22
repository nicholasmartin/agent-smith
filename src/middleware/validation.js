/**
 * Validation Middleware for Agent Smith
 * 
 * This module contains middleware functions for validating API keys and website secrets.
 */

const keyManager = require('../keyManager');

/**
 * Website form secret validation middleware
 * Validates the X-Website-Secret header against the expected secret
 */
const validateWebsiteSecret = (req, res, next) => {
  const websiteSecret = req.headers['x-website-secret'];
  const expectedSecret = process.env.WEBSITE_FORM_SECRET;
  
  if (!websiteSecret || websiteSecret !== expectedSecret) {
    return res.status(403).json({ error: 'Invalid website form secret' });
  }
  
  next();
};

/**
 * API key validation middleware
 * Validates the X-API-Key header against the master API key or the key manager
 */
const validateApiKey = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const masterApiKey = process.env.API_KEY;
  const endpoint = req.path.split('/')[1]; // Extract endpoint from path
  
  // First check if it matches the master API key from environment variables (for backward compatibility during transition)
  if (apiKey && apiKey === masterApiKey) {
    // Admin key has full access
    req.company = {
      id: null,
      name: 'System Administrator',
      slug: 'admin'
    };
    next();
    return;
  }
  
  // Check if it's a valid secure API key in the new system
  try {
    if (apiKey) {
      // Use keyManager to validate the API key
      const apiInfo = await keyManager.validateApiKey(apiKey, endpoint);
      
      if (apiInfo) {
        // Valid API key
        console.log(`Request authenticated for company: ${apiInfo.companyName}`);
        
        // Add company info to request for downstream use
        req.company = {
          id: apiInfo.companyId,
          name: apiInfo.companyName,
          slug: apiInfo.companySlug,
          keyId: apiInfo.keyId
        };
        
        next();
        return;
      }
    }
    
    // If we get here, the API key is invalid
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  } catch (error) {
    console.error('Error validating API key:', error);
    return res.status(500).json({ error: 'Error validating API key' });
  }
};

module.exports = { validateWebsiteSecret, validateApiKey };
