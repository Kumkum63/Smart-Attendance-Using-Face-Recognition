const video = document.getElementById('video');
const loadingOverlay = document.getElementById('loadingOverlay');
const detectionStatus = document.getElementById('detectionStatus');
const attendanceInfo = document.getElementById('attendanceInfo');
const recentLogs = document.getElementById('recentLogs');
const notification = document.getElementById('notification');

let faceMatcher = null;
let labeledFaceDescriptors = [];
let markedCache = new Map(); // studentId -> lastMarkedTimestamp

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

// Start Video
const startVideo = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
    } catch (err) {
        console.error('Error accessing camera:', err);
        showNotification('Camera access denied!', 'error');
    }
};

// Load Data and Models
const init = async () => {
    try {
        // 1. Load Face-API models
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        
        // 2. Fetch Students from DB
        const res = await fetch('/api/students');
        const students = await res.json();
        
        if (students.length === 0) {
            loadingStatus.innerText = 'No students registered. Please register students first.';
            return;
        }

        // 3. Prepare Labeled Face Descriptors for matching
        labeledFaceDescriptors = students.map(s => {
            return new faceapi.LabeledFaceDescriptors(
                `${s.name} (${s.studentId})`, // Label format: "Name (ID)"
                [new Float32Array(s.descriptors)] // Descriptor array
            );
        });

        faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.65); // Relaxed for better matching

        // 4. Update UI
        loadingOverlay.style.display = 'none';
        detectionStatus.innerHTML = '<i class="fas fa-check-circle"></i> Recognition System Active';
        detectionStatus.className = 'status-badge status-online';
        
        // 5. Start live recognition loop
        startRecognition();
    } catch (err) {
        console.error('Init Error:', err);
        document.getElementById('loadingStatus').innerText = 'Error loading models or student data.';
    }
};

// Recognition Loop
const startRecognition = async () => {
    const runDetection = async () => {
        // Use the existing overlay canvas
        const canvas = document.getElementById('overlay');
        if (!canvas) {
            console.error('Overlay canvas not found!');
            return;
        }

        // Wait for video to have dimensions
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            console.log('Waiting for video dimensions for attendance...');
            setTimeout(runDetection, 500);
            return;
        }

        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);

        console.log('Attendance Recognition Active:', displaySize);

        setInterval(async () => {
            if (video.paused || video.ended) return;

            try {
                // Keep confidence consistent with registration for reliability
                const detections = await faceapi.detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2 }))
                    .withFaceLandmarks()
                    .withFaceDescriptors();

                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (detections.length > 0 && faceMatcher) {
                    const resizedDetections = faceapi.resizeResults(detections, displaySize);

                    resizedDetections.forEach(async (detection) => {
                        const result = faceMatcher.findBestMatch(detection.descriptor);
                        
                        // Draw detection box and label
                        const box = detection.detection.box;
                        const drawBox = new faceapi.draw.DrawBox(box, { label: result.toString() });
                        drawBox.draw(canvas);

                        // If match found
                        if (result.label !== 'unknown') {
                            const labelParts = result.label.split(' (');
                            const name = labelParts[0];
                            const studentId = (labelParts[1]?.match(/([^\(\)]+)/)?.[0] || labelParts[1]?.replace(')', '') || "Unknown").trim();
                            
                            detectionStatus.innerHTML = `<i class="fas fa-user-check"></i> Recognized: ${name}`;
                            await markAttendance(studentId, name, detection.descriptor);
                        }
                    });

                    if (resizedDetections.some(d => faceMatcher.findBestMatch(d.descriptor).label === 'unknown')) {
                        // If at least one face remains unknown
                        // This bit is optional, but helps show status
                    }
                } else {
                    detectionStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> Scanning for faces...';
                }
            } catch (err) {
                console.warn('Attendance frame error:', err);
            }
        }, 800);
    };

    if (video.readyState >= 2) {
        runDetection();
    } else {
        video.addEventListener('loadeddata', runDetection);
    }
};

// Mark Attendance API Call
const markAttendance = async (studentId, name, descriptor) => {
    // Client-side cooldown to prevent spamming the server and UI
    const now = Date.now();
    if (markedCache.has(studentId) && (now - markedCache.get(studentId)) < 60000) {
        return; // Already processed this person in the last minute
    }

    try {
        const res = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                studentId, 
                name, 
                descriptors: Array.from(descriptor) // Convert Float32Array to regular array
            })
        });

        const data = await res.json();
        if (data.success) {
            markedCache.set(studentId, now);
            
            // Update UI with success
            attendanceInfo.style.display = 'block';
            document.getElementById('studentNameDisplay').innerText = name;
            document.getElementById('studentIdDisplay').innerText = `ID: ${studentId}`;
            document.getElementById('timestampDisplay').innerText = new Date().toLocaleTimeString();
            
            showNotification(`Attendance marked for ${name}`, 'success');
            
            // Re-hide display after 5s
            setTimeout(() => {
                attendanceInfo.style.display = 'none';
            }, 5000);
            
            updateLogs(name, studentId);
        } else {
            // Show the specific reason for failure (e.g., student not found, already marked)
            showNotification(data.message || 'Error marking attendance', 'error');
            
            // If already marked, add to cache so we don't spam the error
            if (data.message && data.message.includes('already marked')) {
                markedCache.set(studentId, now);
            }
        }
    } catch (err) {
        console.error('Mark Attendance Error:', err);
        showNotification('Connection error with server', 'error');
    }
};

const updateLogs = (name, id) => {
    const logItem = document.createElement('div');
    logItem.style.padding = '8px 0';
    logItem.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    logItem.innerHTML = `<span style="color: var(--accent);">✔</span> <b>${name}</b> (${id}) marked at ${new Date().toLocaleTimeString()}`;
    
    if (recentLogs.firstChild && recentLogs.firstChild.innerText === 'Waiting for detections...') {
        recentLogs.innerHTML = '';
    }
    recentLogs.prepend(logItem);
};

// Init
startVideo();
init();
