document.addEventListener('DOMContentLoaded', async () => {
  let lobbyCode = null;
  const match = window.location.pathname.match(/\/lobby\/([A-Z0-9]+)/i);
  if (match) lobbyCode = match[1];

  const imageCheckCache = new Map();

  firebase.auth().onAuthStateChanged(function(user) {
    if (!user) {
      document.getElementById('connection-status').textContent = 'Not signed in';
      document.getElementById('connection-status').className = 'connection-status disconnected';
      return;
    }

    const username = user.displayName || 'User';
    const uid = user.uid;

    const socket = io();

    const messagesContainer = document.getElementById('messages-container');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const connectionStatus = document.getElementById('connection-status');

    function isValidUrl(string) {
      try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:';
      } catch (_) {
        return false;
      }
    }

    async function isImageUrl(url) {
      if (imageCheckCache.has(url)) {
        return imageCheckCache.get(url);
      }

      try {
        const cleanUrl = url.split('?')[0].split('#')[0];
        const lowerUrl = cleanUrl.toLowerCase();
        
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif'];
        const hasImageExtension = imageExtensions.some(ext => lowerUrl.endsWith(ext));
        
        if (hasImageExtension) {
          imageCheckCache.set(url, true);
          return true;
        }

        const result = await new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = url;
          
          setTimeout(() => resolve(false), 2000);
        });

        imageCheckCache.set(url, result);
        return result;
        
      } catch (error) {
        console.log('Image check failed for:', url, error);
        imageCheckCache.set(url, false);
        return false;
      }
    }

    async function replaceImageLinks(message) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = message.match(urlRegex);
      
      if (!urls) return message;

      let processedMessage = message;
      
      for (const url of urls) {
        const isImage = await isImageUrl(url);
        if (isImage) {
          processedMessage = processedMessage.replace(
            url, 
            `<img src="${url}" alt="User Image" class="chat-image" loading="lazy" style="max-width:200px;max-height:200px;border-radius:8px;margin:5px 0;">`
          );
        }
      }
      
      return processedMessage;
    }

    async function validateMessage(message) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = message.match(urlRegex);
      
      if (!urls) return { valid: true };

      for (const url of urls) {
        if (!isValidUrl(url)) {
          return { 
            valid: false, 
            error: 'Invalid URL format' 
          };
        }

        const isImage = await isImageUrl(url);
        if (!isImage) {
          return { 
            valid: false, 
            error: 'Only image URLs are allowed' 
          };
        }
      }

      return { valid: true };
    }

    function showError(message) {
      const existingError = document.querySelector('.message-error');
      if (existingError) {
        existingError.remove();
      }

      messageInput.style.opacity = '0';
      messageInput.style.transform = 'translateY(10px)';
      sendButton.style.opacity = '0';
      sendButton.style.transform = 'translateY(10px)';
      
      setTimeout(() => {
        const errorElement = document.createElement('div');
        errorElement.className = 'message-error';
        errorElement.textContent = message;
        errorElement.style.cssText = `
          color: #ff4444;
          background: #841022ff;
          border: 1px solid #3f0006ff;
          border-radius: 8px;
          padding: 8px 12px;
          margin: 5px 0;
          font-size: 14px;
          text-align: center;
          animation: fadeIn 0.3s ease-in;
        `;

        messageInput.parentNode.insertBefore(errorElement, messageInput.nextSibling);

        setTimeout(() => {
          if (errorElement.parentNode) {
            errorElement.remove();
          }
          
          messageInput.style.opacity = '1';
          messageInput.style.transform = 'translateY(0)';
          sendButton.style.opacity = '1';
          sendButton.style.transform = 'translateY(0)';
          
        }, 2000);
        
      }, 300);
    }

    async function sendMessage() {
      const message = messageInput.value.trim();
      if (!message) return;

      const validation = await validateMessage(message);
      
      if (!validation.valid) {
        showError(validation.error);
        return;
      }

      socket.emit('lobbyChatMessage', { lobby: lobbyCode, message, username, uid });
      messageInput.value = '';

      const event = new CustomEvent('messageSent', { detail: { message } });
      document.dispatchEvent(event);
    }

    if (!document.querySelector('#chat-styles')) {
      const style = document.createElement('style');
      style.id = 'chat-styles';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .chat-image {
          transition: transform 0.2s ease;
        }
        
        .chat-image:hover {
          transform: scale(1.02);
        }
        
        .message-error {
          animation: fadeIn 0.3s ease-in !important;
        }
        
        #message-input, #send-button {
          transition: all 0.3s ease-in-out;
        }
      `;
      document.head.appendChild(style);
    }

    socket.on('connect', () => {  
      connectionStatus.textContent = 'Connected';
      connectionStatus.className = 'connection-status connected';
      socket.emit('lobbyChatJoin', { lobby: lobbyCode, username, uid });
    });

    socket.on('lobbyChatJoined', () => {
      messageInput.disabled = false;
      sendButton.disabled = false;
      messageInput.focus();
      document.getElementById('loading-message').style.display = 'none';
    });

    socket.on('lobbyChatMessage', async (data) => {
      const isOwn = (data.uid && uid && data.uid === uid);

      const messageElement = document.createElement('div');
      if (data.type === 'system') {
        messageElement.className = 'system-message';
        messageElement.textContent = data.message;
      } else {
        messageElement.className = 'message' + (isOwn ? ' own' : ' other');
        let avatarUrl = '/assets/images/icon.png';
        if (data.uid) {
          avatarUrl = `/profile_pics/${data.uid}.png?v=${Date.now()}`;
        }
        const imgTag = `<img class="chat-avatar" 
                    src="${avatarUrl}" 
                    alt="avatar" 
                    onerror="this.onerror=null;this.src='../assets/images/icon.png';" 
                    style="width:32px;height:32px;border-radius:50%;object-fit:cover;margin-right:8px;">`;

        let processedMessage = data.message;
        
        if (data.message.match(/(https?:\/\/[^\s]+)/g)) {
          try {
            processedMessage = await replaceImageLinks(data.message);
          } catch (error) {
            console.error('Error processing image links:', error);
          }
        }

        messageElement.innerHTML = isOwn
          ? `
              <div style="display:flex;align-items:flex-start;justify-content:flex-end;">
                <div style="flex:1;max-width: calc(100% - 40px);">
                  <div class="message-sender">You</div>
                  <div class="message-bubble">${processedMessage}</div>
                  <div class="message-time">${new Date(data.timestamp).toLocaleTimeString()}</div>
                </div>
                ${imgTag}
              </div>
            `
          : `
              <div style="display:flex;align-items:flex-start;">
                ${imgTag}
                <div style="flex:1;max-width: calc(100% - 40px);">
                  <div class="message-sender">${data.username}</div>
                  <div class="message-bubble">${processedMessage}</div>
                  <div class="message-time">${new Date(data.timestamp).toLocaleTimeString()}</div>
                </div>
              </div>
            `;
      }
      messagesContainer.appendChild(messageElement);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

    sendButton.addEventListener('click', sendMessage);

    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });

    messageInput.addEventListener('input', async () => {
      const message = messageInput.value.trim();
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urls = message.match(urlRegex);
      
      if (urls && urls.length > 0) {
        const validation = await validateMessage(message);
        
        if (!validation.valid) {
          messageInput.style.borderColor = '#ff4444';
          sendButton.disabled = true;
          sendButton.style.opacity = '0.5';
        } else {
          messageInput.style.borderColor = '';
          sendButton.disabled = false;
          sendButton.style.opacity = '1';
        }
      } else {
        messageInput.style.borderColor = '';
        sendButton.disabled = false;
        sendButton.style.opacity = '1';
      }
    });

    socket.on('disconnect', () => {
      connectionStatus.textContent = 'Disconnected';
      connectionStatus.className = 'connection-status disconnected';
      messageInput.disabled = true;
      sendButton.disabled = true;
    });
  });
});