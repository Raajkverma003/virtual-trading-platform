const express = require('express');
const router = express.Router();
const { 
  getPortfolio, 
  getPortfolioHistory,
  getPositions,
  settlePositions
} = require('../controllers/portfolioController');
const { protect } = require('../middlewares/authMiddleware');

// Protect all routes under /api/portfolio
router.use(protect);

router.get('/', getPortfolio);
router.get('/history', getPortfolioHistory);
router.get('/positions', getPositions);
router.post('/positions/settle', settlePositions);

module.exports = router;
