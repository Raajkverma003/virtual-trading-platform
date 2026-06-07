const mongoose = require('mongoose');

const positionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    symbol: {
      type: String,
      required: [true, 'Symbol is required'],
      uppercase: true,
      trim: true
    },
    assetType: {
      type: String,
      required: true,
      enum: ['STOCK', 'FUTURE', 'OPTION'],
      default: 'STOCK'
    },
    optionType: {
      type: String,
      enum: ['CALL', 'PUT', null],
      default: null
    },
    strikePrice: {
      type: Number,
      default: null
    },
    expiry: {
      type: String,
      default: null
    },
    quantity: {
      type: Number,
      required: true,
      default: 0
    },
    avgPrice: {
      type: Number,
      required: true,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

// Compound index to ensure uniqueness per user and active asset key
positionSchema.index(
  { user: 1, symbol: 1, assetType: 1, optionType: 1, strikePrice: 1, expiry: 1 },
  { unique: true }
);

module.exports = mongoose.model('Position', positionSchema);
