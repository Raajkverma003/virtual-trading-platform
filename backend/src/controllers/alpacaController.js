const Stock = require('../models/Stock');
const { ALPACA_API_KEY, ALPACA_API_SECRET, ALPACA_API_URL } = require('../config/env');

// In-memory cache for Alpaca assets
let cachedAssets = [];
let cacheTimestamp = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
let isFetching = false;

/**
 * Fetch all active US equity assets from Alpaca and cache them.
 * Uses the REST v2 assets endpoint.
 */
const refreshAssetsCache = async () => {
  if (isFetching) return;
  isFetching = true;

  try {
    if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
      console.warn('[Alpaca Search] No API keys configured, skipping asset cache refresh.');
      isFetching = false;
      return;
    }

    const Alpaca = require('@alpacahq/alpaca-trade-api');
    const alpaca = new Alpaca({
      keyId: ALPACA_API_KEY,
      secretKey: ALPACA_API_SECRET,
      paper: true
    });

    console.log('[Alpaca Search] Refreshing assets cache from Alpaca API...');
    const assets = await alpaca.getAssets({ status: 'active', asset_class: 'us_equity' });

    // Filter to only tradeable assets and store symbol + name
    cachedAssets = assets
      .filter(a => a.tradable && a.status === 'active')
      .map(a => ({
        symbol: a.symbol,
        name: a.name || a.symbol
      }));

    cacheTimestamp = Date.now();
    console.log(`[Alpaca Search] Cached ${cachedAssets.length} active tradeable assets.`);
  } catch (error) {
    console.error('[Alpaca Search] Failed to refresh assets cache:', error.message);
  } finally {
    isFetching = false;
  }
};

// @desc    Search Alpaca assets by symbol or company name
// @route   GET /api/alpaca/search?query=AAPL
// @access  Public
const searchAssets = async (req, res, next) => {
  try {
    const query = (req.query.query || '').trim().toUpperCase();

    if (!query || query.length < 1) {
      return res.json({ success: true, data: [] });
    }

    // Refresh cache if stale or empty
    if (cachedAssets.length === 0 || (Date.now() - cacheTimestamp) > CACHE_TTL_MS) {
      await refreshAssetsCache();
    }

    // If we have cached Alpaca assets, search them
    if (cachedAssets.length > 0) {
      const results = [];
      for (const asset of cachedAssets) {
        const symbolMatch = asset.symbol.toUpperCase().startsWith(query);
        const nameMatch = asset.name.toUpperCase().includes(query);

        if (symbolMatch || nameMatch) {
          results.push(asset);
        }
      }

      // Sort: exact symbol match first, then startsWith, then name matches
      results.sort((a, b) => {
        const aExact = a.symbol.toUpperCase() === query ? 0 : 1;
        const bExact = b.symbol.toUpperCase() === query ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;

        const aStarts = a.symbol.toUpperCase().startsWith(query) ? 0 : 1;
        const bStarts = b.symbol.toUpperCase().startsWith(query) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;

        // Fallback: symbol alphabetical
        return a.symbol.localeCompare(b.symbol);
      });

      return res.json({ success: true, data: results.slice(0, 20) });
    }

    // Fallback: search local DB stocks if Alpaca cache is empty
    const localStocks = await Stock.find({
      $or: [
        { symbol: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } }
      ]
    })
      .select('symbol name price')
      .limit(20);

    const data = localStocks.map(s => ({
      symbol: s.symbol,
      name: s.name
    }));

    return res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchAssets,
  refreshAssetsCache
};
