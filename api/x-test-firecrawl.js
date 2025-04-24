// Test endpoint for Firecrawl SDK extraction
const { FireCrawl } = require('@mendable/firecrawl-js');
const { z } = require('zod');

module.exports = async (req, res) => {
  console.log('Starting Firecrawl SDK test...');
  
  try {
    // Initialize FireCrawl SDK with API key
    console.log('Initializing FireCrawl SDK...');
    const app = new FireCrawl(process.env.FIRECRAWL_API_KEY);
    console.log('FireCrawl SDK initialized');
    
    // Define a simple schema for extraction
    const schema = z.object({
      title: z.string()
    });
    
    // Test domain
    const testDomain = 'example.com';
    console.log(`Testing extraction for domain: ${testDomain}`);
    
    // Log the API key length for debugging
    console.log('API Key length:', process.env.FIRECRAWL_API_KEY ? process.env.FIRECRAWL_API_KEY.length : 'API key not found');
    
    // Attempt a simple extraction
    console.log('Starting simple extraction...');
    try {
      const extractJob = await app.asyncExtract(
        [`https://${testDomain}/`],
        {
          prompt: "Extract the title of the webpage",
          schema
        }
      );
      
      console.log('Extract job response:', extractJob);
      
      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Firecrawl SDK extraction test successful',
        extractJob
      });
    } catch (extractError) {
      console.error('Error during extraction:', extractError);
      return res.status(500).json({
        success: false,
        message: 'Firecrawl SDK extraction test failed',
        error: {
          name: extractError.name,
          message: extractError.message,
          stack: extractError.stack,
          response: extractError.response ? {
            status: extractError.response.status,
            data: extractError.response.data
          } : null
        }
      });
    }
  } catch (error) {
    console.error('General error in test-firecrawl:', error);
    return res.status(500).json({
      success: false,
      message: 'General error in Firecrawl SDK test',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
  }
};
