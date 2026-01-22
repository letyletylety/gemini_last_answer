/**
 * Gemini Content Script - Sound Notification & Copy Logic
 * Includes defensive checks for chrome.storage to prevent crashes
 */

let isGenerating = false;

// Defensive storage access
function getSettings(callback) {
  const defaultSettings = {
    enableSound: true,
    soundType: 'triangle',
    volume: 0.15,
    frequency: 720
  };

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(defaultSettings, (items) => {
      if (chrome.runtime.lastError) {
        callback(defaultSettings);
      } else {
        callback(items);
      }
    });
  } else {
    // If context is lost or storage unavailable, use defaults
    callback(defaultSettings);
  }
}

async function playNotification() {
  getSettings(async (settings) => {
    if (!settings.enableSound) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') await audioCtx.resume();

      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = settings.soundType;
      oscillator.frequency.setValueAtTime(parseFloat(settings.frequency), audioCtx.currentTime);
      
      const vol = parseFloat(settings.volume);
      const now = audioCtx.currentTime;
      
      // Beep 1
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(vol, now + 0.02);
      gainNode.gain.linearRampToValueAtTime(vol, now + 0.1);
      gainNode.gain.linearRampToValueAtTime(0, now + 0.15);
      
      // Beep 2 (Reverb)
      const secondStart = now + 0.2;
      gainNode.gain.setValueAtTime(0, secondStart);
      gainNode.gain.linearRampToValueAtTime(vol, secondStart + 0.02);
      gainNode.gain.linearRampToValueAtTime(vol, secondStart + 0.3);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, secondStart + 1.5);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(secondStart + 1.6);
    } catch (e) {
      console.warn("Sound play failed (Interaction required?):", e);
    }
  });
}

function observeGemini() {
  const observer = new MutationObserver(() => {
    // Check if extension context is still valid
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) {
      observer.disconnect();
      return;
    }

    const stopButton = document.querySelector('button[aria-label*="Stop"], button[aria-label*="중지"], .stop-generating-button');
    
    if (stopButton && !isGenerating) {
      isGenerating = true;
    } else if (!stopButton && isGenerating) {
      isGenerating = false;
      setTimeout(playNotification, 300);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

// Start only if context is valid
if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
  console.log("Gemini Copy & Notify script active.");
  observeGemini();
}