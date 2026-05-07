const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const registerForm = document.getElementById('registerForm');
const status = document.getElementById('status');
const submitBtn = document.getElementById('submitBtn');
const notification = document.getElementById('notification');

let faceDescriptor = null;

const showNotification = (message, type = 'success') => {
    notification.innerText = message;
    notification.className = `alert-${type}`;
    notification.style.display = 'block';
    notification.classList.add('alert-' + type);
    setTimeout(() => {
        notification.style.display = 'none';
        notification.classList.remove('alert-' + type);
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

const loadModels = async () => {
    status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading AI Models...';
    try {
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        
        status.innerHTML = '<i class="fas fa-check-circle"></i> Models Ready';
        status.className = 'status-badge status-online';
        submitBtn.disabled = false;
        
        detectFace();
    } catch (err) {
        console.error('Model loading error:', err);
        status.innerHTML = '<i class="fas fa-times-circle"></i> Model Loading Error';
        status.className = 'status-badge status-error';
    }
};

const detectFace = async () => {
    const runDetection = async () => {
        const canvas = document.getElementById('overlay');
        if (!canvas) return;

        if (video.videoWidth === 0 || video.videoHeight === 0) {
            setTimeout(runDetection, 500);
            return;
        }

        const displaySize = { width: video.offsetWidth, height: video.offsetHeight };
        faceapi.matchDimensions(canvas, displaySize);

        setInterval(async () => {
            if (video.paused || video.ended) return;

            try {
                const detections = await faceapi.detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
                    .withFaceLandmarks()
                    .withFaceDescriptors();

                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (detections.length > 0) {
                    const resizedDetections = faceapi.resizeResults(detections, displaySize);
                    faceapi.draw.drawDetections(canvas, resizedDetections);
                    
                    if (detections.length === 1) {
                        faceDescriptor = Array.from(detections[0].descriptor);
                        document.getElementById('instructionText').innerText = "Face Detected! Ready to register.";
                        document.getElementById('instructionText').style.color = "#10b981";
                    } else {
                        faceDescriptor = null;
                        document.getElementById('instructionText').innerText = "Multiple faces detected! Please ensure only one person is in frame.";
                        document.getElementById('instructionText').style.color = "#ef4444";
                    }
                } else {
                    faceDescriptor = null;
                    document.getElementById('instructionText').innerText = "Scanning... Position your face clearly in the frame.";
                    document.getElementById('instructionText').style.color = "#94a3b8";
                }
            } catch (err) {
                console.warn('Detection error:', err);
            }
        }, 400);
    };

    if (video.readyState >= 2) runDetection();
    else video.addEventListener('loadeddata', runDetection);
};

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!faceDescriptor) {
        showNotification('No face detected! Please wait.', 'error');
        return;
    }

    const name = document.getElementById('teacherName').value.trim();
    const teacherId = document.getElementById('teacherId').value.trim();
    const subject = document.getElementById('teacherSubject').value.trim();
    const department = document.getElementById('teacherDepartment').value.trim();
    
    submitBtn.disabled = true;
    const btnText = document.getElementById('btnText');
    btnText.innerText = 'Registering...';
    
    try {
        const res = await fetch('/api/teachers/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, teacherId, subject, department, descriptors: faceDescriptor })
        });

        const data = await res.json();
        if (data.success) {
            showNotification('Teacher registered successfully!', 'success');
            registerForm.reset();
            faceDescriptor = null;
        } else {
            showNotification(data.message || 'Registration failed!', 'error');
        }
    } catch (err) {
        showNotification('Server connection Error!', 'error');
    } finally {
        submitBtn.disabled = false;
        btnText.innerText = 'Capture & Register';
    }
});

startVideo();
loadModels();
