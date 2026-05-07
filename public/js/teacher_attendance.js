const video = document.getElementById('video');
const loadingOverlay = document.getElementById('loadingOverlay');
const detectionStatus = document.getElementById('detectionStatus');
const attendanceInfo = document.getElementById('attendanceInfo');
const recentLogs = document.getElementById('recentLogs');
const notification = document.getElementById('notification');

let faceMatcher = null;
let labeledFaceDescriptors = [];
let markedCache = new Map(); // teacherId -> lastMarkedTimestamp

const showNotification = (message, type = 'success') => {
    notification.innerText = message;
    notification.className = `alert-${type}`;
    notification.style.display = 'block';
    
    // Clear and reset animation
    notification.style.animation = 'none';
    notification.offsetHeight; 
    notification.style.animation = 'slideIn 0.3s ease-out';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
};

const startVideo = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: {} });
        video.srcObject = stream;
    } catch (err) {
        console.error('Error accessing camera:', err);
        showNotification('Camera access denied!', 'error');
    }
};

const init = async () => {
    try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        
        const res = await fetch('/api/teachers');
        const teachers = await res.json();
        
        if (teachers.length === 0) {
            document.getElementById('loadingStatus').innerText = 'No teachers registered. Please register teachers first.';
            return;
        }

        labeledFaceDescriptors = teachers.map(t => {
            return new faceapi.LabeledFaceDescriptors(
                `${t.name} (${t.teacherId})|${t.subject}`, 
                [new Float32Array(t.descriptors)]
            );
        });

        faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.60);

        loadingOverlay.style.display = 'none';
        detectionStatus.innerHTML = '<i class="fas fa-check-circle"></i> Faculty Recognition Active';
        detectionStatus.className = 'status-badge status-online';
        
        startRecognition();
    } catch (err) {
        console.error('Init Error:', err);
        document.getElementById('loadingStatus').innerText = 'Error loading models or faculty data.';
    }
};

const startRecognition = async () => {
    const runDetection = async () => {
        const canvas = document.getElementById('overlay');
        if (!canvas) return;

        if (video.videoWidth === 0 || video.videoHeight === 0) {
            setTimeout(runDetection, 500);
            return;
        }

        const displaySize = { width: video.videoWidth, height: video.videoHeight };
        faceapi.matchDimensions(canvas, displaySize);

        setInterval(async () => {
            if (video.paused || video.ended) return;

            try {
                const detections = await faceapi.detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.25 }))
                    .withFaceLandmarks()
                    .withFaceDescriptors();

                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (detections.length > 0 && faceMatcher) {
                    const resizedDetections = faceapi.resizeResults(detections, displaySize);

                    resizedDetections.forEach(async (detection) => {
                        const result = faceMatcher.findBestMatch(detection.descriptor);
                        
                        const box = detection.detection.box;
                        const drawBox = new faceapi.draw.DrawBox(box, { label: result.toString() });
                        drawBox.draw(canvas);

                        if (result.label !== 'unknown') {
                            const [labelInfo, subject] = result.label.split('|');
                            const labelParts = labelInfo.split(' (');
                            const name = labelParts[0];
                            const teacherId = (labelParts[1]?.replace(')', '') || "Unknown").trim();
                            
                            detectionStatus.innerHTML = `<i class="fas fa-user-check"></i> Recognized: ${name}`;
                            await markTeacherAttendance(teacherId, name, subject, detection.descriptor);
                        }
                    });
                } else {
                    detectionStatus.innerHTML = '<i class="fas fa-sync fa-spin"></i> Scanning for faculty...';
                }
            } catch (err) {
                console.warn('Recognition frame error:', err);
            }
        }, 800);
    };

    if (video.readyState >= 2) runDetection();
    else video.addEventListener('loadeddata', runDetection);
};

const markTeacherAttendance = async (teacherId, name, subject, descriptor) => {
    const now = Date.now();
    if (markedCache.has(teacherId) && (now - markedCache.get(teacherId)) < 60000) {
        return; 
    }

    try {
        const res = await fetch('/api/teachers/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                teacherId, 
                descriptors: Array.from(descriptor)
            })
        });

        const data = await res.json();
        if (data.success) {
            markedCache.set(teacherId, now);
            
            attendanceInfo.style.display = 'block';
            document.getElementById('teacherNameDisplay').innerText = name;
            document.getElementById('teacherIdDisplay').innerText = `ID: ${teacherId}`;
            document.getElementById('teacherSubjectDisplay').innerText = `Subject: ${subject || 'N/A'}`;
            document.getElementById('timestampDisplay').innerText = new Date().toLocaleTimeString();
            
            showNotification(`Attendance marked for ${name}`, 'success');
            
            setTimeout(() => {
                attendanceInfo.style.display = 'none';
            }, 6000);
            
            updateLogs(name, teacherId);
        } else {
            showNotification(data.message || 'Error marking attendance', 'error');
            if (data.message && data.message.includes('already marked')) {
                markedCache.set(teacherId, now);
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
    
    if (recentLogs.firstChild && recentLogs.firstChild.innerText.includes('Waiting')) {
        recentLogs.innerHTML = '';
    }
    recentLogs.prepend(logItem);
};

startVideo();
init();
