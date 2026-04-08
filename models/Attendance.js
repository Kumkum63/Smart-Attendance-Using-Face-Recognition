const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
    studentId: { type: String, required: true },
    name: { type: String, required: true },
    course: { type: String, required: true },
    year: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    date: { type: String, required: true } // Format: YYYY-MM-DD
});

module.exports = mongoose.model('Attendance', AttendanceSchema);
