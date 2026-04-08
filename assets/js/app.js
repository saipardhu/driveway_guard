let stream = null;
let autoScanActive = false;
let autoScanTimer = null;
let scanIntervalSec = 5;
let isAnalyzing = false;

const video = document.getElementById('videoFeed');
const canvas = document.getElementById('captureCanvas');

// Enumerate cameras on load
async function loadCameras() {
  try {
    // Request permission first
    const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
    tmp.getTracks().forEach((t) => t.stop());
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === 'videoinput');
    const sel = document.getElementById('cameraSelect');
    sel.innerHTML = '<option value="">Select camera...</option>';
    cams.forEach((c, i) => {
      const opt = document.createElement('option');
      opt.value = c.deviceId;
      opt.textContent = c.label || `Camera ${i + 1}`;
      sel.appendChild(opt);
    });
    log('info', `Found ${cams.length} camera(s)`);
  } catch (e) {
    log('warn', 'Camera permission denied or unavailable');
  }
}

async function startCamera() {
  const deviceId = document.getElementById('cameraSelect').value;
  if (!deviceId) {
    log('warn', 'Please select a camera first');
    return;
  }

  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
  }

  try {
    const constraints = { video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } } };
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    video.style.display = 'block';
    document.getElementById('noCameraMsg').style.display = 'none';
    document.getElementById('videoOverlay').style.display = 'block';
    document.getElementById('statusBanner').style.display = 'flex';

    setDot('cam', true, 'CAMERA LIVE');
    document.getElementById('scanNowBtn').disabled = false;
    document.getElementById('autoScanBtn').disabled = false;
    log('info', 'Camera stream started');
  } catch (e) {
    log('warn', `Failed to start camera: ${e.message}`);
  }
}

function setInterval_(val) {
  scanIntervalSec = val;
  document.querySelectorAll('.interval-btn').forEach((b) => {
    b.classList.toggle('active', parseInt(b.dataset.val, 10) === val);
  });
  if (autoScanActive) {
    clearAutoTimer();
    if (val > 0) {
      scheduleNext();
    } else {
      stopAutoScan();
    }
  }
}

function toggleAutoScan() {
  if (autoScanActive) {
    stopAutoScan();
  } else {
    startAutoScan();
  }
}

function startAutoScan() {
  if (scanIntervalSec === 0) {
    log('warn', 'Set an interval first (not Manual)');
    return;
  }
  autoScanActive = true;
  document.getElementById('autoScanBtn').textContent = 'Disable Auto-Scan';
  document.getElementById('autoScanBtn').classList.remove('btn-success');
  document.getElementById('autoScanBtn').classList.add('btn-danger');
  document.getElementById('scanLine').classList.add('active');
  log('info', `Auto-scan ON - every ${scanIntervalSec}s`);
  scheduleNext();
}

function stopAutoScan() {
  autoScanActive = false;
  clearAutoTimer();
  document.getElementById('autoScanBtn').textContent = 'Enable Auto-Scan';
  document.getElementById('autoScanBtn').classList.add('btn-success');
  document.getElementById('autoScanBtn').classList.remove('btn-danger');
  document.getElementById('scanLine').classList.remove('active');
  log('info', 'Auto-scan disabled');
}

function scheduleNext() {
  autoScanTimer = setTimeout(() => {
    scanNow();
    if (autoScanActive) {
      scheduleNext();
    }
  }, scanIntervalSec * 1000);
}

function clearAutoTimer() {
  if (autoScanTimer) {
    clearTimeout(autoScanTimer);
    autoScanTimer = null;
  }
}

