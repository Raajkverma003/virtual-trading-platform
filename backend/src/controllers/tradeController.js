const Transaction = require('../models/Transaction');
const Stock = require('../models/Stock');
const User = require('../models/User');
const Position = require('../models/Position');
const { getAssetPrice, executeTrade } = require('../services/tradeEngine');

// @desc    Place a new order (STOCK, FUTURE, or OPTION)
// @route   POST /api/trades/order
// @access  Private
const placeOrder = async (req, res, next) => {
  const { 
    symbol, 
    type, 
    orderType, 
    shares, 
    limitPrice, 
    assetType = 'STOCK', 
    optionType, 
    strikePrice, 
    expiry 
  } = req.body;

  try {
    // 1. Basic validation
    if (!symbol || !type || !orderType || !shares) {
      res.status(400);
      throw new Error('Please provide symbol, type (BUY/SELL), orderType (MARKET/LIMIT), and shares');
    }

    if (!['STOCK', 'FUTURE', 'OPTION'].includes(assetType)) {
      res.status(400);
      throw new Error('assetType must be STOCK, FUTURE, or OPTION');
    }

    if (assetType === 'OPTION') {
      if (!['CALL', 'PUT'].includes(optionType)) {
        res.status(400);
        throw new Error('optionType must be CALL or PUT for option orders');
      }
      if (!strikePrice || isNaN(parseFloat(strikePrice)) || parseFloat(strikePrice) <= 0) {
        res.status(400);
        throw new Error('Please provide a valid positive strikePrice for option orders');
      }
      if (!expiry || !expiry.trim()) {
        res.status(400);
        throw new Error('Please provide an expiry date for option orders');
      }
    }

    if (assetType === 'FUTURE') {
      if (!expiry || !expiry.trim()) {
        res.status(400);
        throw new Error('Please provide an expiry date for future orders');
      }
    }

    const uppercaseSymbol = symbol.toUpperCase();
    const parsedShares = parseFloat(shares);

    if (isNaN(parsedShares) || parsedShares <= 0) {
      res.status(400);
      throw new Error('Shares must be a positive number');
    }

    if (!['BUY', 'SELL'].includes(type)) {
      res.status(400);
      throw new Error('Type must be BUY or SELL');
    }

    if (!['MARKET', 'LIMIT'].includes(orderType)) {
      res.status(400);
      throw new Error('orderType must be MARKET or LIMIT');
    }

    if (orderType === 'LIMIT' && (!limitPrice || isNaN(parseFloat(limitPrice)) || parseFloat(limitPrice) <= 0)) {
      res.status(400);
      throw new Error('Please provide a valid positive limitPrice for LIMIT orders');
    }

    // 2. Find underlying stock
    const stock = await Stock.findOne({ symbol: uppercaseSymbol });
    if (!stock) {
      res.status(404);
      throw new Error(`Stock ${uppercaseSymbol} not found`);
    }

    const currentStockPrice = stock.price;
    const user = await User.findById(req.user._id);
    if (!user) {
      res.status(404);
      throw new Error('User not found');
    }

    // Calculate derived asset execution price (LTP)
    const executionPrice = getAssetPrice(assetType, currentStockPrice, optionType, strikePrice);
    const totalCost = parsedShares * executionPrice;

    // 3. Process Market Order
    if (orderType === 'MARKET') {
      if (type === 'BUY') {
        // Check balance
        if (user.balance < totalCost) {
          res.status(400);
          throw new Error(`Insufficient balance. Required: $${totalCost.toFixed(2)}, Available: $${user.balance.toFixed(2)}`);
        }
      } else if (type === 'SELL') {
        // If selling STOCK, verify they have settled holdings plus active positions to cover, 
        // OR allow short selling (creates negative position). 
        // We will allow shorting, but check if they are trying to sell settled holdings they actually own.
        if (assetType === 'STOCK') {
          const holdingIndex = user.portfolio.findIndex(item => item.symbol === uppercaseSymbol);
          const settledShares = holdingIndex > -1 ? user.portfolio[holdingIndex].shares : 0;
          
          const positionQuery = {
            user: user._id,
            symbol: uppercaseSymbol,
            assetType: 'STOCK',
            optionType: null,
            strikePrice: null,
            expiry: null
          };
          const activePos = await Position.findOne(positionQuery);
          const activePosQty = activePos ? activePos.quantity : 0;

          const totalAvailableToSell = settledShares + (activePosQty > 0 ? activePosQty : 0);
          
          // If they don't have enough settled holdings and they don't want to short sell, 
          // or we just let them short sell (so totalAvailableToSell is bypassed). We allow short selling!
        }
      }

      // Execute Trade via tradeEngine helper (saves user and creates/updates positions/holdings)
      await executeTrade(
        user, 
        uppercaseSymbol, 
        type, 
        assetType, 
        optionType, 
        strikePrice, 
        expiry, 
        parsedShares, 
        executionPrice
      );

      // Create completed transaction log
      const transaction = await Transaction.create({
        user: user._id,
        symbol: uppercaseSymbol,
        type,
        orderType,
        shares: parsedShares,
        price: executionPrice,
        status: 'COMPLETED',
        assetType,
        optionType: assetType === 'OPTION' ? optionType : null,
        strikePrice: assetType === 'OPTION' ? parseFloat(strikePrice) : null,
        expiry: ['OPTION', 'FUTURE'].includes(assetType) ? expiry : null
      });

      return res.status(201).json({
        success: true,
        message: `${type} ${assetType} order executed successfully`,
        data: {
          transaction,
          balance: user.balance,
          portfolio: user.portfolio
        }
      });
    }

    // 4. Process Limit Order
    if (orderType === 'LIMIT') {
      const parsedLimitPrice = parseFloat(limitPrice);
      const totalCostAtLimit = parsedShares * parsedLimitPrice;

      if (type === 'BUY') {
        if (user.balance < totalCostAtLimit) {
          res.status(400);
          throw new Error(`Insufficient balance for limit order. Required: $${totalCostAtLimit.toFixed(2)}, Available: $${user.balance.toFixed(2)}`);
        }
      }

      const transaction = await Transaction.create({
        user: user._id,
        symbol: uppercaseSymbol,
        type,
        orderType,
        shares: parsedShares,
        price: executionPrice, // Current derived price at submission
        limitPrice: parsedLimitPrice,
        status: 'PENDING',
        assetType,
        optionType: assetType === 'OPTION' ? optionType : null,
        strikePrice: assetType === 'OPTION' ? parseFloat(strikePrice) : null,
        expiry: ['OPTION', 'FUTURE'].includes(assetType) ? expiry : null
      });

      return res.status(201).json({
        success: true,
        message: `${type} ${assetType} Limit order submitted successfully`,
        data: transaction
      });
    }

  } catch (error) {
    next(error);
  }
};

