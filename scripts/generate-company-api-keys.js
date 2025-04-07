/**
 * Utility script to generate API keys for all active companies
 * 
 * Usage:
 * node scripts/generate-company-api-keys.js
 * 
 * This will:
 * 1. Find all active companies
 * 2. Generate a new API key for each
 * 3. Update the company with the default_api_key_id
 * 4. Save the keys to api_keys.csv for distribution
 */

require('dotenv').config();
const fs = require('fs');
const supabase = require('../src/supabaseClient');
const keyManager = require('../src/keyManager');

async function generateKeysForAllCompanies() {
  try {
    // Get all active companies
    console.log('Retrieving active companies...');
    const { data: companies, error } = await supabase
      .from('companies')
      .select('id, name, slug')
      .eq('active', true);
    
    if (error) throw error;
    
    console.log(`Generating keys for ${companies.length} companies...`);
    
    const results = [];
    
    for (const company of companies) {
      console.log(`Processing: ${company.name}`);
      
      // Create a new API key
      const keyInfo = await keyManager.createApiKey(
        company.id,
        "Primary API Key",
        "Generated during system migration",
        ['*']  // All permissions
      );
      
      // Update company with default key ID
      await supabase
        .from('companies')
        .update({ default_api_key_id: keyInfo.id })
        .eq('id', company.id);
      
      // Store the full key for output
      results.push({
        company_id: company.id,
        company_name: company.name,
        company_slug: company.slug,
        api_key_id: keyInfo.id,
        api_key: keyInfo.fullKey,
        created_at: new Date().toISOString()
      });
      
      console.log(`✓ Generated key for ${company.name}`);
    }
    
    // Write results to CSV
    const csv = [
      'Company ID,Company Name,Company Slug,API Key ID,API Key,Created At',
      ...results.map(r => `"${r.company_id}","${r.company_name}","${r.company_slug}","${r.api_key_id}","${r.api_key}","${r.created_at}"`)
    ].join('\n');
    
    fs.writeFileSync('api_keys.csv', csv);
    console.log(`\nSuccess! Generated ${results.length} API keys`);
    console.log('Keys saved to api_keys.csv');
    
  } catch (error) {
    console.error('Error generating keys:', error);
    process.exit(1);
  }
}

// Run the migration
generateKeysForAllCompanies();
