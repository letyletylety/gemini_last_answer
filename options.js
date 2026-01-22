/**
 * Options Page Logic - Gemini Copy & Notify
 */

// 1. 최우선 실행 로그 (스크립트 로드 확인용)
console.info("Gemini Options: Script is loading...");

// 전역 에러 캡처 (로그가 안 찍히는 원인을 파악하기 위함)
window.onerror = function(msg, url, line) {
  console.error("Global Error: " + msg + " at line " + line);
};

// 2. UI 요소 실시간 업데이트 (슬라이더 조절 시 텍스트 변경)
const initUI = () => {
  console.log("initUI: Binding slider events...");
  const volumeSlider = document.getElementById('volume');
  const freqSlider = document.getElementById('frequency');
  const volLabel = document.getElementById('volValue');
  const freqLabel = document.getElementById('freqValue');

  if (volumeSlider && volLabel) {
    volumeSlider.oninput = (e) => {
      console.log("Volume changed:", e.target.value);
      volLabel.textContent = e.target.value;
    };
  } else {
    console.warn("Volume elements not found");
  }

  if (freqSlider && freqLabel) {
    freqSlider.oninput = (e) => {
      console.log("Frequency changed:", e.target.value);
      freqLabel.textContent = e.target.value;
    };
  } else {
    console.warn("Frequency elements not found");
  }
};

// 3. 소리 재생 함수
const playTestSound = async () => {
  console.log("playTestSound: Attempting to play sound...");
  
  const soundType = document.getElementById('soundType').value;
  const volume = parseFloat(document.getElementById('volume').value);
  const frequency = parseFloat(document.getElementById('frequency').value);

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) {
      console.error("AudioContext not supported");
      return;
    }
    
    const audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = soundType;
    oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    
    const now = audioCtx.currentTime;
    const vol = volume;

    // 더블 비프음
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(vol, now + 0.02);
    gainNode.gain.linearRampToValueAtTime(vol, now + 0.1);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.15);
    
    const secondStart = now + 0.2;
    gainNode.gain.setValueAtTime(0, secondStart);
    gainNode.gain.linearRampToValueAtTime(vol, secondStart + 0.02);
    gainNode.gain.linearRampToValueAtTime(vol, secondStart + 0.3);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, secondStart + 1.5);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start(now);
    oscillator.stop(secondStart + 1.6);
    
    console.log("Sound played successfully!");
  } catch (err) {
    console.error("Audio playback error:", err);
  }
};

// 4. 설정 저장 및 불러오기 (안전장치 추가)
const saveOptions = () => {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.error("Storage API unavailable");
    alert("환경 에러: 확장 프로그램을 새로고침하세요.");
    return;
  }

  const settings = {
    enableSound: document.getElementById('enableSound').checked,
    soundType: document.getElementById('soundType').value,
    volume: document.getElementById('volume').value,
    frequency: document.getElementById('frequency').value
  };

  chrome.storage.sync.set(settings, () => {
    console.log("Settings saved to storage:", settings);
    const status = document.getElementById('status');
    if (status) {
      status.textContent = '저장 완료!';
      setTimeout(() => { status.textContent = ''; }, 2000);
    }
  });
};

const restoreOptions = () => {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    console.warn("Storage API unavailable. Using defaults.");
    return;
  }

  chrome.storage.sync.get({
    enableSound: true,
    soundType: 'square',
    volume: '0.15',
    frequency: '880'
  }, (items) => {
    console.log("Restoring settings:", items);
    if (document.getElementById('enableSound')) document.getElementById('enableSound').checked = items.enableSound;
    if (document.getElementById('soundType')) document.getElementById('soundType').value = items.soundType;
    if (document.getElementById('volume')) document.getElementById('volume').value = items.volume;
    if (document.getElementById('frequency')) document.getElementById('frequency').value = items.frequency;
    if (document.getElementById('volValue')) document.getElementById('volValue').textContent = items.volume;
    if (document.getElementById('freqValue')) document.getElementById('freqValue').textContent = items.frequency;
  });
};

// 5. 초기화 실행 (순서가 매우 중요함)
document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM Content Loaded. Initializing...");

  // 1순위: UI 인터랙션 (에러가 나도 소리는 나야 하니까)
  initUI();

  // 2순위: 버튼 연결
  const testBtn = document.getElementById('testSound');
  const saveBtn = document.getElementById('save');
  
  if (testBtn) testBtn.onclick = playTestSound;
  if (saveBtn) saveBtn.onclick = saveOptions;

  // 3순위: 데이터 복구
  try {
    restoreOptions();
  } catch (e) {
    console.error("Restore failed:", e);
  }
  
  console.info("Gemini Options: Initialization sequence complete.");
});