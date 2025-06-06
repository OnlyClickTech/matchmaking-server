const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  userId: String,
  status: { type: String, enum: ['waiting', 'matched'], default: 'waiting' },
  taskmasterId: { type: String, default: null },
  serviceType: String,
}, { timestamps: true });

module.exports = mongoose.model('Match', matchSchema);
