const Watchlist = require('../models/Watchlist');
const Stock = require('../models/Stock');

// @desc    Get all watchlists for logged-in user with stock details
// @route   GET /api/watchlist
// @access  Private
const getWatchlists = async (req, res, next) => {
  try {
    const watchlists = await Watchlist.find({ user: req.user._id });
    
    // Extract unique symbols from all watchlists
    const allSymbols = [...new Set(watchlists.reduce((acc, wl) => acc.concat(wl.symbols), []))];
    
    // Fetch current stock details for these symbols
    const stocks = await Stock.find({ symbol: { $in: allSymbols } }).select('-history');
    
    const stocksMap = {};
    stocks.forEach(stock => {
      stocksMap[stock.symbol] = {
        symbol: stock.symbol,
        name: stock.name,
        price: stock.price,
        prevClose: stock.prevClose,
        change: stock.change,
        changePercent: stock.changePercent
      };
    });

    // Populate each watchlist's symbols with live details
    const populated = watchlists.map(wl => {
      const populatedSymbols = wl.symbols.map(sym => {
        return stocksMap[sym] || {
          symbol: sym,
          name: sym,
          price: 0,
          prevClose: 0,
          change: 0,
          changePercent: 0
        };
      });
      return {
        _id: wl._id,
        name: wl.name,
        symbols: wl.symbols,
        populatedSymbols,
        createdAt: wl.createdAt,
        updatedAt: wl.updatedAt
      };
    });

    res.json({
      success: true,
      data: populated
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new watchlist
// @route   POST /api/watchlist
// @access  Private
const createWatchlist = async (req, res, next) => {
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      res.status(400);
      throw new Error('Watchlist name is required');
    }

    const trimmedName = name.trim();

    // Enforce limit of 5 watchlists per user
    const watchlistCount = await Watchlist.countDocuments({ user: req.user._id });
    if (watchlistCount >= 5) {
      res.status(400);
      throw new Error('Maximum of 5 watchlists allowed per user');
    }

    // Check if name is unique per user
    const existing = await Watchlist.findOne({ user: req.user._id, name: { $regex: new RegExp(`^${trimmedName}$`, 'i') } });
    if (existing) {
      res.status(400);
      throw new Error('A watchlist with this name already exists');
    }

    const watchlist = await Watchlist.create({
      user: req.user._id,
      name: trimmedName,
      symbols: []
    });

    res.status(201).json({
      success: true,
      data: {
        _id: watchlist._id,
        name: watchlist.name,
        symbols: watchlist.symbols,
        populatedSymbols: []
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a watchlist
// @route   DELETE /api/watchlist/:id
// @access  Private
const deleteWatchlist = async (req, res, next) => {
  try {
    const watchlist = await Watchlist.findOne({ _id: req.params.id, user: req.user._id });
    
    if (!watchlist) {
      res.status(404);
      throw new Error('Watchlist not found');
    }

    await watchlist.deleteOne();

    res.json({
      success: true,
      message: 'Watchlist deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Add stock symbol to watchlist
// @route   POST /api/watchlist/:id/symbols
// @access  Private
const addSymbolToWatchlist = async (req, res, next) => {
  try {
    const { symbol } = req.body;

    if (!symbol || !symbol.trim()) {
      res.status(400);
      throw new Error('Symbol is required');
    }

    const uppercaseSymbol = symbol.trim().toUpperCase();

    // Verify symbol exists in the platform database
    const stockExists = await Stock.findOne({ symbol: uppercaseSymbol });
    if (!stockExists) {
      res.status(404);
      throw new Error(`Symbol ${uppercaseSymbol} is not supported on this platform`);
    }

    const watchlist = await Watchlist.findOne({ _id: req.params.id, user: req.user._id });
    if (!watchlist) {
      res.status(404);
      throw new Error('Watchlist not found');
    }

    // Verify symbol is not already in the watchlist
    if (watchlist.symbols.includes(uppercaseSymbol)) {
      res.status(400);
      throw new Error(`Symbol ${uppercaseSymbol} is already in the watchlist`);
    }

    // Enforce maximum of 50 symbols per watchlist
    if (watchlist.symbols.length >= 50) {
      res.status(400);
      throw new Error('Maximum of 50 symbols allowed per watchlist');
    }

    watchlist.symbols.push(uppercaseSymbol);
    await watchlist.save();

    // Fetch updated populated stock list
    const stocks = await Stock.find({ symbol: { $in: watchlist.symbols } }).select('-history');
    const stocksMap = {};
    stocks.forEach(stock => {
      stocksMap[stock.symbol] = {
        symbol: stock.symbol,
        name: stock.name,
        price: stock.price,
        prevClose: stock.prevClose,
        change: stock.change,
        changePercent: stock.changePercent
      };
    });

    const populatedSymbols = watchlist.symbols.map(sym => {
      return stocksMap[sym] || {
        symbol: sym,
        name: sym,
        price: 0,
        prevClose: 0,
        change: 0,
        changePercent: 0
      };
    });

    res.json({
      success: true,
      data: {
        _id: watchlist._id,
        name: watchlist.name,
        symbols: watchlist.symbols,
        populatedSymbols
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Remove symbol from watchlist
// @route   DELETE /api/watchlist/:id/symbols/:symbol
// @access  Private
const removeSymbolFromWatchlist = async (req, res, next) => {
  try {
    const uppercaseSymbol = req.params.symbol.trim().toUpperCase();

    const watchlist = await Watchlist.findOne({ _id: req.params.id, user: req.user._id });
    if (!watchlist) {
      res.status(404);
      throw new Error('Watchlist not found');
    }

    // Check if symbol exists in the watchlist
    if (!watchlist.symbols.includes(uppercaseSymbol)) {
      res.status(400);
      throw new Error(`Symbol ${uppercaseSymbol} is not in the watchlist`);
    }

    watchlist.symbols = watchlist.symbols.filter(s => s !== uppercaseSymbol);
    await watchlist.save();

    // Fetch updated populated stock list
    const stocks = await Stock.find({ symbol: { $in: watchlist.symbols } }).select('-history');
    const stocksMap = {};
    stocks.forEach(stock => {
      stocksMap[stock.symbol] = {
        symbol: stock.symbol,
        name: stock.name,
        price: stock.price,
        prevClose: stock.prevClose,
        change: stock.change,
        changePercent: stock.changePercent
      };
    });

    const populatedSymbols = watchlist.symbols.map(sym => {
      return stocksMap[sym] || {
        symbol: sym,
        name: sym,
        price: 0,
        prevClose: 0,
        change: 0,
        changePercent: 0
      };
    });

    res.json({
      success: true,
      data: {
        _id: watchlist._id,
        name: watchlist.name,
        symbols: watchlist.symbols,
        populatedSymbols
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getWatchlists,
  createWatchlist,
  deleteWatchlist,
  addSymbolToWatchlist,
  removeSymbolFromWatchlist
};
