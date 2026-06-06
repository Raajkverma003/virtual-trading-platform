const express = require('express');
const router = express.Router();
const { getPortfolio, getPortfolioHistory } = require('../controllers/portfolioController');
const { protect } = require('../middlewares/authMiddleware');

// Protect all routes under /api/portfolio
router.use(protect);

router.get('/', getPortfolio);
router.get('/history', getPortfolioHistory);

module.exports = router;
