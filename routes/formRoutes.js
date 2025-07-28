const express = require('express');
const router = express.Router();
const { submitForm, getAllRegistrations } = require('../controller/formControllers');
const upload = require('../middleware/uploadMiddleware');
const { savePayment, getAllPayments } = require('../controller/PaymentController');

router.post('/submit', upload.fields([
  { name: 'aadharFile', maxCount: 1 },
  { name: 'signatureFile', maxCount: 1 }
]), submitForm);

router.get('/all',getAllRegistrations);

module.exports = router;
