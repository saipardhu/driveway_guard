let stream = null;
let autoScanActive = false;
let autoScanTimer = null;
let scanIntervalSec = 5;
let isAnalyzing = false;
let baselineFrame = null;
let sensitivity = 55;

const video = document.getElementById('videoFeed');
const canvas = document.getElementById('captureCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const els = {
  autoScanBtn: document.getElementById('autoScanBtn'),
  calibrateBtn: document.getElementById('calibrateBtn'),
  cameraSelect: document.getElementById('cameraSelect'),
  noCameraMsg: document.getElementById('noCameraMsg'),
  scanLine: document.getElementById('scanLine'),
  scanNowBtn: document.getElementById('scanNowBtn'),
  sensitivityRange: document.getElementById('sensitivityRange'),
  sensitivityValue: document.getElementById('sensitivityValue'),
  startCameraBtn: document.getElementById('startCameraBtn'),
  statusBanner: document.getElementById('statusBanner'),
  videoOverlay: document.getElementById('videoOverlay')
};

async function loadCameras() {
  if (!navigator.mediaDevices?.getUserMedia) {
    log('warn', 'Camera access requires a modern browser and a secure page');
    return;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    renderCameraOptions(devices.filter((device) => device.kind === 'videoinput'));
  } catch (error) {
    log('warn', `Could not list cameras: ${error.message}`);
  }
}

function renderCameraOptions(cameras) {
  els.cameraSelect.innerHTML = '<option value="">Default camera</option>';
  cameras.forEach((camera, index) => {
    const option = document.createElement('option');
    option.value = camera.deviceId;
    option.textContent = camera.label || `Camera ${index + 1}`;
    els.cameraSelect.appendChild(option);
  });
  log('info', cameras.length ? `Found ${cameras.length} camera(s)` : 'No cameras listed yet');
}

async function refreshCameraLabels() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    renderCameraOptions(devices.filter((device) => device.kind === 'videoinput'));
  } catch {
    // Labels are a nice-to-have after permission is granted.
  }
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    log('warn', 'Camera access is not supported by this browser');
    return;
  }

  stopAutoScan({ silent: true });
  stopStream();
  resetDetectionState();

  const deviceId = els.cameraSelect.value;
  const videoConstraints = {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: 'environment'
  };

  if (deviceId) {
    videoConstraints.deviceId = { exact: deviceId };
    delete videoConstraints.facingMode;
  }

  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints, audio: false });
    video.srcObject = stream;
    await video.play();

    els.noCameraMsg.hidden = true;
    els.videoOverlay.classList.add('visible');
    els.statusBanner.classList.add('visible');
    els.scanNowBtn.disabled = false;
    els.autoScanBtn.disabled = false;
    els.calibrateBtn.disabled = false;
    els.startCameraBtn.textContent = 'Restart Camera';

    setDot('cam', true, 'CAMERA LIVE');
    setBigStatus('idle', 'READY', 'Camera is live', 'Calibrate on a clear driveway view, then scan');
    await refreshCameraLabels();
    log('info', 'Camera stream started');
  } catch (error) {
    els.noCameraMsg.hidden = false;
    els.videoOverlay.classList.remove('visible');
    els.scanNowBtn.disabled = true;
    els.autoScanBtn.disabled = true;
    els.calibrateBtn.disabled = true;
    setDot('cam', false, 'CAMERA OFFLINE');
    setBigStatus('warning', 'ERROR', 'Camera failed', error.message);
    log('warn', `Failed to start camera: ${error.message}`);
  }
}

function stopStream() {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  stream = null;
}

function resetDetectionState() {
  baselineFrame = null;
  updateCard('left', null);
  updateCard('right', null);
  updateScore(0, true);
  document.getElementById('lastCheckTime').textContent = '-';
}

function setInterval_(value) {
  scanIntervalSec = value;
  document.querySelectorAll('.interval-btn').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.val) === value);
  });

  if (!autoScanActive) return;
  if (value === 0) {
    stopAutoScan();
    return;
  }
  scheduleNext();
}

function toggleAutoScan() {
  if (autoScanActive) {
    stopAutoScan();
  } else {
    startAutoScan();
  }
}

