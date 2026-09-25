/**
 * Fitness & Activity data service querying fitness data providers (Pace, Garmin, Strava).
 */

export async function getUserActivityData(user_id, date_range, metric) {
  if (!user_id || typeof user_id !== 'string' || user_id.trim() === '') {
    throw new Error('User ID must be a non-empty string');
  }

  const cleanUserId = user_id.trim();
  const cleanRange = (date_range || '7d').trim();
  const cleanMetric = (metric || 'all').trim();

  // If a custom fitness API is configured via environment variable
  if (process.env.FITNESS_API_URL) {
    const baseUrl = process.env.FITNESS_API_URL.replace(/\/+$/, '');
    const url = `${baseUrl}/users/${encodeURIComponent(cleanUserId)}/activities?range=${encodeURIComponent(cleanRange)}&metric=${encodeURIComponent(cleanMetric)}`;

    let res;
    try {
      res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          ...(process.env.FITNESS_API_KEY ? { 'Authorization': `Bearer ${process.env.FITNESS_API_KEY}` } : {})
        }
      });
    } catch (err) {
      throw new Error(`Upstream network connection error: ${err.message}`);
    }

    if (!res.ok) {
      throw new Error(`Upstream returned HTTP ${res.status} ${res.statusText || 'Error'}`);
    }

    const json = await res.json();
    const items = Array.isArray(json.items) ? json.items : (Array.isArray(json) ? json : [json]);
    return {
      source: "Pace Fitness Provider",
      fetched_at: new Date().toISOString(),
      items: items.slice(0, 20)
    };
  }

  // If Strava token is configured via environment variable
  if (process.env.STRAVA_ACCESS_TOKEN) {
    const url = 'https://www.strava.com/api/v3/athlete/activities?per_page=20';
    let res;
    try {
      res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${process.env.STRAVA_ACCESS_TOKEN}`,
          'Accept': 'application/json'
        }
      });
    } catch (err) {
      throw new Error(`Upstream network connection error: ${err.message}`);
    }

    if (!res.ok) {
      throw new Error(`Upstream returned HTTP ${res.status} ${res.statusText || 'Error'}`);
    }

    const data = await res.json();
    const items = Array.isArray(data) ? data : [];
    return {
      source: "Strava API",
      fetched_at: new Date().toISOString(),
      items: items.slice(0, 20).map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        distance_meters: a.distance,
        moving_time_seconds: a.moving_time,
        total_elevation_gain: a.total_elevation_gain,
        calories_burned: a.calories || null,
        average_speed: a.average_speed,
        start_date: a.start_date
      }))
    };
  }

  // Default upstream provider: Pace Fitness API
  const paceUrl = `https://api.withpace.io/v1/users/${encodeURIComponent(cleanUserId)}/activities?date_range=${encodeURIComponent(cleanRange)}&metric=${encodeURIComponent(cleanMetric)}`;
  let response;
  try {
    response = await fetch(paceUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Group8-FoodAdvisor-MCP/1.0'
      }
    });
  } catch (err) {
    throw new Error(`Upstream network connection error: ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`Upstream returned HTTP ${response.status} ${response.statusText || 'Not Found'}`);
  }

  const result = await response.json();
  const rawItems = Array.isArray(result) ? result : (Array.isArray(result.activities) ? result.activities : (Array.isArray(result.items) ? result.items : []));

  return {
    source: "Pace Fitness Provider",
    fetched_at: new Date().toISOString(),
    items: rawItems.slice(0, 20)
  };
}
