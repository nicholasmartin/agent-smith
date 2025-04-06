/**
 * Company Manager Module for Agent Smith
 * Handles company and prompt template retrieval from Supabase
 */
const supabase = require('./supabaseClient');

/**
 * Get company by API key
 * @param {string} apiKey - Company API key
 * @returns {Object} Company information
 */
async function getCompanyByApiKey(apiKey) {
  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('api_key', apiKey)
    .eq('active', true)
    .single();
  
  if (error) {
    throw new Error(`Error fetching company: ${error.message}`);
  }
  
  return data;
}

/**
 * Get active prompt template for company
 * @param {string} companyId - UUID of the company
 * @returns {Object} Prompt template information
 */
async function getCompanyPromptTemplate(companyId) {
  const { data, error } = await supabase
    .from('prompt_templates')
    .select('*')
    .eq('company_id', companyId)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (error) {
    throw new Error(`Error fetching prompt template: ${error.message}`);
  }
  
  return data;
}

module.exports = {
  getCompanyByApiKey,
  getCompanyPromptTemplate
};
