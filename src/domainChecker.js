// List of common free email providers
const FREE_EMAIL_DOMAINS = [
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'protonmail.com', 'icloud.com', 'mail.com', 'zoho.com', 'yandex.com',
  'gmx.com', 'live.com', 'msn.com', 'me.com', 'inbox.com',
  'fastmail.com', 'tutanota.com'
];

/**
 * Check if the email belongs to a free email provider
 * @param {string} email - Email address to check
 * @returns {Object} Result with domain information
 */
function checkDomain(email) {
  if (!email || !email.includes('@')) {
    throw new Error('Invalid email format');
  }
  
  const domain = email.split('@')[1].toLowerCase();
  const isDomainFree = FREE_EMAIL_DOMAINS.includes(domain);
  
  return {
    isDomainFree,
    domain,
    emailAddress: email
  };
}

module.exports = {
  checkDomain,
  FREE_EMAIL_DOMAINS
};
