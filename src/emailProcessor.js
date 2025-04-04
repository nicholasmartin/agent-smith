const domainChecker = require('./domainChecker');
const webScraper = require('./webScraper');
const emailGenerator = require('./emailGenerator');
const slackNotifier = require('./slackNotifier');

/**
 * Process a new signup by checking the domain, scraping the website,
 * generating a personalized email, and sending it to Slack
 */
async function processSignup(email, name) {
  try {
    // Step 1: Check if it's a business domain
    const { isDomainFree, domain } = domainChecker.checkDomain(email);
    
    // If it's a free email provider, ignore and return
    if (isDomainFree) {
      console.log(`Skipping free email provider: ${email}`);
      return { status: 'skipped', reason: 'free email provider' };
    }
    
    // Step 2: Scrape the website
    console.log(`Scraping website for domain: ${domain}`);
    const websiteData = await webScraper.scrapeWebsite(domain);
    
    // Step 3: Generate personalized email
    console.log(`Generating email for: ${name} at ${domain}`);
    const emailDraft = await emailGenerator.generateEmail(name, email, domain, websiteData);
    
    // Step 4: Send to Slack
    console.log(`Sending notification to Slack for: ${email}`);
    await slackNotifier.sendToSlack(name, email, domain, emailDraft, websiteData);
    
    return {
      status: 'processed',
      email,
      domain,
      emailDraft
    };
  } catch (error) {
    console.error(`Error processing signup for ${email}:`, error);
    throw error;
  }
}

module.exports = {
  processSignup
};
