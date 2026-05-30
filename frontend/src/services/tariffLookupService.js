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

/**
 * Get multiple HS Code recommendations based on input query (works for chapter headings and subheadings)
 * @param {string} query - input numbers
 * @returns {Promise<Array<{hsCode: string, description: string, type: string}>>}
 */
export async function getHSCodesRecommendation(query) {
  if (!query) return [];
  const cleaned = String(query).replace(/[^0-9]/g, '');
  if (cleaned.length < 2) return [];

  try {
    if (cleaned.length === 2 || cleaned.length === 3) {
      const chapter = cleaned.substring(0, 2);
      const response = await fetch(`https://trade-tariff.service.gov.uk/api/v2/chapters/${chapter}`, {
        headers: { 'Accept': 'application/vnd.uktt.v2' }
      });
      if (!response.ok) throw new Error();
      const payload = await response.json();
      if (payload && Array.isArray(payload.included)) {
        const headings = payload.included
          .filter(item => item.type === 'heading')
          .map(item => {
            const fullCode = item.attributes.goods_nomenclature_item_id || '';
            return {
              hsCode: fullCode.substring(0, 4),
              description: (item.attributes.description || '').replace(/<[^>]*>/g, '').trim(),
              type: 'Heading'
            };
          })
          .filter(h => h.hsCode.startsWith(cleaned) && h.description);

        const seen = new Set();
        const unique = [];
        for (const h of headings) {
          if (!seen.has(h.description.toLowerCase())) {
            seen.add(h.description.toLowerCase());
            unique.push(h);
          }
          if (unique.length >= 5) break;
        }
        return unique;
      }
    } else if (cleaned.length >= 4) {
      const heading = cleaned.substring(0, 4);
      const response = await fetch(`https://trade-tariff.service.gov.uk/api/v2/headings/${heading}`, {
        headers: { 'Accept': 'application/vnd.uktt.v2' }
      });
      if (!response.ok) throw new Error();
      const payload = await response.json();
      if (payload && Array.isArray(payload.included)) {
        const commodities = payload.included
          .filter(item => item.type === 'commodity')
          .map(item => {
            const fullCode = item.attributes.goods_nomenclature_item_id || '';
            return {
              hsCode: fullCode.substring(0, 6),
              description: (item.attributes.description || '').replace(/<[^>]*>/g, '').trim(),
              type: 'Subheading'
            };
          })
          .filter(c => c.hsCode.startsWith(cleaned) && c.description);

        const seen = new Set();
        const unique = [];
        for (const c of commodities) {
          if (!seen.has(c.description.toLowerCase())) {
            seen.add(c.description.toLowerCase());
            unique.push(c);
          }
          if (unique.length >= 5) break;
        }
        return unique;
      }
    }
    return [];
  } catch (error) {
    return [];
  }
}

