const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const Student = require('./models/Student');
const Attendance = require('./models/Attendance');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/attendai';

mongoose.connect(MONGO_URI)
.then(() => console.log('✅ MongoDB Connected'))
.catch(err => console.error('❌ MongoDB Connection Error:', err));

// --- Helper Functions ---
function getEuclideanDistance(descriptor1, descriptor2) {
    if (!descriptor1 || !descriptor2) return 1.0;
    return Math.sqrt(
        descriptor1.reduce((sum, val, i) => sum + Math.pow(val - descriptor2[i], 2), 0)
    );
}

// --- API Endpoints ---

// 1. Register Student
app.post('/api/register', async (req, res) => {
    try {
        const { name, studentId, course, year, descriptors } = req.body;

        // Check if ID already exists
        const existingId = await Student.findOne({ studentId });
        if (existingId) {
            return res.status(400).json({ success: false, message: 'Student ID already registered' });
        }

        // --- UNIQUE FACE CHECK ---
        const allStudents = await Student.find({}, 'name studentId descriptors');
        const matchThreshold = 0.55; // Slightly stricter for registration

        for (const student of allStudents) {
            const distance = getEuclideanDistance(descriptors, student.descriptors);
            if (distance < matchThreshold) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Face already registered under Student: ${student.name} (${student.studentId}). Duplicate faces are not allowed.` 
                });
            }
        }

        const newStudent = new Student({ name, studentId, course, year, descriptors });
        await newStudent.save();

        res.status(201).json({ success: true, message: 'Student registered successfully' });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// 2. Mark Attendance
app.post('/api/attendance', async (req, res) => {
    try {
        const { studentId, name, descriptors } = req.body;
        const today = new Date().toISOString().split('T')[0];

        // Fetch student details for record completeness AND verification
        const student = await Student.findOne({ studentId });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student record not found. Please register first.' });
        }

        // --- PROXY PROTECTION: Face Verification ---
        if (!descriptors) {
            return res.status(400).json({ success: false, message: 'Face data missing for verification.' });
        }

        const distance = getEuclideanDistance(descriptors, student.descriptors);
        const verificationThreshold = 0.6; // standard threshold for matching

        if (distance > verificationThreshold) {
            return res.status(401).json({ 
                success: false, 
                message: 'Face verification failed! This face does not match the registered face for this Roll Number.' 
            });
        }

        // Check if already marked for today
        const existingAttendance = await Attendance.findOne({ studentId, date: today });
        if (existingAttendance) {
            return res.status(400).json({ success: false, message: `Attendance already marked for today: ${today}` });
        }

        const newAttendance = new Attendance({
            studentId,
            name: student.name, // Use name from DB to ensure accuracy
            course: student.course,
            year: student.year,
            date: today
        });

        await newAttendance.save();
        res.status(201).json({ success: true, message: `Attendance marked for ${name}` });
    } catch (error) {
        console.error('Attendance Marking Error:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// 3. Get All Students (with descriptors for local matching)
app.get('/api/students', async (req, res) => {
    try {
        const students = await Student.find({}, 'name studentId descriptors');
        res.json(students);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching students' });
    }
});

// 4. Get Attendance Records
app.get('/api/attendance', async (req, res) => {
    try {
        const records = await Attendance.find().sort({ timestamp: -1 });
        res.json(records);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error fetching records' });
    }
});

// 5. Get Monthly Attendance Summary
app.get('/api/attendance/monthly-summary', async (req, res) => {
    try {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

        const students = await Student.find({}, 'name studentId course year');
        const attendance = await Attendance.find({ 
            date: { $gte: firstDay, $lte: lastDay } 
        });

        // Use the current day of the month as the total working days 
        // (to reflect progress through the month)
        const workingDays = now.getDate();

        const summary = students.map(s => {
            const studentPresentDays = [...new Set(attendance.filter(a => a.studentId === s.studentId).map(a => a.date))].length;
            const percentage = workingDays > 0 ? ((studentPresentDays / workingDays) * 100).toFixed(1) : 0;
            return {
                name: s.name,
                studentId: s.studentId,
                course: s.course,
                year: s.year,
                presentDays: studentPresentDays,
                totalDays: workingDays,
                percentage: parseFloat(percentage)
            };
        });

        res.json({ 
            summary, 
            totalWorkingDays: workingDays,
            month: now.toLocaleString('default', { month: 'long', year: 'numeric' })
        });
    } catch (error) {
        console.error('Error fetching monthly summary:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// 6. Delete Student and their attendance records
app.delete('/api/students/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        
        // 1. Delete student from Student collection
        const deletedStudent = await Student.findOneAndDelete({ studentId });
        
        if (!deletedStudent) {
            return res.status(404).json({ success: false, message: 'Student not found.' });
        }

        // 2. Delete all attendance records for this student
        await Attendance.deleteMany({ studentId });

        res.json({ success: true, message: `Student ${deletedStudent.name} and all their records deleted successfully.` });
    } catch (error) {
        console.error('Error deleting student:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 AttendAI Server running at http://localhost:${PORT}`);
});
