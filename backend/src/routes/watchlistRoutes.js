const express = require('express');
const router = express.Router();
const {
  getWatchlists,
  createWatchlist,
  deleteWatchlist,
  addSymbolToWatchlist,
  removeSymbolFromWatchlist
} = require('../controllers/watchlistController');
const { protect } = require('../middlewares/authMiddleware');

// Protect all routes under /api/watchlist
router.use(protect);

router.route('/')
  .get(getWatchlists)
  .post(createWatchlist);

router.route('/:id')
  .delete(deleteWatchlist);

router.route('/:id/symbols')
  .post(addSymbolToWatchlist);

router.route('/:id/symbols/:symbol')
  .delete(removeSymbolFromWatchlist);

module.exports = router;
