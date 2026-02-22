// ⚙️ CONFIGURATION
const BOT_TOKEN = '8393616041:AAFiikss8moFzdTA6xF-QmEKZG_zkYL41DQ'; 
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

// 🌍 Global State
let chatId = localStorage.getItem('pase_chatId');
let countdownActive = false;
let lastUpdateId = parseInt(localStorage.getItem('pase_lastUpdateId')) || 0;

// 🎟️ Token System State
let tokens = parseInt(localStorage.getItem('pase_tokens')) || 1;
let knownContacts = JSON.parse(localStorage.getItem('pase_knownContacts')) || [];

// 🚀 Initialize
window.onload = () => {
  checkWeeklyReset();
  updateTokenUI();
  if (chatId) showChatScreen();
  startPolling();
};

// 🗓️ Weekly Reset Logic (Every Sunday)
function checkWeeklyReset() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const last = localStorage.getItem('pase_lastReset');
  
  // If it's Sunday and we haven't reset yet this week
  if (day === 0 && (!last || now - new Date(last) > 604800000)) {
    tokens = 1;
    localStorage.setItem('pase_tokens', tokens);
    localStorage.setItem('pase_lastReset', now.toISOString());
    // Optional: alert user
    // alert('🎟️ New week! Your Intro Token has been refreshed.');
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
  chatId = userId;
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

// 💬 Send Message (with Token Logic + Countdown)
async function sendMessage() {
  if (countdownActive) return alert('Please wait before sending again');
  
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  if (!text || !chatId) return;

  // 🎟️ Check Token Status
  const isNewContact = !knownContacts.includes(chatId);
  let spendToken = false;

  if (isNewContact && tokens > 0) {
    const confirmSend = confirm(`🎟️ This is a new contact. Spend 1 Intro Token? (${tokens} left)`);
    if (!confirmSend) return;
    spendToken = true;
  } else if (isNewContact && tokens === 0) {
    const forceSend = confirm(`⚠️ You have 0 Tokens. You can still send, but profile reveal will be delayed. Continue?`);
    if (!forceSend) return;
  }

  // Send to Telegram
  try {
    const res = await fetch(`${API_URL}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
    
    if (res.ok) {
      addMessageToUI(text, 'sent');
      input.value = '';
      
      // Update State
      if (spendToken) {
        tokens--;
        localStorage.setItem('pase_tokens', tokens);
        updateTokenUI();
      }
      if (isNewContact) {
        knownContacts.push(chatId);
        localStorage.setItem('pase_knownContacts', JSON.stringify(knownContacts));
      }
      
      startCountdown(); // 🔒 Feature #1
    } else {
      alert('Failed to send. Check your Bot Token.');
    }
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// ⏳ Feature #1: Send Countdown (30s)
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

// 📥 Receive Messages (Polling) - FIXED for duplicates
async function startPolling() {
  setInterval(async () => {
    if (!chatId) return;
    
    try {
      // Use lastUpdateId to get ONLY new messages
      const url = `${API_URL}/getUpdates?offset=${lastUpdateId}&timeout=30`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.result && data.result.length > 0) {
        data.result.forEach(update => {
          // Only process messages from this chat
          if (update.message && update.message.chat.id == chatId) {
            const text = update.message.text;
            const fromId = update.message.from.id;
            const messageId = update.update_id;
            
            // Avoid duplicates: check if we already rendered this
            const alreadyRendered = document.querySelector(`[data-msg-id="${messageId}"]`);
            
            if (!alreadyRendered) {
              // Determine if sent or received
              const type = fromId == chatId ? 'sent' : 'received';
              addMessageToUI(text, type, messageId);
            }
          }
          // Always update offset to avoid re-fetching
          lastUpdateId = update.update_id + 1;
          localStorage.setItem('pase_lastUpdateId', lastUpdateId);
        });
      }
    } catch (err) { 
      console.log('Poll error:', err); 
    }
  }, 1000); // Poll every 1 second
}

// 🎨 UI Helper - Updated with data attribute to prevent duplicates
function addMessageToUI(text, type, msgId) {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  div.setAttribute('data-msg-id', msgId); // Unique ID to prevent duplicates
  div.innerText = text;
  const container = document.getElementById('messages');
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
          }
