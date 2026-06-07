const Stock = require('../models/Stock');
const User = require('../models/User');
const PortfolioHistory = require('../models/PortfolioHistory');
const { broadcastPrices } = require('../sockets/socketHandler');
const { checkPendingOrders } = require('./orderEngine');
const { SIMULATION_INTERVAL, DATA_SOURCE, ALPACA_API_KEY, ALPACA_API_SECRET, ALPACA_API_URL } = require('../config/env');

const SEED_STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 175.00, prevClose: 175.00 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 420.00, prevClose: 420.00 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 170.00, prevClose: 170.00 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 185.00, prevClose: 185.00 },
  { symbol: 'TSLA', name: 'Tesla Inc.', price: 170.00, prevClose: 170.00 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 900.00, prevClose: 900.00 },
  { symbol: 'META', name: 'Meta Platforms Inc.', price: 480.00, prevClose: 480.00 },
  { symbol: 'NFLX', name: 'Netflix Inc.', price: 600.00, prevClose: 600.00 }
];

const seedStocks = async () => {
  try {
    for (const seed of SEED_STOCKS) {
      const exists = await Stock.findOne({ symbol: seed.symbol });
      if (!exists) {
        const stock = new Stock({
          ...seed,
          history: [{ timestamp: new Date(), price: seed.price }]
        });
        await stock.save();
        console.log(`Seeded stock: ${seed.symbol}`);
      }
    }
  } catch (error) {
    console.error(`Error seeding stocks: ${error.message}`);
  }
};

let simulatorInterval = null;
let alpacaSyncInterval = null;
let alpacaInstance = null;
let alpacaClient = null;
let tickCount = 0;
const livePricesCache = {};
const livePrevCloseCache = {};

// Fallback logic to start random walk simulator
const runSimulatorInterval = () => {
  console.log(`[Price Engine] Running in SIMULATOR mode. Interval: ${SIMULATION_INTERVAL}ms`);
  
  simulatorInterval = setInterval(async () => {
    try {
      tickCount++;
      const stocks = await Stock.find();
      const pricesMap = {};
      const broadcastList = [];

      for (const stock of stocks) {
        // Random fluctuation between -1.5% and +1.5%
        const pct = (Math.random() * 3 - 1.5) / 100;
        let newPrice = stock.price * (1 + pct);
        
        if (newPrice < 1.0) {
          newPrice = 1.0;
        }

        newPrice = Math.round(newPrice * 100) / 100;

        stock.price = newPrice;
        stock.change = Math.round((newPrice - stock.prevClose) * 100) / 100;
        stock.changePercent = Math.round((stock.change / stock.prevClose) * 10000) / 100;

        stock.history.push({ timestamp: new Date(), price: newPrice });
        if (stock.history.length > 100) {
          stock.history.shift();
        }

        await stock.save();

        pricesMap[stock.symbol] = newPrice;
        broadcastList.push({
          symbol: stock.symbol,
          name: stock.name,
          price: stock.price,
          change: stock.change,
          changePercent: stock.changePercent
        });
      }

      broadcastPrices(broadcastList);
      await checkPendingOrders(pricesMap);

      if (tickCount % 12 === 0) {
        await recordUsersPortfolioHistory(pricesMap);
      }

    } catch (error) {
      console.error(`Error in stock simulator interval cycle: ${error.message}`);
    }
  }, SIMULATION_INTERVAL);
};

// Sync live prices from cache to database and broadcast to clients
const runAlpacaSyncInterval = () => {
  console.log(`[Price Engine] Running in ALPACA live data mode. Sync interval: ${SIMULATION_INTERVAL}ms`);
  
  alpacaSyncInterval = setInterval(async () => {
    try {
      tickCount++;

      // Refresh cache from snapshots REST API every 12 ticks (e.g. 60 seconds)
      // to guarantee we have live price values and daily prevClose values even if the WebSocket is quiet
      if (tickCount % 12 === 1 && alpacaInstance) {
        try {
          const symbols = SEED_STOCKS.map(s => s.symbol);
          const snapshots = await alpacaInstance.getSnapshots(symbols);
          if (Array.isArray(snapshots)) {
            for (const snap of snapshots) {
              const sym = snap.symbol;
              if (snap.LatestTrade && snap.LatestTrade.Price) {
                livePricesCache[sym] = snap.LatestTrade.Price;
                if (snap.PrevDailyBar && snap.PrevDailyBar.ClosePrice) {
                  livePrevCloseCache[sym] = snap.PrevDailyBar.ClosePrice;
                }
              }
            }
          }
        } catch (restErr) {
          console.warn('[Alpaca Feed] Background snapshots refresh failed:', restErr.message);
        }
      }

      const stocks = await Stock.find();
      const pricesMap = {};
      const broadcastList = [];

      for (const stock of stocks) {
        // Retrieve latest price from real-time cache
        const cachedPrice = livePricesCache[stock.symbol];
        let priceToUse = stock.price;

        if (cachedPrice && cachedPrice > 0) {
          priceToUse = cachedPrice;
        }

        // Retrieve the daily prevClose from cache or fallback to current database value
        const prevCloseToUse = livePrevCloseCache[stock.symbol] || stock.prevClose || priceToUse;

        stock.price = priceToUse;
        stock.prevClose = prevCloseToUse;
        stock.change = Math.round((priceToUse - prevCloseToUse) * 100) / 100;
        stock.changePercent = Math.round((stock.change / prevCloseToUse) * 10000) / 100;

        stock.history.push({ timestamp: new Date(), price: priceToUse });
        if (stock.history.length > 100) {
          stock.history.shift();
        }

        await stock.save();

        pricesMap[stock.symbol] = priceToUse;
        broadcastList.push({
          symbol: stock.symbol,
          name: stock.name,
          price: stock.price,
          change: stock.change,
          changePercent: stock.changePercent
        });
      }

      broadcastPrices(broadcastList);
      await checkPendingOrders(pricesMap);

      if (tickCount % 12 === 0) {
        await recordUsersPortfolioHistory(pricesMap);
      }

    } catch (error) {
      console.error(`Error in Alpaca sync cycle: ${error.message}`);
    }
  }, SIMULATION_INTERVAL);
};

