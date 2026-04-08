let allStudents = [];
let filteredStudents = [];
const notification = document.getElementById('notification');

// Notify helper
const showNotification = (message, type = 'success') => {
    notification.innerText = message;
    notification.className = `alert-${type}`;
    notification.style.display = 'block';
    
    // Clear and reset animation
    notification.style.animation = 'none';
    notification.offsetHeight; // trigger reflow
    notification.style.animation = 'slideIn 0.3s ease-out';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
};

async function fetchStudents() {
    try {
        const res = await fetch('/api/students');
        allStudents = await res.json();
        
        // Populate filters with unique values
        const courses = [...new Set(allStudents.map(s => s.course).filter(Boolean))];
        const years = [...new Set(allStudents.map(s => s.year).filter(Boolean))];
        
        const courseSelect = document.getElementById('courseFilter');
        const yearSelect = document.getElementById('yearFilter');
        
        courses.forEach(c => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = c;
            courseSelect.appendChild(opt);
        });
        
        years.forEach(y => {
            const opt = document.createElement('option');
            opt.value = opt.textContent = y;
            yearSelect.appendChild(opt);
        });

        applyFilters();
    } catch (err) {
        console.error('Error fetching students:', err);
        document.getElementById('studentsBody').innerHTML = '<tr><td colspan="5" class="no-results">Failed to load students.</td></tr>';
    }
}

function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const course = document.getElementById('courseFilter').value;
    const year = document.getElementById('yearFilter').value;

    filteredStudents = allStudents.filter(s => {
        const matchesSearch = 
            s.name.toLowerCase().includes(searchTerm) || 
            s.studentId.toLowerCase().includes(searchTerm);
        
        const matchesCourse = course === "" || s.course === course;
        const matchesYear = year === "" || s.year === year;

        return matchesSearch && matchesCourse && matchesYear;
    });

    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('studentsBody');
    const countDisplay = document.getElementById('countDisplay');
    tbody.innerHTML = '';
    
    if (filteredStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="no-results">No students found.</td></tr>`;
        countDisplay.innerText = 0;
        return;
    }

    filteredStudents.forEach(s => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><b>${s.name}</b></td>
            <td><code>${s.studentId}</code></td>
            <td>${s.course || 'N/A'}</td>
            <td>${s.year || 'N/A'}</td>
            <td>
                <button class="btn btn-delete" onclick="deleteStudent('${s.studentId}', '${s.name}')" title="Delete Student">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    countDisplay.innerText = filteredStudents.length;
}

async function deleteStudent(studentId, name) {
    if (!confirm(`Are you sure you want to delete ${name} (${studentId})?\nThis will also delete ALL their attendance records permanently.`)) {
        return;
    }

    try {
        const res = await fetch(`/api/students/${studentId}`, {
            method: 'DELETE'
        });
        const data = await res.json();
        
        if (data.success) {
            showNotification(`Student ${name} deleted successfully!`, 'success');
            // Refresh local data
            allStudents = allStudents.filter(s => s.studentId !== studentId);
            applyFilters();
        } else {
            showNotification(data.message || 'Error deleting student', 'error');
        }
    } catch (err) {
        console.error('Delete Error:', err);
        showNotification('Connection error with server', 'error');
    }
}

// Init
fetchStudents();
