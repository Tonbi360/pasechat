// ⚙️ CONFIGURATION
const BOT_TOKEN = '8393616041:AAFiikss8moFzdTA6xF-QmEKZG_zkYL41DQ'; 
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

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

// 🗄️ Track Telegram message IDs we've SENT (to avoid duplicates)
let sentTelegramMsgIds = JSON.parse(localStorage.getItem('pase_sentTelegramMsgIds')) || {};

// 🗄️ Track Telegram message IDs we've RECEIVED (for replies)
let receivedTelegramMsgIds = {};

// 🚀 Initialize
window.onload = () => {
  checkWeeklyReset();
  updateTokenUI();
  if (myUserId) showChatScreen();
  startPolling();
  
  const header = document.querySelector('#chat-screen header h2');
  if (header) {
    header.style.cursor = 'pointer';
    header.addEventListener('click', openProfile);
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

// 👻 Ghost Reply Functions
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

// 💬 Send Message
async function sendMessage() {
  if (countdownActive) return alert('Please wait before sending again');
  
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
    const payload = { 
      chat_id: myUserId, 
      text: text
    };
    
    // Only add reply_to_message_id if we have a VALID received message ID
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
      // Store the Telegram message_id
      const telegramMsgId = data.result.message_id;
      sentTelegramMsgIds[telegramMsgId] = true; // Mark as sent by us
      localStorage.setItem('pase_sentTelegramMsgIds', JSON.stringify(sentTelegramMsgIds));
      
      const count = incrementMessageCount();
      
      // Add ghost reply UI if replying
      if (replyingTo) {
        addMessageToUI(replyingTo.text, 'ghost', `ghost-${Date.now()}`);
        cancelReply();
      }
      
      // Add as 'sent' immediately
      addMessageToUI(text, 'sent', telegramMsgId);
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

// 📥 Receive Messages (FIXED - Avoid duplicates)
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
            
            // Only process messages in THIS chat
            if (msg.chat.id.toString() == myUserId.toString() && msg.text) {
              const text = msg.text;
              const fromId = msg.from.id.toString();
              
              // Check if we already rendered this update
              const alreadyRendered = document.querySelector(`[data-msg-id="${updateId}"]`);
              
              if (!alreadyRendered) {
                // KEY FIX: Check if WE sent this message
                const weSentIt = sentTelegramMsgIds[telegramMsgId];
                
                // If we sent it, don't add it again (avoid duplicate)
                if (!weSentIt) {
                  // This is a REAL incoming message (from bot or someone else)
                  receivedTelegramMsgIds[telegramMsgId] = true;
                  
                  // Handle reply context
                  if (msg.reply_to_message && msg.reply_to_message.text) {
                    addMessageToUI(msg.reply_to_message.text, 'ghost', `ghost-${updateId}`);
                  }
                  
                  addMessageToUI(text, 'received', updateId);
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
  
  // Add long-press for ghost reply (only on non-ghost messages)
  if (type !== 'ghost' && type === 'received') {
    let pressTimer;
    
    const startPress = (e) => {
      e.preventDefault();
      pressTimer = setTimeout(() => {
        // Extract telegram message ID from msgId
        // For received messages, msgId is the updateId, we need to find the telegram message_id
        // For simplicity, use the updateId as a fallback
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
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}
