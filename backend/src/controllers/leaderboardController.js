const User = require('../models/User');
const Stock = require('../models/Stock');

// @desc    Get leaderboard rankings based on user net worth
// @route   GET /api/leaderboard
// @access  Public
const getLeaderboard = async (req, res, next) => {
  try {
    const users = await User.find();
    const stocks = await Stock.find();

    // Map symbols to current price
    const pricesMap = {};
    stocks.forEach(stock => {
      pricesMap[stock.symbol] = stock.price;
    });

    // Calculate net worth for each user
    const leaderboard = users.map(user => {
      let holdingsValue = 0;
      user.portfolio.forEach(holding => {
        const currentPrice = pricesMap[holding.symbol] || holding.avgBuyPrice;
        holdingsValue += holding.shares * currentPrice;
      });

      const netWorth = user.balance + holdingsValue;

      return {
        _id: user._id,
        username: user.username,
        cash: Math.round(user.balance * 100) / 100,
        holdingsValue: Math.round(holdingsValue * 100) / 100,
        netWorth: Math.round(netWorth * 100) / 100
      };
    });

    // Sort descending by net worth
    leaderboard.sort((a, b) => b.netWorth - a.netWorth);

    // Get top 50
    const topRankings = leaderboard.slice(0, 50);

    res.json({
      success: true,
      count: topRankings.length,
      data: topRankings
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  getLeaderboard
};
