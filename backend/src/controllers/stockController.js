const Stock = require('../models/Stock');
const Transaction = require('../models/Transaction');

// @desc    Get all stocks
// @route   GET /api/stocks
// @access  Public
const getStocks = async (req, res, next) => {
  try {
    const stocks = await Stock.find().select('-history');
    res.json({
      success: true,
      count: stocks.length,
      data: stocks
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get stock details and history by symbol
// @route   GET /api/stocks/:symbol
// @access  Public
const getStockBySymbol = async (req, res, next) => {
  try {
    const stock = await Stock.findOne({ symbol: req.params.symbol.toUpperCase() });
    if (!stock) {
      res.status(404);
      throw new Error(`Stock with symbol ${req.params.symbol.toUpperCase()} not found`);
    }

    res.json({
      success: true,
      data: stock
    });
  } catch (error) {
    next(error);
  }
};
// @desc    Get top bought stocks by volume
// @route   GET /api/stocks/stats/most-bought
// @access  Public
const getMostBoughtStocks = async (req, res, next) => {
  try {
    const mostBought = await Transaction.aggregate([
      { $match: { type: 'BUY', status: 'COMPLETED' } },
      { $group: { _id: '$symbol', volume: { $sum: '$shares' } } },
      { $sort: { volume: -1 } },
      { $limit: 5 }
    ]);

    const symbols = mostBought.map(mb => mb._id);
    const stocks = await Stock.find({ symbol: { $in: symbols } }).select('-history');

    let data = mostBought.map(mb => {
      const stock = stocks.find(s => s.symbol === mb._id);
      return {
        symbol: mb._id,
        name: stock ? stock.name : mb._id,
        price: stock ? stock.price : 0,
        change: stock ? stock.change : 0,
        changePercent: stock ? stock.changePercent : 0,
        volume: mb.volume
      };
    });

    // Fallback seed mechanism if less than 5 traded stocks exist
    if (data.length < 5) {
      const allStocks = await Stock.find({ symbol: { $nin: symbols } }).limit(5 - data.length);
      allStocks.forEach((stock, index) => {
        data.push({
          symbol: stock.symbol,
          name: stock.name,
          price: stock.price,
          change: stock.change,
          changePercent: stock.changePercent,
          volume: Math.round((5 - data.length - index) * 1250)
        });
      });
    }

    // Sort descending by volume
    data.sort((a, b) => b.volume - a.volume);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
};
module.exports = {
  getStocks,
  getStockBySymbol,
  getMostBoughtStocks
};
