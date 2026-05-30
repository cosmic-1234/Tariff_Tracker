// Tariff Lookup Service
// Fetches official HS classification descriptions dynamically from the open public GOV.UK Trade Tariff API
// Requires zero API keys and falls back gracefully on network failure

/**
 * Lookup description for a given HS code (automatically truncates to 4-digit prefix)
 * @param {string} hsCode - 4 to 10-digit HS Code
 * @returns {Promise<string|null>} Official WCO description
 */
export async function lookupHSCodeDescription(hsCode) {
  if (!hsCode) return null;
  
  // Clean HS code (remove dots/spaces)
  const cleaned = String(hsCode).replace(/[^0-9]/g, '');
  if (cleaned.length < 4) return null;
  
  const prefix = cleaned.substring(0, 4);

  try {
    const response = await fetch(`https://trade-tariff.service.gov.uk/api/v2/headings/${prefix}`, {
      headers: { 'Accept': 'application/vnd.uktt.v2' }
    });
    if (!response.ok) throw new Error(`HMRC API error status: ${response.status}`);
    const payload = await response.json();

    if (payload && payload.data && payload.data.attributes) {
      const desc = payload.data.attributes.description;
      if (desc) {
        // Strip any raw HTML markdown (like <sup> or links)
        return desc.replace(/<[^>]*>/g, '').trim();
      }
    }
    return null;
  } catch (error) {
    console.warn('Real-time HS Code Trade Tariff API lookup failed:', error.message);
    return null;
  }
}
