const axios = require('axios');

/**
 * Send email draft to Slack channel
 * @param {string} name - User name
 * @param {string} email - User email
 * @param {string} domain - Company domain
 * @param {Object} emailDraft - Generated email draft
 * @param {Object} websiteData - Scraped website data
 */
async function sendToSlack(name, email, domain, emailDraft, websiteData) {
  try {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    if (!slackWebhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }
    
    // Create message payload for Slack
    const message = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🎉 New Personalized Email Draft",
            emoji: true
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Name:* ${name}`
            },
            {
              type: "mrkdwn",
              text: `*Email:* ${email}`
            },
            {
              type: "mrkdwn",
              text: `*Company:* ${websiteData.companyName || domain}`
            }
          ]
        },
        {
          type: "divider"
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Subject:* ${emailDraft.subject}`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Body:*\n\`\`\`${emailDraft.body}\`\`\``
          }
        }
      ]
    };
    
    // Send to Slack
    await axios.post(slackWebhookUrl, message);
    
    return { success: true };
  } catch (error) {
    console.error('Error sending to Slack:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send scraping failure notification to Slack
 * @param {string} domain - Domain that failed to scrape
 * @param {string} errorMessage - Error message from the scraping attempt
 */
async function sendScrapingFailureToSlack(domain, errorMessage) {
  try {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    if (!slackWebhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }
    
    // Create message payload for Slack
    const message = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "⚠️ Web Scraping Failure",
            emoji: true
          }
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Domain:* ${domain}`
            },
            {
              type: "mrkdwn",
              text: `*Error:* ${errorMessage}`
            }
          ]
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "The system failed to scrape this website. A fallback company name will be used for email generation."
          }
        }
      ]
    };
    
    // Send to Slack
    await axios.post(slackWebhookUrl, message);
    
    return { success: true };
  } catch (error) {
    console.error('Error sending scraping failure to Slack:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generic function to send any message to Slack
 * @param {Object} message - Slack message payload
 */
async function sendGenericMessageToSlack(message) {
  try {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    
    if (!slackWebhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }
    
    // Send to Slack
    await axios.post(slackWebhookUrl, message);
    
    return { success: true };
  } catch (error) {
    console.error('Error sending message to Slack:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendToSlack,
  sendScrapingFailureToSlack,
  sendGenericMessageToSlack
};
