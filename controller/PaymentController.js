const Payment = require('../models/Payment');

// @desc   Save payment details
// @route  POST /api/payments/add
// @access Public
const savePayment = async (req, res) => {
  try {
    const { userName, courseName, amount, paymentStatus, userPhone, userEmail } = req.body;

    console.log('📍 Payment request received:', req.body); // Debug log

    if (!userName || !courseName || !amount || !paymentStatus) {
      return res.status(400).json({ 
        message: 'userName, courseName, amount, and paymentStatus are required' 
      });
    }

    // 🔧 Clean and convert amount to number
    let cleanAmount;
    if (typeof amount === 'string') {
      // Remove currency symbols, commas, and spaces, then convert to number
      cleanAmount = parseFloat(amount.replace(/[₹,\s]/g, ''));
    } else {
      cleanAmount = parseFloat(amount);
    }

    // Validate that we have a valid number
    if (isNaN(cleanAmount)) {
      return res.status(400).json({ 
        message: 'Invalid amount format. Please provide a valid number.' 
      });
    }

    console.log('💰 Cleaned amount:', cleanAmount); // Debug log

    const newPayment = new Payment({
      userName,        // ✅ User name
      courseName,      // ✅ Course name  
      amount: cleanAmount, // ✅ Now a clean number
      paymentStatus,
      userPhone,       // ✅ Optional user phone
      userEmail,       // ✅ Optional user email
    });

    await newPayment.save();
    console.log('✅ Payment saved successfully:', newPayment);

    res.status(201).json({ message: 'Payment saved successfully' });
  } catch (error) {
    console.error('❌ Payment Save Error:', error);
    res.status(500).json({ message: 'Server Error', error });
  }
};

const getAllPayments = async (req, res) => {
  try {
    const payments = await Payment.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching payments', error });
  }
};

module.exports = {
  savePayment,
  getAllPayments
};