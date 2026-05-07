const mongoose = require('mongoose');

const TeacherAttendanceSchema = new mongoose.Schema({
    teacherId: { type: String, required: true },
    name: { type: String, required: true },
    subject: { type: String, required: true },
    department: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    date: { type: String, required: true } // Format: YYYY-MM-DD
});

module.exports = mongoose.model('TeacherAttendance', TeacherAttendanceSchema);
