const { OpenAI } = require('openai');
const { getCompanyByApiKey, getCompanyPromptTemplate } = require('./companyManager');
const supabase = require('./supabaseClient');

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
 * @param {string} apiKey - Optional company API key for multi-tenant support
 * @param {string} companyId - Optional company ID for direct company lookup
 * @returns {Object} Generated email with subject and body
 */
async function generateEmail(name, email, domain, websiteData, apiKey = null, companyId = null) {
  try {
    console.log(`[EmailGenerator] Generating email with API key: ${apiKey}`);
    
    // Default company info (fallback for backward compatibility)
    let companyInfo = {
      name: 'MagLoft',
      description: 'MagLoft specializes in software solutions for print and digital publishers. We provide complete solutions for pdf to html conversions, mobile app and web app solutions, custom development and integration services.'
    };
    
    console.log(`[EmailGenerator] Default company info set to: ${companyInfo.name}`);
    
    let promptSettings = {
      tone: 'conversational',
      style: 'formal',
      maxLength: 200
    };

    // Determine company info - first try direct company ID (preferred), then fallback to API key
    let company = null;
    let promptTemplate = null;
    
    if (companyId) {
      console.log(`[EmailGenerator] Looking up company by ID: ${companyId}`);
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .eq('id', companyId)
          .single();
        
        if (error) throw error;
        company = data;
        console.log(`[EmailGenerator] Found company by ID: ${company ? company.name : 'Not found'}`);
      } catch (error) {
        console.error(`[EmailGenerator] Error looking up company by ID:`, error);
      }
    } else if (apiKey) {
      console.log(`[EmailGenerator] Looking up company by API key: ${apiKey}`);
      try {
        company = await getCompanyByApiKey(apiKey);
        console.log(`[EmailGenerator] Found company by API key: ${company ? company.name : 'Not found'}`);
      } catch (error) {
        console.error(`[EmailGenerator] Error looking up company by API key:`, error);
      }
    }
    
    // If we found a company, get its prompt template and update our settings
    if (company && company.id) {
      try {
        promptTemplate = await getCompanyPromptTemplate(company.id);
        console.log(`[EmailGenerator] Found template: ${promptTemplate ? promptTemplate.name : 'Not found'}`);
        
        companyInfo = {
          name: company.name,
          description: company.description || companyInfo.description
        };
        console.log(`[EmailGenerator] Updated company info to: ${companyInfo.name}`);
        
        promptSettings = {
          tone: promptTemplate.tone || promptSettings.tone,
          style: promptTemplate.style || promptSettings.style,
          maxLength: promptTemplate.max_length || promptSettings.maxLength,
          template: promptTemplate.template
        };
        console.log(`[EmailGenerator] Using custom template: ${promptSettings.template ? 'Yes' : 'No'}`);
        console.log(`[EmailGenerator] Template settings - Tone: ${promptSettings.tone}, Style: ${promptSettings.style}`);
        console.log(`[EmailGenerator] Template max length: ${promptSettings.maxLength}`);
      } catch (error) {
        console.error('Error fetching company information:', error);
        console.log(`[EmailGenerator] Error details: ${JSON.stringify(error.message || error)}`);
        console.log(`[EmailGenerator] Falling back to default company info`);
        // Fall back to default if company lookup fails
      }
    }

    // Use company-specific template if available, otherwise use default template
    const useCustomTemplate = !!promptSettings.template;
    console.log(`[EmailGenerator] Using ${useCustomTemplate ? 'custom' : 'default'} template`);
    
    const prompt = useCustomTemplate
      ? processCustomTemplate(promptSettings.template, name, email, domain, websiteData, companyInfo, promptSettings)
      : createDefaultPrompt(name, email, domain, websiteData, companyInfo, promptSettings);
    
    console.log(`[EmailGenerator] Final company name in prompt: ${companyInfo.name}`);
    
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
      const subject = subjectMatch ? subjectMatch[1].trim() : `Welcome to ${companyInfo.name}, ${name}!`;
      
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
 * Process custom prompt template with variables
 */
function processCustomTemplate(template, name, email, domain, websiteData, companyInfo, promptSettings) {
  // Replace template variables with actual values
  let processedTemplate = template
    .replace(/\${name}/g, name)
    .replace(/\${email}/g, email)
    .replace(/\${domain}/g, domain)
    .replace(/\${companyName}/g, websiteData.companyName || domain)
    .replace(/\${websiteSummary}/g, websiteData.summary || 'Not available')
    .replace(/\${websiteContent}/g, websiteData.pageText ? websiteData.pageText.substring(0, 1000) + '...' : 'Not available')
    .replace(/\${services}/g, websiteData.services && websiteData.services.length > 0 ? websiteData.services.join(', ') : 'Not specified')
    .replace(/\${ourCompanyName}/g, companyInfo.name)
    .replace(/\${ourCompanyDescription}/g, companyInfo.description)
    .replace(/\${tone}/g, promptSettings.tone)
    .replace(/\${style}/g, promptSettings.style)
    .replace(/\${maxLength}/g, promptSettings.maxLength);
  
  // Add HTML formatting instructions if not already present in the template
  if (!processedTemplate.includes('HTML') && !processedTemplate.includes('<p>')) {
    processedTemplate += `

Additional formatting instructions:
1. Format the body content as properly structured HTML paragraphs using <p> tags
2. Do NOT include any <html>, <head>, <body> or other document structure tags
3. Only use basic HTML formatting like <p>, <br>, <strong>, <em> tags
4. Keep paragraphs short (2-3 sentences maximum) for better readability
5. Avoid large blocks of text that might get trimmed in email clients
6. Add a greeting at the beginning (e.g., "Hi [name],")
7. The 'body' field in your JSON response should contain the HTML-formatted paragraphs`;
  }
  
  return processedTemplate;
}

/**
 * Create default prompt for OpenAI based on website data
 */
function createDefaultPrompt(name, email, domain, websiteData, companyInfo, promptSettings) {
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
4. Keep in mind that our company (${companyInfo.name}) ${companyInfo.description}
5. Keep it under ${promptSettings.maxLength} words and ${promptSettings.tone} in tone
6. Use a ${promptSettings.style} style
7. Include a question for the new free trial at the end to try and get a reply.
8. Format the body content as properly structured HTML paragraphs using <p> tags
9. Do NOT include any <html>, <head>, <body> or other document structure tags
10. Only use basic HTML formatting like <p>, <br>, <strong>, <em> tags
11. Keep paragraphs short (2-3 sentences maximum) for better readability
12. Avoid large blocks of text that might get trimmed in email clients
13. Add a greeting at the beginning (e.g., "Hi [name],")

Format your response as a JSON object with 'subject' and 'body' fields. The 'body' field should contain the HTML-formatted paragraphs.
`;
}

module.exports = {
  generateEmail
};
