const Stock = require('../models/Stock');
const User = require('../models/User');
const PortfolioHistory = require('../models/PortfolioHistory');
const { broadcastPrices } = require('../sockets/socketHandler');
const { checkPendingOrders } = require('./orderEngine');
const { SIMULATION_INTERVAL } = require('../config/env');

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
let tickCount = 0;

const startStockSimulation = async () => {
  // First seed stocks if empty
  await seedStocks();

  console.log(`Stock simulation started. Running every ${SIMULATION_INTERVAL}ms`);
  
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
        
        // Clamp price to a minimum of $1.00
        if (newPrice < 1.0) {
          newPrice = 1.0;
        }

        // Round to 2 decimal places
        newPrice = Math.round(newPrice * 100) / 100;

        stock.price = newPrice;
        stock.change = Math.round((newPrice - stock.prevClose) * 100) / 100;
        stock.changePercent = Math.round((stock.change / stock.prevClose) * 10000) / 100;

        // Add to history
        stock.history.push({ timestamp: new Date(), price: newPrice });

        // Keep history array capped at 100 to prevent database document bloat
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

      // 1. Broadcast updated prices via WS
      broadcastPrices(broadcastList);

      // 2. Check and execute any pending limit orders
      await checkPendingOrders(pricesMap);

      // 3. Periodically record user net worth history (e.g. every 12 ticks, ~1 minute with 5s interval)
      if (tickCount % 12 === 0) {
        await recordUsersPortfolioHistory(pricesMap);
      }

    } catch (error) {
      console.error(`Error in stock simulation cycle: ${error.message}`);
    }
  }, SIMULATION_INTERVAL);
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
    console.log('Stock simulation stopped.');
  }
};

module.exports = {
  startStockSimulation,
  stopStockSimulation
};
