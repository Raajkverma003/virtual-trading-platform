const express = require('express');
const router = express.Router();
const { getStocks, getStockBySymbol, getMostBoughtStocks } = require('../controllers/stockController');

router.get('/stats/most-bought', getMostBoughtStocks);
router.get('/', getStocks);
router.get('/:symbol', getStockBySymbol);

module.exports = router;
