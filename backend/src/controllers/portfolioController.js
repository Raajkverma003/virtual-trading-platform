const User = require('../models/User');
const Stock = require('../models/Stock');
const PortfolioHistory = require('../models/PortfolioHistory');
const Position = require('../models/Position');
const { getAssetPrice } = require('../services/tradeEngine');

// @desc    Get user's portfolio breakdown, holdings valuation and P&L
// @route   GET /api/portfolio
// @access  Private
const getPortfolio = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // 1. Fetch current stock prices to compute active valuation
    const symbols = user.portfolio.map(h => h.symbol);
    const stocks = await Stock.find({ symbol: { $in: symbols } });
    
    // Map symbols to current price and metadata for fast lookup
    const stocksMap = {};
    stocks.forEach(stock => {
      stocksMap[stock.symbol] = {
        price: stock.price,
        name: stock.name,
        changePercent: stock.changePercent
      };
    });

    let totalHoldingsValue = 0;
    let totalHoldingsCost = 0;

    const holdingsWithValuation = user.portfolio.map(holding => {
      const stockInfo = stocksMap[holding.symbol];
      const currentPrice = stockInfo ? stockInfo.price : holding.avgBuyPrice;
      const currentValue = holding.shares * currentPrice;
      const costBasis = holding.shares * holding.avgBuyPrice;
      const pnl = currentValue - costBasis;
      const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;

      totalHoldingsValue += currentValue;
      totalHoldingsCost += costBasis;

      return {
        symbol: holding.symbol,
        name: stockInfo ? stockInfo.name : holding.symbol,
        shares: holding.shares,
        avgBuyPrice: holding.avgBuyPrice,
        currentPrice: currentPrice,
        currentValue: Math.round(currentValue * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
        pnlPercent: Math.round(pnlPercent * 100) / 100,
        dayChangePercent: stockInfo ? Math.round(stockInfo.changePercent * 100) / 100 : 0
      };
    });

    const cash = user.balance;
    const netWorth = cash + totalHoldingsValue;
    const totalPnl = totalHoldingsValue - totalHoldingsCost;
    const totalPnlPercent = totalHoldingsCost > 0 ? (totalPnl / totalHoldingsCost) * 100 : 0;

    res.json({
      success: true,
      data: {
        cash: Math.round(cash * 100) / 100,
        totalHoldingsValue: Math.round(totalHoldingsValue * 100) / 100,
        netWorth: Math.round(netWorth * 100) / 100,
        totalPnl: Math.round(totalPnl * 100) / 100,
        totalPnlPercent: Math.round(totalPnlPercent * 100) / 100,
        holdings: holdingsWithValuation
      }
    });

  } catch (error) {
    next(error);
  }
};

// @desc    Get user's portfolio net worth history logs (for chart drawing)
// @route   GET /api/portfolio/history
// @access  Private
const getPortfolioHistory = async (req, res, next) => {
  try {
    const history = await PortfolioHistory.find({ user: req.user._id })
      .sort({ timestamp: 1 })
      .limit(100);
    
    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's active intraday positions
// @route   GET /api/portfolio/positions
// @access  Private
const getPositions = async (req, res, next) => {
  try {
    const positions = await Position.find({ user: req.user._id });
    
    // Fetch stock info for underlying tickers
    const symbols = [...new Set(positions.map(p => p.symbol))];
    const stocks = await Stock.find({ symbol: { $in: symbols } });
    
    const stocksMap = {};
    stocks.forEach(stock => {
      stocksMap[stock.symbol] = stock;
    });

    const positionsWithLtp = positions.map(pos => {
      const stockInfo = stocksMap[pos.symbol];
      const stockPrice = stockInfo ? stockInfo.price : pos.avgPrice;
      const ltp = getAssetPrice(pos.assetType, stockPrice, pos.optionType, pos.strikePrice);
      
      let pnl = 0;
      let pnlPercent = 0;
      if (pos.quantity > 0) {
        pnl = pos.quantity * (ltp - pos.avgPrice);
        pnlPercent = pos.avgPrice > 0 ? ((ltp - pos.avgPrice) / pos.avgPrice) * 100 : 0;
      } else if (pos.quantity < 0) {
        pnl = Math.abs(pos.quantity) * (pos.avgPrice - ltp);
        pnlPercent = pos.avgPrice > 0 ? ((pos.avgPrice - ltp) / pos.avgPrice) * 100 : 0;
      }

      return {
        _id: pos._id,
        symbol: pos.symbol,
        name: stockInfo ? stockInfo.name : pos.symbol,
        assetType: pos.assetType,
        optionType: pos.optionType,
        strikePrice: pos.strikePrice,
        expiry: pos.expiry,
        quantity: pos.quantity,
        avgPrice: pos.avgPrice,
        ltp: Math.round(ltp * 100) / 100,
        pnl: Math.round(pnl * 100) / 100,
        pnlPercent: Math.round(pnlPercent * 100) / 100
      };
    });

    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      balance: user ? user.balance : 0,
      data: positionsWithLtp
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Settle all active positions (market close simulation)
// @route   POST /api/portfolio/positions/settle
// @access  Private
const settlePositions = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    const positions = await Position.find({ user: req.user._id });
    if (positions.length === 0) {
      return res.json({
        success: true,
        message: 'No active positions to settle'
      });
    }

    const symbols = [...new Set(positions.map(p => p.symbol))];
    const stocks = await Stock.find({ symbol: { $in: symbols } });
    const stocksMap = {};
    stocks.forEach(stock => {
      stocksMap[stock.symbol] = stock;
    });

    for (const pos of positions) {
      const stockInfo = stocksMap[pos.symbol];
      const stockPrice = stockInfo ? stockInfo.price : pos.avgPrice;
      const ltp = getAssetPrice(pos.assetType, stockPrice, pos.optionType, pos.strikePrice);

      if (pos.assetType === 'STOCK' && pos.quantity > 0) {
        // Merge long stock position into settled holdings
        const holdingIndex = user.portfolio.findIndex(h => h.symbol === pos.symbol);
        if (holdingIndex > -1) {
          const holding = user.portfolio[holdingIndex];
          const oldCost = holding.shares * holding.avgBuyPrice;
          const newCost = oldCost + (pos.quantity * pos.avgPrice);
          holding.shares += pos.quantity;
          holding.avgBuyPrice = newCost / holding.shares;
        } else {
          user.portfolio.push({
            symbol: pos.symbol,
            shares: pos.quantity,
            avgBuyPrice: pos.avgPrice
          });
        }
      } else {
        // Short stock positions and F&O are cash-settled/closed
        if (pos.quantity > 0) {
          // Sell long asset back to cash
          user.balance += pos.quantity * ltp;
        } else if (pos.quantity < 0) {
          // Buy back short asset from cash
          user.balance -= Math.abs(pos.quantity) * ltp;
        }
      }
    }

    // Save user updates and delete all positions
    await user.save();
    await Position.deleteMany({ user: req.user._id });

    res.json({
      success: true,
      message: 'Intraday positions settled successfully!',
      data: {
        balance: user.balance,
        portfolio: user.portfolio
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPortfolio,
  getPortfolioHistory,
  getPositions,
  settlePositions
};
