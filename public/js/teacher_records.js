let teacherRecords = [];
let filteredTeacherRecords = [];

async function fetchTeacherRecords() {
    try {
        const res = await fetch('/api/teachers/records');
        teacherRecords = await res.json();
        applyTeacherFilters();
    } catch (err) {
        console.error('Error fetching teacher records:', err);
        document.getElementById('teacherRecordsBody').innerHTML = '<tr><td colspan="6" class="no-results" style="color: var(--danger);">Failed to load teacher records.</td></tr>';
    }
}

function applyTeacherFilters() {
    const searchTerm = document.getElementById('teacherSearchInput').value.toLowerCase();
    const department = document.getElementById('departmentFilter').value;
    const date = document.getElementById('teacherDateFilter').value;
    const sort = document.getElementById('teacherSortSelect').value;

    filteredTeacherRecords = teacherRecords.filter(r => {
        const matchesSearch = 
            r.name.toLowerCase().includes(searchTerm) || 
            r.teacherId.toLowerCase().includes(searchTerm);

        const matchesDept = department === "" || r.department === department;
        const matchesDate = date === "" || r.date === date;

        return matchesSearch && matchesDept && matchesDate;
    });

    // Sorting logic
    if (sort === 'date_desc') filteredTeacherRecords.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    else if (sort === 'date_asc') filteredTeacherRecords.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    else if (sort === 'name_asc') filteredTeacherRecords.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'name_desc') filteredTeacherRecords.sort((a, b) => b.name.localeCompare(a.name));

    renderTeacherTable();
}

function renderTeacherTable() {
    const tbody = document.getElementById('teacherRecordsBody');
    const countDisplay = document.getElementById('teacherCountDisplay');
    tbody.innerHTML = '';
    
    if (filteredTeacherRecords.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="no-results">No records found.</td></tr>`;
        countDisplay.innerText = 0;
        return;
    }

    filteredTeacherRecords.forEach(r => {
        const row = document.createElement('tr');
        const time = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        row.innerHTML = `
            <td><b>${r.name}</b></td>
            <td><code>${r.teacherId}</code></td>
            <td><span style="color: var(--primary); font-size: 0.9rem;">${r.subject}</span> <small>(${r.department})</small></td>
            <td>${r.date}</td>
            <td>${time}</td>
            <td><span class="status-present">Present</span></td>
        `;
        tbody.appendChild(row);
    });

    countDisplay.innerText = filteredTeacherRecords.length;
}

function exportTeacherCSV() {
    if (filteredTeacherRecords.length === 0) {
        alert('No data to export');
        return;
    }
    const headers = ['Name', 'Teacher ID', 'Subject', 'Department', 'Date', 'Time', 'Status'];
    const rows = filteredTeacherRecords.map(r => [
        r.name, r.teacherId, r.subject, r.department, r.date,
        new Date(r.timestamp).toLocaleTimeString(), 'Present'
    ]);
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Teacher_Attendance_Records.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

fetchTeacherRecords();
