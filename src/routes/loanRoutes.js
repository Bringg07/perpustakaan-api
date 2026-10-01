const express = require('express');
const controller = require('../controllers/loanController');

const router = express.Router();

// Rute statis harus didefinisikan sebelum rute dinamis `/:id`.
router.post('/sync-overdue', controller.syncOverdue);

router.get('/', controller.listLoans);
router.post('/', controller.createLoan);
router.get('/:id', controller.getLoan);
router.put('/:id', controller.updateLoan);
router.patch('/:id', controller.updateLoan);
router.delete('/:id', controller.deleteLoan);

module.exports = router;
