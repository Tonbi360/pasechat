// ⚙️ CONFIGURATION
const BOT_TOKEN = '8393616041:AAFiikss8moFzdTA6xF-QmEKZG_zkYL41DQ'; 
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`; // Fixed: removed space

// 🌍 Global State
let myUserId = localStorage.getItem('pase_chatId');
let countdownActive = false;
let lastUpdateId = parseInt(localStorage.getItem('pase_lastUpdateId')) || 0;

// 🎟️ Token System State
let tokens = parseInt(localStorage.getItem('pase_tokens')) || 1;
let knownContacts = JSON.parse(localStorage.getItem('pase_knownContacts')) || [];

// 📊 Message Count for Profile Reveal
let messageCounts = JSON.parse(localStorage.getItem('pase_messageCounts')) || {};

// 👻 Ghost Reply State
let replyingTo = null;

// 🗄️ Track Telegram message IDs we've SENT
let sentTelegramMsgIds = JSON.parse(localStorage.getItem('pase_sentTelegramMsgIds')) || {};

// 📅 Scheduled Messages State
let scheduledMessages = JSON.parse(localStorage.getItem('pase_scheduledMessages')) || [];

// ⏱️ Countdown Timer State
let countdownInterval = null;

// 🎙️ Voice Window State
let voiceWindow = JSON.parse(localStorage.getItem('pase_voiceWindow')) || null;
let voiceExitTimer = null;

// 📄 PAGINATION STATE (Feature E) - CLEAN, NO MOCK DATA
let currentPage = 1;
const MESSAGES_PER_PAGE = 20;
let hasMoreMessages = false; // Will be true when we have history API
let isLoadingOlder = false;
let messageBuffer = []; // Stores live messages for future pagination

// 🚀 Initialize
window.onload = () => {
  checkWeeklyReset();
  updateTokenUI();
  if (myUserId) {
    showChatScreen();
    initPagination();
  }
  startPolling();
  checkScheduledMessages();
  checkVoiceWindow();
  
  const header = document.querySelector('#chat-screen header h2');
  if (header) {
    header.style.cursor = 'pointer';
    header.addEventListener('click', openProfile);
  }
  
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const scheduleInput = document.getElementById('schedule-time');
  if (scheduleInput) {
    scheduleInput.min = now.toISOString().slice(0, 16);
  }
  
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
};

// 🗓️ Weekly Reset
function checkWeeklyReset() {
  const now = new Date();
  const day = now.getDay();
  const last = localStorage.getItem('pase_lastReset');
  if (day === 0 && (!last || now - new Date(last) > 604800000)) {
    tokens = 1;
    localStorage.setItem('pase_tokens', tokens);
    localStorage.setItem('pase_lastReset', now.toISOString());
  }
}

function updateTokenUI() {
  const el = document.getElementById('token-display');
  if (el) {
    el.innerText = `🎟️ ${tokens}`;
    el.className = tokens > 0 ? 'token-ok' : 'token-low';
  }
}

// 🔐 Login
function login() {
  const userId = document.getElementById('user-id').value.trim();
  if (!userId) return alert('Please enter your Telegram User ID');
  localStorage.setItem('pase_chatId', userId);
  myUserId = userId;
  showChatScreen();
}

function showChatScreen() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('chat-screen').classList.remove('hidden');
  updateTokenUI();
}

function logout() {
  localStorage.removeItem('pase_chatId');
  location.reload();
}

// 📊 Profile Reveal
function incrementMessageCount() {
  messageCounts[myUserId] = (messageCounts[myUserId] || 0) + 1;
  localStorage.setItem('pase_messageCounts', JSON.stringify(messageCounts));
  return messageCounts[myUserId];
}

function getRevealLevel(count) {
  if (count >= 50) return 3;
  if (count >= 10) return 2;
  return 1;
}

function openProfile() {
  const count = messageCounts[myUserId] || 0;
  const level = getRevealLevel(count);
  document.getElementById('profile-name').innerText = `User (${count} messages)`;
  
  document.querySelectorAll('.profile-section').forEach(section => {
    section.classList.add('locked');
    section.querySelector('.lock-msg')?.classList.remove('hidden');
    section.querySelector('.unlock-content')?.classList.add('hidden');
  });
  
  if (level >= 2) {
    const level2 = document.getElementById('level-2');
    level2.classList.remove('locked');
    level2.querySelector('.lock-msg').classList.add('hidden');
    level2.querySelector('.unlock-content').classList.remove('hidden');
  }
  if (level >= 3) {
    const level3 = document.getElementById('level-3');
    level3.classList.remove('locked');
    level3.querySelector('.lock-msg').classList.add('hidden');
    level3.querySelector('.unlock-content').classList.remove('hidden');
  }
  document.getElementById('profile-modal').classList.remove('hidden');
}

function closeProfile() {
  document.getElementById('profile-modal').classList.add('hidden');
}

// 👻 Ghost Reply
function startReply(telegramMsgId, text) {
  replyingTo = { 
    telegramMsgId: parseInt(telegramMsgId), 
    text: text.substring(0, 50) + (text.length > 50 ? '...' : '') 
  };
  document.getElementById('reply-text').innerText = replyingTo.text;
  document.getElementById('reply-preview').classList.remove('hidden');
}

function cancelReply() {
  replyingTo = null;
  document.getElementById('reply-preview').classList.add('hidden');
}

// 📅 Scheduled Messages Functions
function toggleScheduled() {
  const panel = document.getElementById('scheduled-panel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    renderScheduledMessages();
    startCountdownTimer();
  } else {
    stopCountdownTimer();
  }
}

function openScheduleModal() {
  document.getElementById('schedule-text').value = '';
  document.getElementById('schedule-modal').classList.remove('hidden');
  
  const now = new Date();
  now.setMinutes(now.getMinutes() + 1);
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('schedule-time').value = now.toISOString().slice(0, 16);
}

function closeScheduleModal() {
  document.getElementById('schedule-modal').classList.add('hidden');
}

function setQuickTime(minutes) {
  const now = new Date();
  now.setMinutes(now.getMinutes() + minutes);
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  document.getElementById('schedule-time').value = now.toISOString().slice(0, 16);
}

function confirmSchedule() {
  const text = document.getElementById('schedule-text').value.trim();
  const time = document.getElementById('schedule-time').value;
  
  if (!text || !time) return alert('Please fill in both fields');
  
  const scheduledTime = new Date(time).getTime();
  const now = Date.now();
  
  if (scheduledTime <= now) return alert('Please choose a future time');
  
  const newScheduled = {
    id: Date.now(),
    text: text,
    scheduledTime: scheduledTime,
    createdAt: now
  };
  
  scheduledMessages.push(newScheduled);
  localStorage.setItem('pase_scheduledMessages', JSON.stringify(scheduledMessages));
  
  closeScheduleModal();
  renderScheduledMessages();
  alert('✅ Message scheduled for ' + new Date(scheduledTime).toLocaleString());
}

function cancelScheduled(id) {
  scheduledMessages = scheduledMessages.filter(msg => msg.id !== id);
  localStorage.setItem('pase_scheduledMessages', JSON.stringify(scheduledMessages));
  renderScheduledMessages();
}

function startCountdownTimer() {
  if (countdownInterval) clearInterval(countdownInterval);
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);
}

function stopCountdownTimer() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function updateCountdown() {
  const now = Date.now();
  const upcoming = scheduledMessages
    .filter(msg => msg.scheduledTime > now)
    .sort((a, b) => a.scheduledTime - b.scheduledTime)[0];
  
  const countdownEl = document.getElementById('next-message-countdown');
  const timerEl = document.getElementById('countdown-timer');
  
  if (upcoming) {
    countdownEl.classList.remove('hidden');
    const diff = upcoming.scheduledTime - now;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    timerEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    countdownEl.classList.add('hidden');
  }
}

function renderScheduledMessages() {
  const list = document.getElementById('scheduled-list');
  const empty = document.getElementById('scheduled-empty');
  
  list.innerHTML = '';
  
  if (scheduledMessages.length === 0) {
    empty.classList.remove('hidden');
    document.getElementById('next-message-countdown')?.classList.add('hidden');
    return;
  }
  
  empty.classList.add('hidden');
  
  scheduledMessages.sort((a, b) => a.scheduledTime - b.scheduledTime).forEach(msg => {
    const div = document.createElement('div');
    div.className = 'scheduled-item';
    
    const timeStr = new Date(msg.scheduledTime).toLocaleString();
    const isSoon = msg.scheduledTime - Date.now() < 60000;
    
    div.innerHTML = `
      <p>${msg.text}</p>
      <p class="time ${isSoon ? 'urgent' : ''}">🕐 ${timeStr}</p>
      <button onclick="cancelScheduled(${msg.id})">Cancel</button>
    `;
    list.appendChild(div);
  });
  
  updateCountdown();
}

function checkScheduledMessages() {
  setInterval(() => {
    const now = Date.now();
    const due = scheduledMessages.filter(msg => msg.scheduledTime <= now);
    
    if (due.length > 0) {
      due.forEach(msg => {
        sendScheduledMessage(msg);
        scheduledMessages = scheduledMessages.filter(m => m.id !== msg.id);
        localStorage.setItem('pase_scheduledMessages', JSON.stringify(scheduledMessages));
      });
      renderScheduledMessages();
    }
    
    if (!document.getElementById('scheduled-panel')?.classList.contains('hidden')) {
      updateCountdown();
    }
  }, 1000);
}

async function sendScheduledMessage(msg) {
  try {
    const payload = { chat_id: myUserId, text: msg.text };
    const res = await fetch(`${API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    
    if (res.ok && data.ok) {
      const telegramMsgId = data.result.message_id;
      sentTelegramMsgIds[telegramMsgId] = true;
      localStorage.setItem('pase_sentTelegramMsgIds', JSON.stringify(sentTelegramMsgIds));
      
      incrementMessageCount();
      bufferAndRenderMessage(msg.text, 'sent', telegramMsgId);
      startCountdown();
      
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Pase Chat', {
          body: `Sent: "${msg.text.substring(0, 30)}${msg.text.length > 30 ? '...' : ''}"`,
          icon: '🚶'
        });
      }
    }
  } catch (err) {
    console.error('Scheduled send error:', err);
  }
}

