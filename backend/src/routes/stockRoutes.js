const express = require('express');
const router = express.Router();
const { getStocks, getStockBySymbol } = require('../controllers/stockController');

router.get('/', getStocks);
router.get('/:symbol', getStockBySymbol);

module.exports = router;
