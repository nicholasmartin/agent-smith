const { OpenAI } = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate personalized email using OpenAI
 * @param {string} name - Recipient's name
 * @param {string} email - Recipient's email
 * @param {string} domain - Company domain
 * @param {Object} websiteData - Scraped website data
 * @returns {Object} Generated email with subject and body
 */
async function generateEmail(name, email, domain, websiteData) {
  try {
    const prompt = createPrompt(name, email, domain, websiteData);
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Using GPT-3.5 Turbo as a replacement for GPT-4 Mini
      messages: [
        {
          role: "system",
          content: "You are an AI assistant that helps create personalized email drafts for new free trial users based on their company information."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    });
    
    // Parse the response to extract subject and body
    const content = response.choices[0].message.content.trim();
    
    // Attempt to parse if JSON format was followed
    try {
      return JSON.parse(content);
    } catch (e) {
      // If not in JSON format, do simple parsing based on Subject/Body markers
      const subjectMatch = content.match(/Subject:(.*?)(\n|$)/i);
      const subject = subjectMatch ? subjectMatch[1].trim() : `Welcome to our product, ${name}!`;
      
      // Everything after "Body:" or the entire content if no markers
      const bodyMatch = content.match(/Body:(.*)/is);
      const body = bodyMatch ? bodyMatch[1].trim() : content;
      
      return { subject, body };
    }
  } catch (error) {
    console.error('Error generating email:', error);
    
    // Fallback email if AI generation fails
    return {
      subject: `Welcome to our product, ${name}!`,
      body: `Hi ${name},\n\nThank you for signing up for our free trial. I noticed you're from ${websiteData.companyName || domain}.\n\nI'd love to learn more about your needs and show you how our product can help your business. Would you be available for a quick call this week?\n\nBest regards,\nThe Team`
    };
  }
}

/**
 * Create prompt for OpenAI based on website data
 */
function createPrompt(name, email, domain, websiteData) {
  return `
Create a personalized email for a new free trial signup with the following information:

Name: ${name}
Email: ${email}
Company domain: ${domain}
Company name: ${websiteData.companyName || domain}

Website summary: ${websiteData.summary || 'Not available'}

Website content: ${websiteData.pageText ? websiteData.pageText.substring(0, 1000) + '...' : 'Not available'}

Services offered: ${websiteData.services && websiteData.services.length > 0 ? websiteData.services.join(', ') : 'Not specified'}

Instructions:
1. Write a brief, personalized email welcoming them to the free trial
2. Reference their company name and business
3. Mention how our product might help their specific needs based on their website
4. Keep in mind that our company (MagLoft) specializes in software solutions for print and digital publishers. We provide complete solutions for pdf to html conversions, mobile app and web app solutions, custom development and integration services.
5. Keep it under 200 words and conversational in tone
6. Include a question for the new free trial at the end to try and get a reply.

Format your response as a JSON object with 'subject' and 'body' fields.
`;
}

module.exports = {
  generateEmail
};
