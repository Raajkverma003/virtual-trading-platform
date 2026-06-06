const mongoose = require('mongoose');

const portfolioHistorySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    netWorth: {
      type: Number,
      required: true
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

// Index for query efficiency
portfolioHistorySchema.index({ user: 1, timestamp: -1 });

module.exports = mongoose.model('PortfolioHistory', portfolioHistorySchema);
