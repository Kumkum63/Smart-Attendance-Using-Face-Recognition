const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    studentId: { type: String, required: true, unique: true },
    course: { type: String, required: true },
    year: { type: String, required: true },
    descriptors: { type: Array, required: true }, // Array of 128 float values
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Student', StudentSchema);
