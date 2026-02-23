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

// 📄 PAGINATION STATE (Feature E)
let currentPage = 1;
const MESSAGES_PER_PAGE = 20;
let hasMoreMessages = true;
let isLoadingOlder = false;
let allMessages = []; // Mock data store for pagination demo

// 🚀 Initialize
window.onload = () => {
  checkWeeklyReset();
  updateTokenUI();
  if (myUserId) {
    showChatScreen();
    initPagination(); // Initialize pagination on login
  }
  startPolling();
  checkScheduledMessages();
  checkVoiceWindow();
  
  // Setup profile click handler
  const header = document.querySelector('#chat-screen header h2');
  if (header) {
    header.style.cursor = 'pointer';
    header.addEventListener('click', openProfile);
  }
  
  // Set minimum datetime for schedule picker
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const scheduleInput = document.getElementById('schedule-time');
  if (scheduleInput) {
    scheduleInput.min = now.toISOString().slice(0, 16);
  }
  
  // Request notification permission
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
      addMessageToUI(msg.text, 'sent', telegramMsgId);
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
// 📄 PAGINATION LOGIC (Feature E)
// ========================================

function initPagination() {
  // Generate mock messages for testing pagination
  generateMockMessages();
  // Render first page
  renderPage(1);
  // Update UI controls
  updatePaginationUI();
}

function generateMockMessages() {
  // Create 75 mock messages for testing (3.75 pages)
  if (allMessages.length > 0) return; // Don't regenerate
  
  const mockTexts = [
    "Hey there! 👋", "How's your day going?", "Just thinking about our last chat",
    "Did you see that movie?", "I love this app so far", "Pase is really growing on me",
    "What's your favorite feature?", "The countdown timer is genius", "Voice windows are cool",
    "I scheduled a message for tomorrow!", "Ghost replies make context so clear",
    "Progressive reveal is such a nice touch", "Can't wait for more features",
    "This feels like the future of chat", "Intentional messaging > spam",
    "Love the token system", "Makes me think before I send", "Quality over quantity",
    "The UI is so clean", "Dark mode would be nice though", "Maybe in Phase 2? 😉",
    "Anyway, what's new with you?", "Still working on that project?", "Let me know when you're free",
    "No rush, just checking in", "Hope you're doing well", "Talk soon! ✨"
  ];
  
  for (let i = 1; i <= 75; i++) {
    const isSent = i % 2 === 0; // Alternate sent/received for demo
    allMessages.push({
      id: `mock-${i}`,
      text: mockTexts[(i - 1) % mockTexts.length] + ` (Msg #${i})`,
      type: isSent ? 'sent' : 'received',
      timestamp: Date.now() - (75 - i) * 60000, // 1 min apart
      telegramMsgId: `tg-${i}`
    });
  }
  
  // Sort oldest first (for pagination loading older)
  allMessages.sort((a, b) => a.timestamp - b.timestamp);
}

function renderPage(pageNum) {
  const container = document.getElementById('messages');
  if (!container) return;
  
  // Clear current messages
  container.innerHTML = '';
  
  // Calculate slice indices
  const startIndex = (pageNum - 1) * MESSAGES_PER_PAGE;
  const endIndex = startIndex + MESSAGES_PER_PAGE;
  const pageMessages = allMessages.slice(startIndex, endIndex);
  
  // Render messages
  pageMessages.forEach(msg => {
    addMessageToUI(msg.text, msg.type, msg.id);
  });
  
  // Update state
  currentPage = pageNum;
  hasMoreMessages = endIndex < allMessages.length;
  
  // Scroll to bottom (newest messages)
  container.scrollTop = container.scrollHeight;
  
  // Update UI
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
  
  // Show/hide controls based on page state
  if (currentPage === 1 && !hasMoreMessages) {
    // Only one page, no pagination needed
    topControls.classList.add('hidden');
    bottomControls.classList.add('hidden');
  } else if (currentPage === 1) {
    // First page, show only bottom load button
    topControls.classList.add('hidden');
    bottomControls.classList.remove('hidden');
    loadBtnBottom.classList.remove('hidden');
    noMore.classList.add('hidden');
  } else {
    // Middle or last page, show both controls
    topControls.classList.remove('hidden');
    bottomControls.classList.remove('hidden');
    
    if (hasMoreMessages) {
      loadBtnBottom.classList.remove('hidden');
      noMore.classList.add('hidden');
    } else {
      loadBtnBottom.classList.add('hidden');
      noMore.classList.remove('hidden');
    }
  }
  
  // Update page indicator
  if (pageIndicator) {
    const totalPages = Math.ceil(allMessages.length / MESSAGES_PER_PAGE);
    pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
  }
}

async function loadOlderMessages() {
  if (isLoadingOlder || !hasMoreMessages) return;
  
  isLoadingOlder = true;
  
  // Show loading spinner
  const spinner = document.getElementById('loading-spinner');
  if (spinner) spinner.classList.remove('hidden');
  
  // Simulate network delay for demo
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Load next page
  renderPage(currentPage + 1);
  
  // Hide spinner
  if (spinner) spinner.classList.add('hidden');
  
  isLoadingOlder = false;
}

// 💬 Send Message (with Voice Window + Pagination check)
async function sendMessage() {
  if (countdownActive) return alert('Please wait before sending again');
  
  // Check voice window
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
      
      // Add to pagination store AND UI
      allMessages.push({
        id: `sent-${Date.now()}`,
        text: text,
        type: 'sent',
        timestamp: Date.now(),
        telegramMsgId: telegramMsgId
      });
      
      // If we're on the latest page, append to UI; otherwise, just store
      if (currentPage === Math.ceil(allMessages.length / MESSAGES_PER_PAGE)) {
        addMessageToUI(text, 'sent', telegramMsgId);
        // Scroll to new message
        const container = document.getElementById('messages');
        if (container) container.scrollTop = container.scrollHeight;
      }
      
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
                  // Add to pagination store
                  allMessages.push({
                    id: `recv-${updateId}`,
                    text: text,
                    type: 'received',
                    timestamp: Date.now(),
                    telegramMsgId: telegramMsgId
                  });
                  
                  // Show ghost reply context if present
                  if (msg.reply_to_message && msg.reply_to_message.text) {
                    addMessageToUI(msg.reply_to_message.text, 'ghost', `ghost-${updateId}`);
                  }
                  
                  // If on latest page, render immediately
                  if (currentPage === Math.ceil(allMessages.length / MESSAGES_PER_PAGE)) {
                    addMessageToUI(text, 'received', updateId);
                  }
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