// 🎙️ Voice Window Functions
function checkVoiceWindow() {
  if (!voiceWindow) return hideVoiceBanner();
  
  const now = Date.now();
  const start = voiceWindow.startTime;
  const end = voiceWindow.endTime;
  
  if (now >= start && now <= end) {
    showVoiceBanner(end - now);
    enableVoiceMode();
  } else if (now > end) {
    voiceWindow = null;
    localStorage.removeItem('pase_voiceWindow');
    hideVoiceBanner();
    disableVoiceMode();
  } else {
    hideVoiceBanner();
    disableVoiceMode();
  }
}

function showVoiceBanner(remainingMs) {
  const banner = document.getElementById('voice-window-banner');
  const countdown = document.getElementById('voice-countdown');
  
  if (!banner) return;
  
  banner.classList.remove('hidden');
  
  const update = () => {
    const now = Date.now();
    const left = voiceWindow.endTime - now;
    if (left <= 0) {
      hideVoiceBanner();
      disableVoiceMode();
      return;
    }
    const mins = Math.floor(left / 60000);
    const secs = Math.floor((left % 60000) / 1000);
    countdown.textContent = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
  };
  
  update();
  const interval = setInterval(update, 1000);
  banner.dataset.interval = interval;
}

function hideVoiceBanner() {
  const banner = document.getElementById('voice-window-banner');
  if (!banner) return;
  banner.classList.add('hidden');
  if (banner.dataset.interval) {
    clearInterval(parseInt(banner.dataset.interval));
    delete banner.dataset.interval;
  }
}

