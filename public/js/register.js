const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const registerForm = document.getElementById('registerForm');
const status = document.getElementById('status');
const submitBtn = document.getElementById('submitBtn');
const notification = document.getElementById('notification');

let faceDescriptor = null;

// Notify helper
const showNotification = (message, type = 'success') => {
    notification.innerText = message;
    notification.className = `alert-${type}`;
    notification.style.display = 'block';
    notification.classList.add('alert-' + type);
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

// Load Models
const loadModels = async () => {
    status.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading AI Models...';
    try {
        // Using models from models directory
        await faceapi.nets.ssdMobilenetv1.loadFromUri('/models');
        await faceapi.nets.faceLandmark68Net.loadFromUri('/models');
        await faceapi.nets.faceRecognitionNet.loadFromUri('/models');
        
        status.innerHTML = '<i class="fas fa-check-circle"></i> Models Ready';
        status.className = 'status-badge status-online';
        submitBtn.disabled = false;
        
        // Start detection loop
        detectFace();
    } catch (err) {
        console.error('Model loading error:', err);
        status.innerHTML = '<i class="fas fa-times-circle"></i> Model Loading Error';
        status.className = 'status-badge status-error';
    }
};

// Detect Face Loop
const detectFace = async () => {
    const runDetection = async () => {
        // Use the existing overlay canvas instead of creating a new one
        const canvas = document.getElementById('overlay');
        if (!canvas) {
            console.error('Overlay canvas not found!');
            return;
        }

        // Wait for video to have dimensions
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            console.log('Waiting for video dimensions...');
            setTimeout(runDetection, 500);
            return;
        }

        const displaySize = { width: video.offsetWidth, height: video.offsetHeight };
        faceapi.matchDimensions(canvas, displaySize);

        console.log('Detection loop started at:', displaySize);

        // Handle window resize
        window.addEventListener('resize', () => {
            const newSize = { width: video.offsetWidth, height: video.offsetHeight };
            faceapi.matchDimensions(canvas, newSize);
        });

        const detectionInterval = setInterval(async () => {
            if (video.paused || video.ended) return;

            try {
                // Using a lower confidence for better detection in various conditions
                const detections = await faceapi.detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.2 }))
                    .withFaceLandmarks()
                    .withFaceDescriptors();

                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (detections.length > 0) {
                    const displaySize = { width: video.offsetWidth, height: video.offsetHeight };
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
                console.warn('Individual detection frame error:', err);
                // Don't stop the interval, just log and continue
            }
        }, 300);
    };

    // Ensure video is playing and metadata is loaded
    if (video.readyState >= 2) {
        runDetection();
    } else {
        video.addEventListener('loadeddata', runDetection);
    }
};

// Form Submission
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!faceDescriptor) {
        showNotification('No face detected! Please wait.', 'error');
        return;
    }

    const name = document.getElementById('studentName').value.trim();
    const studentId = document.getElementById('studentId').value.trim();
    const course = document.getElementById('studentCourse').value.trim();
    const year = document.getElementById('studentYear').value.trim();
    
    submitBtn.disabled = true;
    document.getElementById('btnText').innerText = 'Registering...';
    
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, studentId, course, year, descriptors: faceDescriptor })
        });

        const data = await res.json();
        if (data.success) {
            showNotification('Student registered successfully!', 'success');
            registerForm.reset();
        } else {
            showNotification(data.message || 'Registration failed!', 'error');
        }
    } catch (err) {
        showNotification('Server connection Error!', 'error');
    } finally {
        submitBtn.disabled = false;
        document.getElementById('btnText').innerText = 'Capture & Register';
    }
});

// Init
startVideo();
loadModels();
