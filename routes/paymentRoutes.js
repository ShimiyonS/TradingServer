const express = require('express');
const router = express.Router();
const { savePayment, getAllPayments } = require('../controller/PaymentController');

router.post('/add', savePayment);
router.get('/all', getAllPayments);

module.exports = router;