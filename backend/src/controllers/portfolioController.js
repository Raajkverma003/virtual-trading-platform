const User = require('../models/User');
const Stock = require('../models/Stock');
const PortfolioHistory = require('../models/PortfolioHistory');

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

module.exports = {
  getPortfolio,
  getPortfolioHistory
};
