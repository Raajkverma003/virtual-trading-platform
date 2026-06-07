const Transaction = require('../models/Transaction');
const User = require('../models/User');
const { sendToUser } = require('../sockets/socketHandler');

const checkPendingOrders = async (stockPricesMap) => {
  try {
    const pendingOrders = await Transaction.find({ status: 'PENDING' });
    if (pendingOrders.length === 0) return;

    for (const order of pendingOrders) {
      const currentPrice = stockPricesMap[order.symbol];
      if (!currentPrice) continue;

      let triggerExecution = false;

      if (order.type === 'BUY') {
        // BUY limit order: executes when price is <= limitPrice
        if (currentPrice <= order.limitPrice) {
          triggerExecution = true;
        }
      } else if (order.type === 'SELL') {
        // SELL limit order: executes when price is >= limitPrice
        if (currentPrice >= order.limitPrice) {
          triggerExecution = true;
        }
      }

      if (triggerExecution) {
        await executeLimitOrder(order, currentPrice);
      }
    }
  } catch (error) {
    console.error(`Error in checkPendingOrders: ${error.message}`);
  }
};

const { executeTrade } = require('./tradeEngine');

const executeLimitOrder = async (order, executionPrice) => {
  try {
    const user = await User.findById(order.user);
    if (!user) {
      order.status = 'CANCELLED';
      await order.save();
      return;
    }

    if (order.type === 'BUY') {
      const totalCost = order.shares * executionPrice;
      if (user.balance < totalCost) {
        order.status = 'CANCELLED';
        await order.save();
        
        sendToUser(user._id.toString(), 'order-cancelled', {
          orderId: order._id,
          symbol: order.symbol,
          reason: 'Insufficient balance at time of execution'
        });
        return;
      }
    }

    // Execute trade using common trade engine
    await executeTrade(
      user,
      order.symbol,
      order.type,
      order.assetType || 'STOCK',
      order.optionType,
      order.strikePrice,
      order.expiry,
      order.shares,
      executionPrice
    );

    // Complete transaction
    order.status = 'COMPLETED';
    order.price = executionPrice;
    await order.save();

    console.log(`Limit ${order.type} Order executed for user ${user.username}: ${order.shares} ${order.symbol} @ $${executionPrice}`);

    // Notify user via websocket
    sendToUser(user._id.toString(), 'order-executed', {
      orderId: order._id,
      symbol: order.symbol,
      type: order.type,
      shares: order.shares,
      price: executionPrice,
      balance: user.balance
    });
  } catch (error) {
    console.error(`Failed to execute limit order ${order._id}: ${error.message}`);
  }
};

module.exports = {
  checkPendingOrders
};
