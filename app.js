// ⚙️ CONFIGURATION
// ⚠️ IMPORTANT: In production, never expose the token in client code.
// For Phase 1 testing, this is okay. Later we will use a proxy.
const BOT_TOKEN = '8393616041:AAFiikss8moFzdTA6xF-QmEKZG_zkYL41DQ'; 
const API_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

let chatId = localStorage.getItem('pase_chatId');
let countdownActive = false;

// 🚀 Initialize
window.onload = () => {
  if (chatId) showChatScreen();
  startPolling();
};

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
}

function logout() {
  localStorage.removeItem('pase_chatId');
  location.reload();
}

// 💬 Send Message (with Feature #1: Countdown)
async function sendMessage() {
  if (countdownActive) return alert('Please wait before sending again');
  
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  if (!text || !chatId) return;

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
      startCountdown(); // 🔒 Trigger Feature #1
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

// 📥 Receive Messages (Polling)
async function startPolling() {
  let offset = 0;
  setInterval(async () => {
    if (!chatId) return;
    try {
      const res = await fetch(`${API_URL}/getUpdates?offset=${offset}`);
      const data = await res.json();
      if (data.result && data.result.length > 0) {
        data.result.forEach(update => {
          if (update.message && update.message.chat.id == chatId) {
            addMessageToUI(update.message.text, 'received');
            offset = update.update_id + 1;
          }
        });
      }
    } catch (err) { console.log(err); }
  }, 2000);
}

// 🎨 UI Helper
function addMessageToUI(text, type) {
  const div = document.createElement('div');
  div.className = `message ${type}`;
  div.innerText = text;
  const container = document.getElementById('messages');
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}