const startStockSimulation = async () => {
  await seedStocks();

  let resolvedDataSource = DATA_SOURCE;

  if (resolvedDataSource === 'ALPACA') {
    if (!ALPACA_API_KEY || !ALPACA_API_SECRET) {
      console.warn('[Price Engine] WARNING: ALPACA_API_KEY or ALPACA_API_SECRET is missing. Falling back to SIMULATOR mode.');
      resolvedDataSource = 'SIMULATOR';
    }
  }

  if (resolvedDataSource === 'ALPACA') {
    try {
      // Assign process environment configuration so the internal websocket trade stream client reads them correctly
      process.env.APCA_API_KEY_ID = ALPACA_API_KEY;
      process.env.APCA_API_SECRET_KEY = ALPACA_API_SECRET;
      process.env.APCA_API_BASE_URL = ALPACA_API_URL;

      const Alpaca = require('@alpacahq/alpaca-trade-api');
      alpacaInstance = new Alpaca({
        keyId: ALPACA_API_KEY,
        secretKey: ALPACA_API_SECRET,
        baseUrl: ALPACA_API_URL,
        paper: true
      });

      // Query initial snapshots via REST to populate prices and prevClose values immediately
      // before connecting the live stream or starting syncs (highly critical for weekends / off-hours)
      const symbols = SEED_STOCKS.map(s => s.symbol);
      try {
        console.log('[Alpaca Feed] Fetching initial stock snapshots from REST API...');
        const snapshots = await alpacaInstance.getSnapshots(symbols);
        if (Array.isArray(snapshots)) {
          for (const snap of snapshots) {
            const sym = snap.symbol;
            if (snap.LatestTrade && snap.LatestTrade.Price) {
              livePricesCache[sym] = snap.LatestTrade.Price;
              if (snap.PrevDailyBar && snap.PrevDailyBar.ClosePrice) {
                livePrevCloseCache[sym] = snap.PrevDailyBar.ClosePrice;
              }
              console.log(`[Alpaca Feed] Initialized ${sym}: price = $${snap.LatestTrade.Price}, prevClose = $${snap.PrevDailyBar ? snap.PrevDailyBar.ClosePrice : 'N/A'}`);
            }
          }
        }
      } catch (restErr) {
        console.error('[Alpaca Feed] Failed to fetch initial snapshots:', restErr.message);
      }

      alpacaClient = alpacaInstance.data_stream_v2;

      alpacaClient.onConnect(() => {
        console.log('[Alpaca Feed] Connected to live data stream');
        // Subscribe to trades for S&P 500 / Nasdaq symbols we track
        alpacaClient.subscribeForTrades(symbols);
      });

      alpacaClient.onDisconnect(() => {
        console.warn('[Alpaca Feed] Disconnected from live data stream. Reconnecting...');
      });

      alpacaClient.onError((err) => {
        console.error('[Alpaca Feed] Stream error:', err.message);
      });

      alpacaClient.onStockTrade((trade) => {
        // Cache the latest trade price from WebSocket
        livePricesCache[trade.Symbol] = trade.Price;
      });

      alpacaClient.connect();

      // Start the periodic sync interval
      runAlpacaSyncInterval();

    } catch (err) {
      console.error('[Alpaca Feed] Failed to initialize live stream, falling back to simulator:', err.message);
      runSimulatorInterval();
    }
  } else {
    runSimulatorInterval();
  }
};

const recordUsersPortfolioHistory = async (pricesMap) => {
  try {
    const users = await User.find();
    for (const user of users) {
      let holdingsValue = 0;
      for (const holding of user.portfolio) {
        const currentPrice = pricesMap[holding.symbol] || holding.avgBuyPrice;
        holdingsValue += holding.shares * currentPrice;
      }
      const netWorth = Math.round((user.balance + holdingsValue) * 100) / 100;

      await PortfolioHistory.create({
        user: user._id,
        netWorth,
        timestamp: new Date()
      });
    }
  } catch (error) {
    console.error(`Error recording portfolio histories: ${error.message}`);
  }
};

const stopStockSimulation = () => {
  if (simulatorInterval) {
    clearInterval(simulatorInterval);
    simulatorInterval = null;
  }
  if (alpacaSyncInterval) {
    clearInterval(alpacaSyncInterval);
    alpacaSyncInterval = null;
  }
  if (alpacaClient) {
    try {
      alpacaClient.disconnect();
    } catch (err) {
      console.warn('[Alpaca Feed] Error disconnecting client:', err.message);
    }
    alpacaClient = null;
  }
  console.log('Price Engine stopped.');
};

module.exports = {
  startStockSimulation,
  stopStockSimulation
};
