const { Router } = require('express');
const { protect } = require('../middleware/auth.middleware');
const {
  getBalance,
  getCatalog,
  purchase,
  getTransactions,
  claimWelcome,
  spend,
  spendAmount,
  grantAmount,
  getUnlocks,
} = require('../controllers/token.controller');

const router = Router();

router.get('/balance', protect, getBalance);
router.get('/catalog', protect, getCatalog);
router.get('/transactions', protect, getTransactions);
router.get('/unlocks', protect, getUnlocks);
router.post('/purchase', protect, purchase);
router.post('/claim-welcome', protect, claimWelcome);
router.post('/spend', protect, spend);
router.post('/spend-amount', protect, spendAmount);
router.post('/grant-amount', protect, grantAmount);

module.exports = router;