// @desc    Get user's transactions history
// @route   GET /api/trades/history
// @access  Private
const getTransactionHistory = async (req, res, next) => {
  try {
    const history = await Transaction.find({ user: req.user._id }).sort({ timestamp: -1 });
    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get user's pending limit orders
// @route   GET /api/trades/pending
// @access  Private
const getPendingOrders = async (req, res, next) => {
  try {
    const pending = await Transaction.find({ user: req.user._id, status: 'PENDING' }).sort({ timestamp: -1 });
    res.json({
      success: true,
      count: pending.length,
      data: pending
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel a pending limit order
// @route   DELETE /api/trades/cancel/:id
// @access  Private
const cancelOrder = async (req, res, next) => {
  try {
    const order = await Transaction.findById(req.params.id);

    if (!order) {
      res.status(404);
      throw new Error('Order not found');
    }

    // Check ownership
    if (order.user.toString() !== req.user._id.toString()) {
      res.status(401);
      throw new Error('Not authorized to cancel this order');
    }

    if (order.status !== 'PENDING') {
      res.status(400);
      throw new Error(`Cannot cancel an order that is already ${order.status.toLowerCase()}`);
    }

    order.status = 'CANCELLED';
    await order.save();

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: order
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  placeOrder,
  getTransactionHistory,
  getPendingOrders,
  cancelOrder
};
