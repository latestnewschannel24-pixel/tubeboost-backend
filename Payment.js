const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  method: { type: String, enum: ['razorpay', 'paypal', 'bank_transfer'], required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  paypalOrderId: String,
  bankRefNumber: String,
  verifiedAt: Date,
  monthsPurchased: { type: Number, default: 1 }
}, { timestamps: true });

module.exports = mongoose.model('Payment', PaymentSchema);
