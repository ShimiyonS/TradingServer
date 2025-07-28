const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  userName: {        // ✅ User name (separate from course name)
    type: String,
    required: true,
  },
  courseName: {      // ✅ Course name (separate field)
    type: String,
    required: true,
  },
  amount: {
    type: String,
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Pending', 'Failed'],
    default: 'Pending',
  },
  userPhone: {       // ✅ User phone for tracking
    type: String,
  },
  userEmail: {       // ✅ User email for tracking
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Payment', PaymentSchema);