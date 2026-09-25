/**
 * Medical & Scientific Research guidelines service querying NCBI PubMed / Healthcare Data Hub.
 */

export async function fetchEvidenceGuidelines(topic, max_results = 10) {
  if (!topic || typeof topic !== 'string' || topic.trim() === '') {
    throw new Error('Search topic must be a non-empty string');
  }

  const cleanTopic = topic.trim();
  const limit = Math.max(1, Math.min(Number(max_results) || 10, 20));

  // Search PubMed for publication IDs
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(cleanTopic)}&retmode=json&retmax=${limit}`;

  let searchRes;
  try {
    searchRes = await fetch(searchUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Group8-FoodAdvisor-MCP/1.0 (contact: research@foodadvisor.internal)'
      }
    });
  } catch (err) {
    throw new Error(`Upstream network connection error: ${err.message}`);
  }

  if (!searchRes.ok) {
    throw new Error(`Upstream returned HTTP ${searchRes.status} ${searchRes.statusText || 'Error'}`);
  }

  const searchData = await searchRes.json();
  const idlist = searchData?.esearchresult?.idlist || [];

  if (idlist.length === 0) {
    return {
      source: "NCBI PubMed (Healthcare Data Hub)",
      fetched_at: new Date().toISOString(),
      items: []
    };
  }

  // Fetch detailed summaries for retrieved IDs
  const summaryUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${idlist.join(',')}&retmode=json`;

  let sumRes;
  try {
    sumRes = await fetch(summaryUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Group8-FoodAdvisor-MCP/1.0 (contact: research@foodadvisor.internal)'
      }
    });
  } catch (err) {
    throw new Error(`Upstream network connection error: ${err.message}`);
  }

  if (!sumRes.ok) {
    throw new Error(`Upstream returned HTTP ${sumRes.status} ${sumRes.statusText || 'Error'}`);
  }

  const sumData = await sumRes.json();
  const resultObj = sumData?.result || {};

  const items = idlist
    .map(id => {
      const item = resultObj[id];
      if (!item) return null;
      return {
        pmid: id,
        title: item.title ? item.title.replace(/<\/?[^>]+(>|$)/g, '') : 'No title available',
        journal: item.source || item.fulljournalname || 'Unknown Journal',
        pubdate: item.pubdate || 'Unknown date',
        authors: Array.isArray(item.authors) ? item.authors.map(a => a.name) : [],
        doi: Array.isArray(item.articleids) ? (item.articleids.find(a => a.idtype === 'doi')?.value || null) : null
      };
    })
    .filter(Boolean);

  return {
    source: "NCBI PubMed (Healthcare Data Hub)",
    fetched_at: new Date().toISOString(),
    items: items.slice(0, 20)
  };
}
