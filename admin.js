const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Payment = require('../models/Payment');

function adminOnly(req, res, next) {
  if (req.user.email !== process.env.EMAIL_USER) {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

router.get('/stats', protect, adminOnly, async function(req, res) {
  try {
    const totalUsers = await User.countDocuments();
    const proUsers = await User.countDocuments({ plan: 'pro', planExpiry: { $gt: new Date() } });
    const totalPayments = await Payment.countDocuments({ status: 'completed' });
    const pendingPayments = await Payment.countDocuments({ status: 'pending', method: 'bank_transfer' });
    const revenue = await Payment.aggregate([{ $match: { status: 'completed', currency: 'INR' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    res.json({ totalUsers: totalUsers, proUsers: proUsers, freeUsers: totalUsers - proUsers, totalPayments: totalPayments, pendingBankTransfers: pendingPayments, totalRevenueINR: revenue[0] ? revenue[0].total : 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/users', protect, adminOnly, async function(req, res) {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).limit(50);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/payments/pending', protect, adminOnly, async function(req, res) {
  try {
    const payments = await Payment.find({ status: 'pending', method: 'bank_transfer' }).populate('user', 'name email').sort({ createdAt: -1 });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/user/:id/plan', protect, adminOnly, async function(req, res) {
  try {
    const plan = req.body.plan;
    const months = req.body.months || 1;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User nahi mila' });
    user.plan = plan;
    if (plan === 'pro') {
      user.planExpiry = new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);
    } else {
      user.planExpiry = null;
    }
    await user.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
