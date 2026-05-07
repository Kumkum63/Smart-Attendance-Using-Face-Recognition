const mongoose = require('mongoose');

const TeacherSchema = new mongoose.Schema({
    name: { type: String, required: true },
    teacherId: { type: String, required: true, unique: true },
    subject: { type: String, required: true },
    department: { type: String, required: true },
    descriptors: { type: Array, required: true }, // Array of 128 float values
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Teacher', TeacherSchema);
