const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    symbol: {
      type: String,
      required: [true, 'Stock symbol is required'],
      uppercase: true,
      trim: true
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: ['BUY', 'SELL'],
        message: 'Transaction type must be either BUY or SELL'
      }
    },
    orderType: {
      type: String,
      required: true,
      enum: {
        values: ['MARKET', 'LIMIT'],
        message: 'Order type must be either MARKET or LIMIT'
      }
    },
    shares: {
      type: Number,
      required: [true, 'Number of shares is required'],
      min: [0.0001, 'Shares must be positive']
    },
    price: {
      type: Number,
      required: true, // For Limit orders, this is the price at submission time. For Market, it is execution price.
      min: [0, 'Price cannot be negative']
    },
    limitPrice: {
      type: Number,
      required: function() {
        return this.orderType === 'LIMIT';
      }
    },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'COMPLETED', 'CANCELLED'],
      default: 'COMPLETED'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Transaction', transactionSchema);
