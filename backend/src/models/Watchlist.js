const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: {
      type: String,
      required: [true, 'Watchlist name is required'],
      trim: true
    },
    symbols: {
      type: [String],
      default: []
    }
  },
  {
    timestamps: true
  }
);

// Compound index to ensure watchlist names are unique per user
watchlistSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Watchlist', watchlistSchema);
