const express = require('express');
const { getHealth } = require('../controllers/healthController');
const loanRoutes = require('./loanRoutes');

const router = express.Router();

router.get('/', getHealth);
router.get('/health', getHealth);
router.use('/loans', loanRoutes);

module.exports = router;
