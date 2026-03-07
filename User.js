const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  plan: { type: String, enum: ['free', 'pro'], default: 'free' },
  planExpiry: { type: Date },
  usage: {
    channelAudits: { type: Number, default: 0 },
    keywordSearches: { type: Number, default: 0 },
    aiMessages: { type: Number, default: 0 },
    thumbnailChecks: { type: Number, default: 0 },
    lastReset: { type: Date, default: Date.now }
  }
}, { timestamps: true });

UserSchema.methods.isPro = function() {
  return this.plan === 'pro' && this.planExpiry && this.planExpiry > new Date();
};

UserSchema.methods.resetUsageIfNeeded = function() {
  const now = new Date();
  const last = this.usage.lastReset;
  if (!last || now.getMonth() !== last.getMonth() || now.getFullYear() !== last.getFullYear()) {
    this.usage = { channelAudits: 0, keywordSearches: 0, aiMessages: 0, thumbnailChecks: 0, lastReset: now };
  }
};

module.exports = mongoose.model('User', UserSchema);