async function scanNow() {
  if (isAnalyzing || !stream) return;
  isAnalyzing = true;
  setDot('ai', true, 'AI ANALYZING');
  document.getElementById('analyzingBadge').classList.add('visible');
  document.getElementById('scanNowBtn').disabled = true;

  try {
    // Capture frame
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const base64Image = canvas.toDataURL('image/jpeg', 0.85).split(',')[1];

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: base64Image }
            },
            {
              type: 'text',
              text: `You are a driveway safety assistant. Analyze this image from a camera mounted on a house window overlooking the road outside a driveway.

Determine if it is SAFE for a car to exit the driveway. Focus on:
- Are there any cars, trucks, motorcycles, cyclists, or pedestrians visible on the road?
- Specifically check the LEFT side and RIGHT side of the road separately.

Respond ONLY with a JSON object (no markdown, no explanation) in this exact format:
{
  "safe": true or false,
  "leftSide": "clear" or "detected",
  "rightSide": "clear" or "detected",
  "confidence": 0-100,
  "summary": "One short sentence about what you see",
  "details": "Brief description of detected objects if any"
}`
            }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = data.content.map((c) => c.text || '').join('');

    let result;
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      result = JSON.parse(clean);
    } catch (e) {
      throw new Error('Could not parse AI response');
    }

    applyResult(result);
    document.getElementById('lastCheckTime').textContent = new Date().toLocaleTimeString();
  } catch (e) {
    log('warn', `Scan error: ${e.message}`);
    setBigStatus('warning', 'ERROR', 'Scan failed', e.message);
  } finally {
    isAnalyzing = false;
    setDot('ai', false, 'AI STANDBY');
    document.getElementById('analyzingBadge').classList.remove('visible');
    document.getElementById('scanNowBtn').disabled = false;
  }
}

function applyResult(r) {
  const safe = r.safe;
  const left = r.leftSide === 'detected';
  const right = r.rightSide === 'detected';
  const conf = r.confidence || 0;

  // Update zone cards
  updateCard('left', left);
  updateCard('right', right);

  // Confidence bar
  document.getElementById('confPct').textContent = `${conf}%`;
  document.getElementById('confBar').style.width = `${conf}%`;
  document.getElementById('confBar').style.background = safe ? 'var(--safe)' : 'var(--danger)';

  if (safe) {
    setBigStatus('safe', 'SAFE', 'Clear to exit', r.summary);
    flash('green');
    log('safe', `CLEAR - ${r.summary}`);
  } else {
    setBigStatus('danger', 'STOP', 'Vehicle detected!', r.details || r.summary);
    flash('red');
    log('danger', `STOP - ${r.summary}`);
  }
}

function updateCard(side, detected) {
  const card = document.getElementById(`${side}Card`);
  const status = document.getElementById(`${side}Status`);
  card.className = `detection-card ${detected ? 'detected' : 'clear'}`;
  status.textContent = detected ? 'VEHICLE' : 'CLEAR';
}

function setBigStatus(cls, label, title, sub) {
  const el = document.getElementById('bigStatus');
  el.className = `big-status ${cls}`;
  el.textContent = label;
  document.getElementById('statusTitle').textContent = title;
  document.getElementById('statusSub').textContent = sub || '';
}

function flash(color) {
  const el = document.getElementById('alertFlash');
  el.className = `alert-flash ${color}`;
  el.style.opacity = '1';
  setTimeout(() => {
    el.style.opacity = '0';
  }, 300);
}

function setDot(type, active, label) {
  document.getElementById(`${type}Dot`).className = `status-dot${active ? ' active' : ''}`;
  document.getElementById(type === 'cam' ? 'camStatusText' : 'aiStatusText').textContent = label;
}

function log(type, msg) {
  const container = document.getElementById('logEntries');
  const entry = document.createElement('div');
  entry.className = 'log-entry';
  const t = new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  entry.innerHTML = `<span class="log-time">${t}</span><span class="log-msg ${type}">${msg}</span>`;
  container.prepend(entry);
  // Trim to 50 entries
  while (container.children.length > 50) container.removeChild(container.lastChild);
}

// Expose functions used by inline button handlers.
window.startCamera = startCamera;
window.setInterval_ = setInterval_;
window.toggleAutoScan = toggleAutoScan;
window.scanNow = scanNow;

// Init
loadCameras();
log('info', 'DrivewayGuard initialized');
log('info', 'Select camera and start monitoring');
