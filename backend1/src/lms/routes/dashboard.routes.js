const { Router } = require('express');
const { getDashboard } = require('../controllers/dashboard.controller');

const router = Router();

router.get('/', getDashboard);

module.exports = router;
