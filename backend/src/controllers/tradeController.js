const Transaction = require('../models/Transaction');
const Stock = require('../models/Stock');
const User = require('../models/User');

// @desc    Place a new stock order (MARKET or LIMIT)
// @route   POST /api/trades/order
// @access  Private
const placeOrder = async (req, res, next) => {
  const { symbol, type, orderType, shares, limitPrice } = req.body;

  try {
    // 1. Basic validation
    if (!symbol || !type || !orderType || !shares) {
      res.status(400);
      throw new Error('Please provide symbol, type (BUY/SELL), orderType (MARKET/LIMIT), and shares');
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

    // 2. Find stock
    const stock = await Stock.findOne({ symbol: uppercaseSymbol });
    if (!stock) {
      res.status(404);
      throw new Error(`Stock ${uppercaseSymbol} not found`);
    }

    const currentPrice = stock.price;
    const user = await User.findById(req.user._id);

    // 3. Process Market Order
    if (orderType === 'MARKET') {
      const totalPrice = parsedShares * currentPrice;

      if (type === 'BUY') {
        // Check balance
        if (user.balance < totalPrice) {
          res.status(400);
          throw new Error(`Insufficient balance. Required: $${totalPrice.toFixed(2)}, Available: $${user.balance.toFixed(2)}`);
        }

        // Deduct balance
        user.balance -= totalPrice;

        // Update portfolio holdings
        const holdingIndex = user.portfolio.findIndex(item => item.symbol === uppercaseSymbol);
        if (holdingIndex > -1) {
          const holding = user.portfolio[holdingIndex];
          const oldTotalCost = holding.shares * holding.avgBuyPrice;
          const newTotalCost = oldTotalCost + totalPrice;
          holding.shares += parsedShares;
          holding.avgBuyPrice = newTotalCost / holding.shares;
        } else {
          user.portfolio.push({
            symbol: uppercaseSymbol,
            shares: parsedShares,
            avgBuyPrice: currentPrice
          });
        }
      } else if (type === 'SELL') {
        // Check holdings
        const holdingIndex = user.portfolio.findIndex(item => item.symbol === uppercaseSymbol);
        if (holdingIndex === -1 || user.portfolio[holdingIndex].shares < parsedShares) {
          res.status(400);
          throw new Error(`Insufficient shares. You own ${holdingIndex === -1 ? 0 : user.portfolio[holdingIndex].shares} shares of ${uppercaseSymbol}`);
        }

        // Add proceeds
        user.balance += totalPrice;

        // Update holdings
        user.portfolio[holdingIndex].shares -= parsedShares;
        if (user.portfolio[holdingIndex].shares <= 0.0001) {
          user.portfolio.splice(holdingIndex, 1);
        }
      }

      // Save user & create completed transaction
      await user.save();
      const transaction = await Transaction.create({
        user: user._id,
        symbol: uppercaseSymbol,
        type,
        orderType,
        shares: parsedShares,
        price: currentPrice,
        status: 'COMPLETED'
      });

      return res.status(201).json({
        success: true,
        message: `${type} Market order executed successfully`,
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
        // Basic pre-check: Does user have enough money right now?
        if (user.balance < totalCostAtLimit) {
          res.status(400);
          throw new Error(`Insufficient balance for limit order. Required: $${totalCostAtLimit.toFixed(2)}, Available: $${user.balance.toFixed(2)}`);
        }
      } else if (type === 'SELL') {
        // Check holdings
        const holdingIndex = user.portfolio.findIndex(item => item.symbol === uppercaseSymbol);
        if (holdingIndex === -1 || user.portfolio[holdingIndex].shares < parsedShares) {
          res.status(400);
          throw new Error(`Insufficient shares. You own ${holdingIndex === -1 ? 0 : user.portfolio[holdingIndex].shares} shares of ${uppercaseSymbol}`);
        }
      }

      const transaction = await Transaction.create({
        user: user._id,
        symbol: uppercaseSymbol,
        type,
        orderType,
        shares: parsedShares,
        price: currentPrice, // Price when order is requested
        limitPrice: parsedLimitPrice,
        status: 'PENDING'
      });

      return res.status(201).json({
        success: true,
        message: `${type} Limit order submitted successfully`,
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
