const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema(
  {
    symbol: {
      type: String,
      required: [true, 'Stock symbol is required'],
      unique: true,
      uppercase: true,
      trim: true
    },
    name: {
      type: String,
      required: [true, 'Stock name is required'],
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: [0.01, 'Price cannot be free or negative']
    },
    prevClose: {
      type: Number,
      required: true
    },
    change: {
      type: Number,
      default: 0
    },
    changePercent: {
      type: Number,
      default: 0
    },
    history: [
      {
        timestamp: {
          type: Date,
          default: Date.now
        },
        price: {
          type: Number,
          required: true
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Stock', stockSchema);
