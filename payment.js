const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { protect } = require('../middleware/auth');
const Payment = require('../models/Payment');
const User = require('../models/User');

const PRICE_INR = parseInt(process.env.MONTHLY_PRICE_INR) || 330;
const PRICE_USD = parseInt(process.env.MONTHLY_PRICE_USD) || 4;

async function sendEmail(to, subject, html) {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
    await transporter.sendMail({ from: process.env.EMAIL_FROM || process.env.EMAIL_USER, to, subject, html });
  } catch(e) {
    console.error('Email error:', e.message);
  }
}

async function activatePro(userId, months) {
  months = months || 1;
  const user = await User.findById(userId);
  const now = new Date();
  const current = user.planExpiry && user.planExpiry > now ? user.planExpiry : now;
  user.plan = 'pro';
  user.planExpiry = new Date(current.getTime() + months * 30 * 24 * 60 * 60 * 1000);
  await user.save();
  return user;
}

router.get('/info', function(req, res) {
  res.json({
    price_inr: PRICE_INR,
    price_usd: PRICE_USD,
    bank: {
      name: process.env.BANK_NAME,
      account_name: process.env.BANK_ACCOUNT_NAME,
      account_number: process.env.BANK_ACCOUNT_NUMBER,
      ifsc: process.env.BANK_IFSC,
      upi: process.env.BANK_UPI
    },
    razorpay_key: process.env.RAZORPAY_KEY_ID,
    paypal_client_id: process.env.PAYPAL_CLIENT_ID
  });
});

router.post('/razorpay/create', protect, async function(req, res) {
  try {
    const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
    const order = await razorpay.orders.create({ amount: PRICE_INR * 100, currency: 'INR', receipt: 'tb_' + req.user._id + '_' + Date.now() });
    await Payment.create({ user: req.user._id, method: 'razorpay', amount: PRICE_INR, currency: 'INR', razorpayOrderId: order.id, status: 'pending' });
    res.json({ orderId: order.id, amount: PRICE_INR, currency: 'INR' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/razorpay/verify', protect, async function(req, res) {
  try {
    const razorpay_order_id = req.body.razorpay_order_id;
    const razorpay_payment_id = req.body.razorpay_payment_id;
    const razorpay_signature = req.body.razorpay_signature;
    const sign = razorpay_order_id + '|' + razorpay_payment_id;
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(sign).digest('hex');
    if (expected !== razorpay_signature) return res.status(400).json({ error: 'Payment verify nahi hua' });
    await Payment.findOneAndUpdate({ razorpayOrderId: razorpay_order_id }, { status: 'completed', razorpayPaymentId: razorpay_payment_id, verifiedAt: new Date() });
    const user = await activatePro(req.user._id, 1);
    await sendEmail(user.email, 'TubeBoost Pro Activated!', '<h2>Payment Successful!</h2><p>Valid till: ' + user.planExpiry.toLocaleDateString() + '</p>');
    res.json({ success: true, message: 'Pro activate ho gaya!', planExpiry: user.planExpiry });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bank/submit', protect, async function(req, res) {
  try {
    const refNumber = req.body.refNumber;
    if (!refNumber) return res.status(400).json({ error: 'Reference number dalein' });
    const payment = await Payment.create({ user: req.user._id, method: 'bank_transfer', amount: PRICE_INR, currency: 'INR', bankRefNumber: refNumber, status: 'pending' });
    await sendEmail(process.env.EMAIL_USER, 'New Bank Transfer', '<p>User: ' + req.user.email + '</p><p>Ref: ' + refNumber + '</p><p>Payment ID: ' + payment._id + '</p>');
    res.json({ success: true, message: '24 hours mein verify hoga!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/bank/verify/:paymentId', protect, async function(req, res) {
  try {
    if (req.user.email !== process.env.EMAIL_USER) return res.status(403).json({ error: 'Admin only' });
    const payment = await Payment.findById(req.params.paymentId).populate('user');
    if (!payment) return res.status(404).json({ error: 'Payment nahi mila' });
    payment.status = 'completed';
    payment.verifiedAt = new Date();
    await payment.save();
    const user = await activatePro(payment.user._id, 1);
    await sendEmail(payment.user.email, 'TubeBoost Pro Activated!', '<h2>Payment Verified!</h2><p>Valid till: ' + user.planExpiry.toLocaleDateString() + '</p>');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/history', protect, async function(req, res) {
  try {
    const payments = await Payment.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10);
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
