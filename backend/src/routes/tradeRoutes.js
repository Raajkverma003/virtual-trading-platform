const express = require('express');
const router = express.Router();
const { placeOrder, getTransactionHistory, getPendingOrders, cancelOrder } = require('../controllers/tradeController');
const { protect } = require('../middlewares/authMiddleware');

// Protect all routes under /api/trades
router.use(protect);

router.post('/order', placeOrder);
router.get('/history', getTransactionHistory);
router.get('/pending', getPendingOrders);
router.delete('/cancel/:id', cancelOrder);

module.exports = router;