function enableVoiceMode() {
  const inputArea = document.querySelector('.input-area');
  if (inputArea) inputArea.classList.add('voice-mode');
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.disabled = true;
  const micBtn = document.getElementById('mic-btn');
  if (micBtn) micBtn.disabled = false;
}

function disableVoiceMode() {
  const inputArea = document.querySelector('.input-area');
  if (inputArea) inputArea.classList.remove('voice-mode');
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) sendBtn.disabled = false;
}

function exitVoiceWindow() {
  const modal = document.getElementById('voice-exit-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeVoiceExitModal() {
  const modal = document.getElementById('voice-exit-modal');
  if (modal) modal.classList.add('hidden');
}

function confirmExitVoiceWindow() {
  closeVoiceExitModal();
  disableVoiceMode();
  
  if (voiceExitTimer) clearTimeout(voiceExitTimer);
  voiceExitTimer = setTimeout(() => {
    if (voiceWindow && Date.now() <= voiceWindow.endTime) {
      enableVoiceMode();
    }
  }, 5000);
  
  const originalSend = window.sendMessage;
  window.sendMessage = function() {
    if (voiceExitTimer) clearTimeout(voiceExitTimer);
    if (voiceWindow && Date.now() <= voiceWindow.endTime) {
      enableVoiceMode();
    }
    window.sendMessage = originalSend;
    return originalSend.apply(this, arguments);
  };
}

// 🎤 Send Voice Note (placeholder)
async function sendVoiceNote() {
  if (!myUserId) return;
  alert('🎤 Voice notes require Telegram Bot API setup.\n\nFor now: Record in Telegram → Forward to this chat!');
}

// Test helper: Set voice window
function setTestVoiceWindow(minutes) {
  const now = Date.now();
  voiceWindow = { startTime: now, endTime: now + (minutes * 60000) };
  localStorage.setItem('pase_voiceWindow', JSON.stringify(voiceWindow));
  checkVoiceWindow();
  alert(`🎙️ Voice Window set for ${minutes} minutes`);
}

// ========================================
// 📄 PAGINATION LOGIC (Feature E) - CLEAN
// ========================================

function initPagination() {
  // Phase 1: No mock data, just initialize UI
  updatePaginationUI();
}

function updatePaginationUI() {
  const topControls = document.getElementById('pagination-top');
  const bottomControls = document.getElementById('pagination-bottom');
  const pageIndicator = document.getElementById('page-indicator');
  const loadBtnTop = document.getElementById('load-older-top');
  const loadBtnBottom = document.getElementById('load-older-bottom');
  const noMore = document.getElementById('no-more-messages');
  
  if (!topControls || !bottomControls) return;
  
  // Phase 1: No history API yet → always show "caught up"
  hasMoreMessages = false;
  
  loadBtnTop?.classList.add('hidden');
  loadBtnBottom?.classList.add('hidden');
  noMore?.classList.remove('hidden');
  
  if (pageIndicator) {
    pageIndicator.textContent = `Page ${currentPage}`;
  }
  
  topControls.classList.add('hidden');
  
  if (messageBuffer.length > 0) {
    bottomControls.classList.remove('hidden');
  } else {
    bottomControls.classList.add('hidden');
  }
}

async function loadOlderMessages() {
  if (!hasMoreMessages) {
    alert('✨ You\'re all caught up!\n\n(History loading will be added in Phase 2)');
    return;
  }
  
  if (isLoadingOlder) return;
  isLoadingOlder = true;
  
  const spinner = document.getElementById('loading-spinner');
  spinner?.classList.remove('hidden');
  
  try {
    // Phase 2: Fetch older messages from Telegram API here
    await new Promise(resolve => setTimeout(resolve, 600));
    alert('🔜 History loading coming in Phase 2!');
  } catch (err) {
    console.error('Load older error:', err);
    alert('Could not load older messages');
  } finally {
    spinner?.classList.add('hidden');
    isLoadingOlder = false;
  }
}

// Helper: Add message to buffer + UI
function bufferAndRenderMessage(text, type, msgId) {
  messageBuffer.push({ id: msgId, text, type, timestamp: Date.now() });
  addMessageToUI(text, type, msgId);
  updatePaginationUI();
}

// 💬 Send Message (with Voice Window + Pagination)
async function sendMessage() {
  if (countdownActive) return alert('Please wait before sending again');
  
  if (voiceWindow && Date.now() >= voiceWindow.startTime && Date.now() <= voiceWindow.endTime) {
    const inputArea = document.querySelector('.input-area');
    if (inputArea && inputArea.classList.contains('voice-mode')) {
      return alert('🎙️ Voice Window active. Use the mic button, or tap ✕ to exit temporarily.');
    }
  }
  
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  if (!text || !myUserId) return;

  const isNewContact = !knownContacts.includes(myUserId);
  let spendToken = false;

  if (isNewContact && tokens > 0) {
    const confirmSend = confirm(`🎟️ Spend 1 Intro Token? (${tokens} left)`);
    if (!confirmSend) return;
    spendToken = true;
  } else if (isNewContact && tokens === 0) {
    const forceSend = confirm(`⚠️ 0 Tokens. Continue?`);
    if (!forceSend) return;
  }

  try {
    const payload = { chat_id: myUserId, text: text };
    
    if (replyingTo && replyingTo.telegramMsgId) {
      payload.reply_to_message_id = replyingTo.telegramMsgId;
    }

    const res = await fetch(`${API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await res.json();
    
    if (res.ok && data.ok) {
      const telegramMsgId = data.result.message_id;
      sentTelegramMsgIds[telegramMsgId] = true;
      localStorage.setItem('pase_sentTelegramMsgIds', JSON.stringify(sentTelegramMsgIds));
      
      const count = incrementMessageCount();
      
      if (replyingTo) {
        addMessageToUI(replyingTo.text, 'ghost', `ghost-${Date.now()}`);
        cancelReply();
      }
      
      bufferAndRenderMessage(text, 'sent', telegramMsgId);
      input.value = '';
      
      if (spendToken) {
        tokens--;
        localStorage.setItem('pase_tokens', tokens);
        updateTokenUI();
      }
      if (isNewContact) {
        knownContacts.push(myUserId);
        localStorage.setItem('pase_knownContacts', JSON.stringify(knownContacts));
      }
      
      startCountdown();
    } else {
      console.error('Send error:', data);
      alert('Failed to send: ' + (data.description || 'Unknown error'));
    }
  } catch (err) {
    console.error('Send error:', err);
    alert('Error: ' + err.message);
  }
}

// ⏳ Countdown
function startCountdown() {
  countdownActive = true;
  const btn = document.getElementById('send-btn');
  const originalText = btn.innerText;
  let timeLeft = 30;

  btn.disabled = true;
  btn.innerText = `${timeLeft}s`;

  const timer = setInterval(() => {
    timeLeft--;
    btn.innerText = `${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(timer);
      countdownActive = false;
      btn.disabled = false;
      btn.innerText = originalText;
    }
  }, 1000);
}

// 📥 Receive Messages (with Pagination awareness)
async function startPolling() {
  setInterval(async () => {
    if (!myUserId) return;
    try {
      const url = `${API_URL}/getUpdates?offset=${lastUpdateId}&timeout=30`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.result && data.result.length > 0) {
        data.result.forEach(update => {
          if (update.message) {
            const msg = update.message;
            const updateId = update.update_id;
            const telegramMsgId = msg.message_id;
            
            if (msg.chat.id.toString() == myUserId.toString() && msg.text) {
              const text = msg.text;
              const fromId = msg.from.id.toString();
              
              const alreadyRendered = document.querySelector(`[data-msg-id="${updateId}"]`);
              
              if (!alreadyRendered) {
                const weSentIt = sentTelegramMsgIds[telegramMsgId];
                
                if (!weSentIt) {
                  if (msg.reply_to_message && msg.reply_to_message.text) {
                    addMessageToUI(msg.reply_to_message.text, 'ghost', `ghost-${updateId}`);
                  }
                  bufferAndRenderMessage(text, 'received', `recv-${updateId}`);
                }
              }
            }
            lastUpdateId = updateId + 1;
            localStorage.setItem('pase_lastUpdateId', lastUpdateId);
          }
        });
      }
    } catch (err) { console.log('Poll error:', err); }
  }, 1000);
}

// 🎨 UI Helper + Long-Press for Ghost Reply
function addMessageToUI(text, type, msgId) {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  div.setAttribute('data-msg-id', msgId);
  div.innerText = text;
  
  if (type !== 'ghost' && type === 'received') {
    let pressTimer;
    
    const startPress = (e) => {
      e.preventDefault();
      pressTimer = setTimeout(() => {
        startReply(msgId, text);
      }, 500);
    };
    
    const cancelPress = () => clearTimeout(pressTimer);
    
    div.addEventListener('touchstart', startPress);
    div.addEventListener('touchend', cancelPress);
    div.addEventListener('touchcancel', cancelPress);
    div.addEventListener('mousedown', startPress);
    div.addEventListener('mouseup', cancelPress);
    div.addEventListener('mouseleave', cancelPress);
  }
  
  const container = document.getElementById('messages');
  if (container) {
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }
}
