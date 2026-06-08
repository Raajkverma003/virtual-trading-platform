const express = require('express');
const router = express.Router();
const { searchAssets } = require('../controllers/alpacaController');

router.get('/search', searchAssets);

module.exports = router;