function startAutoScan() {
  if (!stream) {
    log('warn', 'Start the camera before enabling auto-scan');
    return;
  }
  if (scanIntervalSec === 0) {
    log('warn', 'Choose a timed interval before enabling auto-scan');
    return;
  }

  autoScanActive = true;
  els.autoScanBtn.textContent = 'Disable Auto-Scan';
  els.autoScanBtn.classList.remove('btn-success');
  els.autoScanBtn.classList.add('btn-danger');
  els.scanLine.classList.add('active');
  log('info', `Auto-scan on every ${scanIntervalSec}s`);
  scheduleNext();
}

function stopAutoScan(options = {}) {
  const wasActive = autoScanActive;
  autoScanActive = false;
  clearAutoTimer();
  els.autoScanBtn.textContent = 'Enable Auto-Scan';
  els.autoScanBtn.classList.add('btn-success');
  els.autoScanBtn.classList.remove('btn-danger');
  els.scanLine.classList.remove('active');
  if (wasActive && !options.silent) log('info', 'Auto-scan disabled');
}

function scheduleNext() {
  clearAutoTimer();
  autoScanTimer = window.setTimeout(async () => {
    await scanNow();
    if (autoScanActive) scheduleNext();
  }, scanIntervalSec * 1000);
}

function clearAutoTimer() {
  if (autoScanTimer) {
    window.clearTimeout(autoScanTimer);
    autoScanTimer = null;
  }
}

