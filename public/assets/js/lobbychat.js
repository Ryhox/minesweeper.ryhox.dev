document.addEventListener('DOMContentLoaded', async () => {
  
  
  let lobbyCode = null;
  const match = window.location.pathname.match(/\/lobby\/([A-Z0-9]+)/i);
  if (match) lobbyCode = match[1];

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

    socket.on('lobbyChatMessage', (data) => {
      const isOwn = (data.uid && uid && data.uid === uid);

      const messageElement = document.createElement('div');
      if (data.type === 'system') {
        messageElement.className = 'system-message';
        messageElement.textContent = data.message;
      } else {
        messageElement.className = 'message' + (isOwn ? ' own' : ' other');
        let avatarUrl = '/assets/images/icon.png';
        if (data.uid) {
          avatarUrl = `/profile_pics/${user.uid}.png?v=${Date.now()}`;
        }
        const imgTag = `<img class="chat-avatar" 
                    src="${avatarUrl}" 
                    alt="avatar" 
                    onerror="this.onerror=null;this.src='../assets/images/icon.png';" 
                    style="width:32px;height:32px;border-radius:50%;object-fit:cover;margin-right:8px;">`;

        messageElement.innerHTML = isOwn
          ? `
              <div style="display:flex;align-items:flex-start;">
              
            <div>
              <div class="message-sender">You</div>
              <div class="message-bubble">${data.message}</div>
              <div class="message-time">${new Date(data.timestamp).toLocaleTimeString()}</div>
            </div>
            ${imgTag}
                        </div>

          `
          : `
            <div style="display:flex;align-items:flex-start;">
              ${imgTag}
              <div>
                <div class="message-sender">${data.username}</div>
                <div class="message-bubble">${data.message}</div>
                <div class="message-time">${new Date(data.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          `;
      }
      messagesContainer.appendChild(messageElement);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });

    sendButton.addEventListener('click', () => {
      const message = messageInput.value.trim();
      if (message) {
        socket.emit('lobbyChatMessage', { lobby: lobbyCode, message, username, uid });
        messageInput.value = '';
      }
    });

    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const message = messageInput.value.trim();
        if (message) {
          socket.emit('lobbyChatMessage', { lobby: lobbyCode, message, username, uid });
          messageInput.value = '';
        }
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
