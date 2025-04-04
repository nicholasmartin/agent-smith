require('dotenv').config();
const express = require('express');
const emailProcessor = require('./src/emailProcessor');

const app = express();
app.use(express.json());

// API key validation middleware
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.API_KEY;
  
  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }
  
  next();
};

// Health check endpoint
app.get('/', (req, res) => {
  res.send('Agent Smith API is running');
});

// Main API endpoint with API key validation
app.post('/api/process-signup', validateApiKey, async (req, res) => {
  try {
    const { email, name } = req.body;
    
    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required' });
    }
    
    // Process the signup asynchronously
    emailProcessor.processSignup(email, name)
      .then(() => console.log(`Processing completed for ${email}`))
      .catch(err => console.error(`Error processing ${email}:`, err));
    
    // Return immediately to the client
    return res.status(202).json({ 
      message: 'Signup received and being processed',
      email,
      name
    });
  } catch (error) {
    console.error('API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Only start the server if this file is run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
