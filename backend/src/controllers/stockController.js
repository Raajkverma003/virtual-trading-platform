const Stock = require('../models/Stock');

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

module.exports = {
  getStocks,
  getStockBySymbol
};