function captureFrame() {
  if (!video.videoWidth || !video.videoHeight) {
    throw new Error('Video is not ready yet');
  }

  const width = 320;
  const height = Math.max(180, Math.round(width * (video.videoHeight / video.videoWidth)));
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(video, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

function calibrateBaseline() {
  if (!stream) {
    log('warn', 'Start the camera before calibrating');
    return;
  }

  try {
    baselineFrame = captureFrame();
    updateCard('left', false);
    updateCard('right', false);
    updateScore(0, true);
    setBigStatus('safe', 'CLEAR', 'Baseline calibrated', 'Scan will compare new frames against this view');
    log('info', 'Clear-view baseline saved');
  } catch (error) {
    log('warn', `Calibration failed: ${error.message}`);
  }
}

async function scanNow() {
  if (isAnalyzing || !stream) return;
  isAnalyzing = true;
  setDot('ai', true, 'DETECTOR ANALYZING');
  document.getElementById('analyzingBadge').classList.add('visible');
  els.scanNowBtn.disabled = true;

  try {
    const frame = captureFrame();
    if (!baselineFrame) {
      baselineFrame = frame;
      setBigStatus('idle', 'SET', 'Baseline captured', 'Run another scan to detect movement');
      log('info', 'Initial baseline captured');
      return;
    }

    const result = analyzeMotion(frame, baselineFrame);
    baselineFrame = blendFrames(baselineFrame, frame, result.anyDetected ? 0.02 : 0.15);
    applyResult(result);
    document.getElementById('lastCheckTime').textContent = new Date().toLocaleTimeString();
  } catch (error) {
    log('warn', `Scan error: ${error.message}`);
    setBigStatus('warning', 'ERROR', 'Scan failed', error.message);
  } finally {
    isAnalyzing = false;
    setDot('ai', false, 'DETECTOR STANDBY');
    document.getElementById('analyzingBadge').classList.remove('visible');
    els.scanNowBtn.disabled = !stream;
  }
}

function analyzeMotion(frame, baseline) {
  const zones = {
    left: { x1: 0.04, x2: 0.32, y1: 0.1, y2: 0.9 },
    right: { x1: 0.68, x2: 0.96, y1: 0.1, y2: 0.9 }
  };
  const leftScore = scoreZone(frame, baseline, zones.left);
  const rightScore = scoreZone(frame, baseline, zones.right);
  const threshold = mapSensitivityToThreshold(sensitivity);
  const leftDetected = leftScore >= threshold;
  const rightDetected = rightScore >= threshold;
  const maxScore = Math.max(leftScore, rightScore);

  return {
    anyDetected: leftDetected || rightDetected,
    confidence: Math.min(100, Math.round((maxScore / threshold) * 100)),
    leftDetected,
    leftScore,
    rightDetected,
    rightScore,
    summary: buildSummary(leftDetected, rightDetected, leftScore, rightScore)
  };
}

function scoreZone(frame, baseline, zone) {
  const width = frame.width;
  const height = frame.height;
  const xStart = Math.floor(width * zone.x1);
  const xEnd = Math.floor(width * zone.x2);
  const yStart = Math.floor(height * zone.y1);
  const yEnd = Math.floor(height * zone.y2);
  let changed = 0;
  let total = 0;
  let diffSum = 0;

  for (let y = yStart; y < yEnd; y += 2) {
    for (let x = xStart; x < xEnd; x += 2) {
      const index = (y * width + x) * 4;
      const currentLum = luminance(frame.data, index);
      const baseLum = luminance(baseline.data, index);
      const diff = Math.abs(currentLum - baseLum);
      total++;
      diffSum += diff;
      if (diff > 28) changed++;
    }
  }

  const changedRatio = changed / Math.max(1, total);
  const averageDiff = diffSum / Math.max(1, total);
  return Math.round((changedRatio * 80) + (averageDiff * 0.6));
}

function luminance(data, index) {
  return (data[index] * 0.299) + (data[index + 1] * 0.587) + (data[index + 2] * 0.114);
}

function mapSensitivityToThreshold(value) {
  return 52 - (value * 0.42);
}

function blendFrames(previous, current, alpha) {
  const blended = new ImageData(previous.width, previous.height);
  for (let i = 0; i < previous.data.length; i += 4) {
    blended.data[i] = (previous.data[i] * (1 - alpha)) + (current.data[i] * alpha);
    blended.data[i + 1] = (previous.data[i + 1] * (1 - alpha)) + (current.data[i + 1] * alpha);
    blended.data[i + 2] = (previous.data[i + 2] * (1 - alpha)) + (current.data[i + 2] * alpha);
    blended.data[i + 3] = 255;
  }
  return blended;
}

function applyResult(result) {
  updateCard('left', result.leftDetected);
  updateCard('right', result.rightDetected);
  updateScore(result.confidence, !result.anyDetected);

  if (result.anyDetected) {
    setBigStatus('danger', 'STOP', 'Motion detected', result.summary);
    flash('red');
    log('danger', `STOP - ${result.summary}`);
  } else {
    setBigStatus('safe', 'CLEAR', 'No motion in zones', result.summary);
    flash('green');
    log('safe', `CLEAR - ${result.summary}`);
  }
}

function buildSummary(leftDetected, rightDetected, leftScore, rightScore) {
  const left = `left ${Math.round(leftScore)}`;
  const right = `right ${Math.round(rightScore)}`;
  if (leftDetected && rightDetected) return `Movement in both road zones (${left}, ${right})`;
  if (leftDetected) return `Movement in the left road zone (${left}, ${right})`;
  if (rightDetected) return `Movement in the right road zone (${left}, ${right})`;
  return `Both road zones look still (${left}, ${right})`;
}

function updateCard(side, detected) {
  const card = document.getElementById(`${side}Card`);
  const status = document.getElementById(`${side}Status`);
  card.className = `detection-card ${detected === null ? '' : detected ? 'detected' : 'clear'}`;
  status.textContent = detected === null ? '-' : detected ? 'MOTION' : 'CLEAR';
}

function updateScore(score, safe) {
  const boundedScore = Math.max(0, Math.min(100, Math.round(score)));
  document.getElementById('confPct').textContent = `${boundedScore}%`;
  const bar = document.getElementById('confBar');
  bar.style.width = `${boundedScore}%`;
  bar.style.background = safe ? 'var(--safe)' : 'var(--danger)';
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
  window.setTimeout(() => {
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
  const time = document.createElement('span');
  const message = document.createElement('span');
  const timestamp = new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  entry.className = 'log-entry';
  time.className = 'log-time';
  time.textContent = timestamp;
  message.className = `log-msg ${type}`;
  message.textContent = msg;
  entry.append(time, message);
  container.prepend(entry);

  while (container.children.length > 50) {
    container.removeChild(container.lastChild);
  }
}

function bindEvents() {
  els.startCameraBtn.addEventListener('click', startCamera);
  els.scanNowBtn.addEventListener('click', scanNow);
  els.autoScanBtn.addEventListener('click', toggleAutoScan);
  els.calibrateBtn.addEventListener('click', calibrateBaseline);
  els.sensitivityRange.addEventListener('input', (event) => {
    sensitivity = Number(event.target.value);
    els.sensitivityValue.textContent = sensitivity;
  });
  document.querySelectorAll('.interval-btn').forEach((button) => {
    button.addEventListener('click', () => setInterval_(Number(button.dataset.val)));
  });
}

window.addEventListener('beforeunload', stopStream);
bindEvents();
loadCameras();
log('info', 'DrivewayGuard initialized');
log('info', 'Start camera, calibrate clear view, then scan');
