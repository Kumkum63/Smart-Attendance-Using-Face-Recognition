const mongoose = require('mongoose');
const Student = require('./models/Student');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/attendai';

function getEuclideanDistance(descriptor1, descriptor2) {
    if (!descriptor1 || !descriptor2) return 1.0;
    return Math.sqrt(
        descriptor1.reduce((sum, val, i) => sum + Math.pow(val - descriptor2[i], 2), 0)
    );
}

async function checkDuplicates() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const students = await Student.find({});
        console.log(`Checking ${students.length} students for duplicate faces...`);

        const duplicates = [];
        for (let i = 0; i < students.length; i++) {
            for (let j = i + 1; j < students.length; j++) {
                const distance = getEuclideanDistance(students[i].descriptors, students[j].descriptors);
                if (distance < 0.6) {
                    duplicates.push({
                        student1: { name: students[i].name, id: students[i].studentId },
                        student2: { name: students[j].name, id: students[j].studentId },
                        distance: distance.toFixed(4)
                    });
                }
            }
        }

        if (duplicates.length > 0) {
            console.log('Found Duplicates:');
            console.log(JSON.stringify(duplicates, null, 2));
        } else {
            console.log('No duplicate faces found.');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkDuplicates();
