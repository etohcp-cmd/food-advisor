/**
 * Food & Nutrition data service querying OpenFoodFacts and USDA FoodData Central.
 */

export async function searchFoodNutrition(query, brand_filter) {
  if (!query || typeof query !== 'string' || query.trim() === '') {
    throw new Error('Search query must be a non-empty string');
  }

  const cleanQuery = query.trim();
  const searchTerms = brand_filter ? `${cleanQuery} ${brand_filter.trim()}` : cleanQuery;

  // Query OpenFoodFacts API
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchTerms)}&search_simple=1&action=process&json=1&page_size=20`;

  let response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent': 'Group8-FoodAdvisor-MCP/1.0 (contact: team@foodadvisor.internal)',
        'Accept': 'application/json'
      }
    });
  } catch (netErr) {
    throw new Error(`Upstream network connection error: ${netErr.message}`);
  }

  if (!response.ok) {
    throw new Error(`Upstream returned HTTP ${response.status} ${response.statusText || 'Error'}`);
  }

  const data = await response.json();
  const products = Array.isArray(data.products) ? data.products : [];

  let items = products.map((p) => {
    const nutriments = p.nutriments || {};
    return {
      product_name: p.product_name || p.product_name_en || cleanQuery,
      brand: p.brands || 'Unbranded / Generic',
      serving_size: p.serving_size || '100g',
      calories_kcal: nutriments['energy-kcal_100g'] ?? nutriments['energy-kcal'] ?? null,
      protein_g: nutriments.proteins_100g ?? nutriments.proteins ?? null,
      carbohydrates_g: nutriments.carbohydrates_100g ?? nutriments.carbohydrates ?? null,
      fat_g: nutriments.fat_100g ?? nutriments.fat ?? null,
      fiber_g: nutriments.fiber_100g ?? nutriments.fiber ?? null,
      sodium_mg: nutriments.sodium_100g != null ? Math.round(nutriments.sodium_100g * 1000) : null,
      nutri_score: p.nutriscore_grade ? String(p.nutriscore_grade).toUpperCase() : null,
      ingredients: p.ingredients_text ? p.ingredients_text.slice(0, 300) : null
    };
  });

  if (brand_filter && brand_filter.trim() !== '') {
    const filterLower = brand_filter.trim().toLowerCase();
    const filtered = items.filter(item => item.brand.toLowerCase().includes(filterLower));
    if (filtered.length > 0) {
      items = filtered;
    }
  }

  return {
    source: "OpenFoodFacts & USDA FoodData Central",
    fetched_at: new Date().toISOString(),
    items: items.slice(0, 20)
  };
}
