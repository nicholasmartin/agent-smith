/**
 * API Key Management System for Agent Smith
 * Handles secure creation, validation, and tracking of API keys
 */
const crypto = require('crypto');
const supabase = require('./supabaseClient');

/**
 * Generate a new API key with the format as_xxxxx-xxxxx-xxxxx-xxxxx
 * @returns {Object} Object containing the generated API key and its prefix
 */
function generateApiKey() {
  const keyBytes = crypto.randomBytes(24);
  const fullKey = 'as_' + keyBytes.toString('hex');
  const keyPrefix = fullKey.substring(0, 10); // Store first 10 chars for reference
  
  return {
    fullKey,
    keyPrefix
  };
}

/**
 * Create a salt and hash for an API key
 * @param {string} apiKey - The raw API key to hash
 * @returns {Object} Object containing the hash and salt
 */
function hashApiKey(apiKey) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256')
    .update(apiKey + salt)
    .digest('hex');
  
  return {
    hash,
    salt
  };
}

/**
 * Create a new API key for a company
 * @param {string} companyId - UUID of the company
 * @param {string} name - Name for this API key
 * @param {string} description - Optional description
 * @param {Array<string>} scopes - Array of allowed endpoint scopes
 * @param {number} expiresInDays - Days until expiration (null for no expiration)
 * @returns {Promise<Object>} Object containing the created API key details
 */
async function createApiKey(companyId, name, description = null, scopes = ['*'], expiresInDays = 365) {
  try {
    // Generate the key
    const { fullKey, keyPrefix } = generateApiKey();
    
    // Create hash and salt
    const { hash, salt } = hashApiKey(fullKey);
    
    // Calculate expiration date
    let expiresAt = null;
    if (expiresInDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }
    
    // Insert into database
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        company_id: companyId,
        key_prefix: keyPrefix,
        key_hash: hash,
        key_salt: salt,
        name,
        description,
        scopes,
        expires_at: expiresAt,
        active: true
      })
      .select()
      .single();
    
    if (error) {
      throw new Error(`Error creating API key: ${error.message}`);
    }
    
    // Return the key details, including the full key which won't be stored in DB
    return {
      id: data.id,
      fullKey,
      keyPrefix,
      name: data.name,
      scopes: data.scopes,
      expiresAt: data.expires_at,
      createdAt: data.created_at
    };
  } catch (error) {
    console.error('Error in createApiKey:', error);
    throw error;
  }
}

/**
 * Validate an API key
 * @param {string} apiKey - The API key to validate
 * @param {string} scope - The requested scope/endpoint
 * @returns {Promise<Object|null>} Company and key info if valid, null if invalid
 */
async function validateApiKey(apiKey, scope = null) {
  try {
    if (!apiKey) return null;
    
    // Extract key prefix (first 10 chars)
    const keyPrefix = apiKey.substring(0, 10);
    
    // Find potential key matches by prefix
    const { data: keyData, error: keyError } = await supabase
      .from('api_keys')
      .select(`
        id,
        key_hash,
        key_salt,
        company_id,
        scopes,
        expires_at,
        active,
        usage_count,
        rate_limit,
        companies(id, name, slug, active)
      `)
      .eq('key_prefix', keyPrefix)
      .eq('active', true);
    
    if (keyError || !keyData || keyData.length === 0) {
      return null;
    }
    
    // Check each potential match
    for (const key of keyData) {
      // Skip if company is inactive
      if (!key.companies?.active) continue;
      
      // Verify hash
      const verifyHash = crypto.createHash('sha256')
        .update(apiKey + key.key_salt)
        .digest('hex');
      
      if (verifyHash === key.key_hash) {
        // Check expiration
        if (key.expires_at && new Date(key.expires_at) < new Date()) {
          console.log(`API key ${key.id} has expired`);
          continue;
        }
        
        // Check scope if provided
        if (scope && !key.scopes.includes('*') && !key.scopes.includes(scope)) {
          console.log(`API key ${key.id} doesn't have required scope: ${scope}`);
          continue;
        }
        
        // Update usage tracking
        await supabase
          .from('api_keys')
          .update({
            last_used_at: new Date(),
            usage_count: key.usage_count + 1
          })
          .eq('id', key.id);
        
        // Return company and key information
        return {
          keyId: key.id,
          companyId: key.company_id,
          companyName: key.companies.name,
          companySlug: key.companies.slug,
          scopes: key.scopes
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error validating API key:', error);
    return null;
  }
}

/**
 * Deactivate an API key
 * @param {string} keyId - UUID of the API key
 * @returns {Promise<boolean>} Success status
 */
async function deactivateApiKey(keyId) {
  try {
    const { error } = await supabase
      .from('api_keys')
      .update({ active: false })
      .eq('id', keyId);
    
    return !error;
  } catch (error) {
    console.error('Error deactivating API key:', error);
    return false;
  }
}

/**
 * Rotate an API key (create new and deactivate old)
 * @param {string} keyId - UUID of the API key to rotate
 * @returns {Promise<Object>} Object containing the new API key details
 */
async function rotateApiKey(keyId) {
  try {
    // Get existing key info
    const { data: oldKey, error: fetchError } = await supabase
      .from('api_keys')
      .select('company_id, name, description, scopes, rate_limit')
      .eq('id', keyId)
      .single();
    
    if (fetchError) {
      throw new Error(`Error fetching API key: ${fetchError.message}`);
    }
    
    // Create a new key with same parameters
    const newKey = await createApiKey(
      oldKey.company_id,
      `${oldKey.name} (rotated)`,
      oldKey.description,
      oldKey.scopes
    );
    
    // Deactivate the old key
    await deactivateApiKey(keyId);
    
    return newKey;
  } catch (error) {
    console.error('Error rotating API key:', error);
    throw error;
  }
}

/**
 * List all active API keys for a company
 * @param {string} companyId - UUID of the company
 * @returns {Promise<Array>} Array of API keys (without sensitive details)
 */
async function listCompanyApiKeys(companyId) {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, key_prefix, name, description, created_at, expires_at, last_used_at, scopes, usage_count, active')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Error listing API keys: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error('Error listing company API keys:', error);
    throw error;
  }
}

/**
 * Get API key details (for admin purposes)
 * @param {string} keyId - UUID of the API key
 * @returns {Promise<Object>} API key details (without sensitive fields)
 */
async function getApiKeyDetails(keyId) {
  try {
    const { data, error } = await supabase
      .from('api_keys')
      .select(`
        id, 
        key_prefix, 
        name, 
        description, 
        created_at, 
        expires_at, 
        last_used_at, 
        scopes, 
        usage_count, 
        active,
        company_id,
        companies(id, name, slug)
      `)
      .eq('id', keyId)
      .single();
    
    if (error) {
      throw new Error(`Error fetching API key: ${error.message}`);
    }
    
    return data;
  } catch (error) {
    console.error('Error getting API key details:', error);
    throw error;
  }
}

module.exports = {
  generateApiKey,
  createApiKey,
  validateApiKey,
  deactivateApiKey,
  rotateApiKey,
  listCompanyApiKeys,
  getApiKeyDetails
};