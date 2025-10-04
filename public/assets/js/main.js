const socket = io();
let startTime;
let playerStatus = 'alive';
const urlParams = new URLSearchParams(window.location.search);
const errorParam = urlParams.get('error');
const codeParam = urlParams.get('code');
let spectateTimerInterval;
let timerInterval;
let disconnectModalInterval;
let disconnectCountdown = 10;

let spectating = false;
let spectatedPlayerId = null;
let alivePlayers = [];

let gameTimer = {
  startTime: null,
  pauseStart: null,
  pausedDuration: 0,
  penaltySeconds: 0,
  interval: null,
  isPaused: false
};


let username = null;
const name = null;
function waitForUsername() {
  return new Promise(resolve => {
    if (username) {
      resolve(username);
    } else {
      socket.once('authInitSuccess', ({ name }) => {
        username = name;
        resolve(username);
      });
    }
  });
}
firebase.auth().onAuthStateChanged(async (user) => {
  if (!user) return;

  const token = await user.getIdToken();
  socket.emit('authInit', { token });
});


function startTimer() {
  stopTimer();
  gameTimer.startTime = Date.now();
  gameTimer.pausedDuration = 0;
  gameTimer.penaltySeconds = 0;
  gameTimer.isPaused = false;
  
  gameTimer.interval = setInterval(updateTimerDisplay, 1000);
  updateTimerDisplay();
}

function pauseTimer() {
  if (gameTimer.isPaused || playerStatus !== 'alive') return;
  
  clearInterval(gameTimer.interval);
  gameTimer.pauseStart = Date.now();
  gameTimer.isPaused = true;
}

function resumeTimer() {  
  if (!gameTimer.isPaused || playerStatus !== 'alive') return;
  
  if (gameTimer.pauseStart) {
    gameTimer.pausedDuration += Date.now() - gameTimer.pauseStart;
    gameTimer.pauseStart = null;
  }
  
  gameTimer.isPaused = false;
  gameTimer.interval = setInterval(updateTimerDisplay, 1000);
  updateTimerDisplay();
}

function stopTimer() {
  clearInterval(gameTimer.interval);
  gameTimer.interval = null;
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const timerEl = document.getElementById('gameTimer');
  if (!timerEl) return;
  
  let elapsedSeconds = 0;
  if (gameTimer.startTime) {
    const baseTime = Math.floor(
      (Date.now() - gameTimer.startTime - gameTimer.pausedDuration) / 1000
    );
    elapsedSeconds = baseTime;
  }
  
  timerEl.innerHTML = `Time: ${elapsedSeconds}s${
    gameTimer.penaltySeconds > 0 
      ? `<span class="penalty-display">+${gameTimer.penaltySeconds}</span>`
      : ''
  }`;
}

socket.on('reconnectGameData', (data) => {
  console.log("Reconnect game data received", data);
  reconnectGameHandler(data);
});

document.addEventListener('DOMContentLoaded', () => {
  const backButtonIndex = document.getElementById('backButtonIndex');
  if (backButtonIndex) {
    backButtonIndex.onclick = () => window.location.href = '/';
  }

  const backButton = document.getElementById('backButton');
  if (backButton) {
    backButton.onclick = () => {
      window.location.href = '/lobbycreation';
    };
  }
});

const validateCode = (code) => code.length === 4 && /^[A-Z0-9]+$/.test(code);

if (errorParam) {
  const codeError = document.getElementById('codeError');
  if (codeError) {
    if (errorParam === 'lobby_not_found' && codeParam) {
      codeError.textContent = `Lobby ${codeParam} not found`;
    } else if (errorParam === 'lobby_full') {
      codeError.textContent = `Lobby is full`;
    } else if (errorParam === 'name_taken') {
      codeError.textContent = `Name is already taken in this lobby`;

    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

if (window.location.pathname === '/lobbycreation') {
  document.addEventListener('DOMContentLoaded', () => {
    const createBtn = document.getElementById('createLobby');
    const joinBtn = document.getElementById('joinLobby');
    const codeInput = document.getElementById('lobbyCode');
    const codeError = document.getElementById('codeError');


    socket.on('lobbyCreated', (code) => {
      window.location.href = `/lobby/${code}`;
    });

    codeInput.addEventListener('input', function(e) {
      this.value = this.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
      codeError.textContent = '';
    });

    document.getElementById('browseLobbies').addEventListener('click', () => {
      fetch('/api/lobbies')
        .then(response => response.json())
        .then(lobbies => {
          const modal = document.getElementById('lobbyBrowserModal');
          const list = document.getElementById('lobbyList');
          const noLobbiesMessage = document.getElementById('noLobbiesMessage');
          
          list.innerHTML = '';
          
          if (lobbies.length === 0) {
            noLobbiesMessage.style.display = 'block';
            list.style.display = 'none'; 
          } else {
            noLobbiesMessage.style.display = 'none';
            list.style.display = 'block'; 
            
            lobbies.forEach(lobby => {
              const lobbyItem = document.createElement('div');
              lobbyItem.className = 'lobby-item';
              lobbyItem.dataset.code = lobby.code;
              lobbyItem.innerHTML = `
                <div class="lobby-host">Host: ${lobby.host}</div>
                <div class="lobby-players">Players: ${lobby.players}/${lobby.maxPlayers}</div>
                <div class="lobby-difficulty">Difficulty: ${lobby.difficulty}</div>
                <div class="lobby-code">Code: ${lobby.code}</div>
                <button class="join-lobby-btn">Join</button>
              `;
              list.appendChild(lobbyItem);
              
              lobbyItem.querySelector('.join-lobby-btn').addEventListener('click', async (e) => {
                const name = await waitForUsername();
                window.location.href = `/lobby/${lobby.code}`;


              });
            });
          }
          
          modal.classList.add('visible');
        })
        .catch(error => {
          console.error('Error fetching lobbies:', error);
          document.getElementById('lobbyList').innerHTML = '';
          document.getElementById('noLobbiesMessage').style.display = 'none';
          const errorElement = document.createElement('div');
          errorElement.className = 'error';
          errorElement.textContent = 'Failed to load lobbies';
          document.getElementById('lobbyList').appendChild(errorElement);
        });
    });

    document.getElementById('closeLobbyBrowser').addEventListener('click', () => {
      document.getElementById('lobbyBrowserModal').classList.remove('visible');
    });

    document.getElementById('createLobby').addEventListener('click', () => {
      document.getElementById('difficultyModal').classList.add('visible');
    });

    document.getElementById('exitmodalD').addEventListener('click', () => {
      document.getElementById('difficultyModal').classList.remove('visible');
    });

    document.getElementById('confirmCreate').addEventListener('click', async () => {
      const difficulty = document.getElementById('difficultySelect').value;
      const playerCount = parseInt(document.getElementById('playerCount').value);
      const name = await waitForUsername();
      console.log("Creating lobby with  name:", name);
      socket.emit('createLobby', { difficulty, playerCount, name });
      document.getElementById('difficultyModal').classList.remove('visible');
    });

    createBtn.addEventListener('click', async () => {
      const name = await waitForUsername();
            console.log("Creating lobby2 with  name:", name);

      localStorage.setItem("playerName", name);
      document.getElementById('difficultyModal').classList.add('visible');
    });

    joinBtn.onclick = () => {
      const code = codeInput.value.trim().toUpperCase();
      
      let hasError = false;

      if (!validateCode(code)) {
        codeError.textContent = "Code must be 4 characters (A-Z, 0-9)";
        hasError = true;
      }
      if (hasError) return;
      
      localStorage.setItem("playerName", name);
      window.location.href = `/lobby/${code}`;
    };
  });
}

if (window.location.pathname.startsWith('/lobby/')) {
  (async () => {
    spectating = false;
    spectatedPlayerId = null;
    alivePlayers = [];
    playerStatus = 'alive';

    clearInterval(spectateTimerInterval);
    clearInterval(timerInterval);

    const code = window.location.pathname.split('/').pop().toUpperCase();
    const name = await waitForUsername();
    console.log("Creating lobby3 with  name:", name);

    document.getElementById('readyUp').onclick = () => socket.emit('readyUp');

    const codeDisplay = document.getElementById('lobbyCodeDisplay');
    if (codeDisplay) {
      codeDisplay.textContent = code;
      codeDisplay.addEventListener('click', () => {
        navigator.clipboard.writeText(code);
        codeDisplay.classList.add('copied');
        setTimeout(() => codeDisplay.classList.remove('copied'), 800);
      });
    }
    socket.emit('joinLobby', { code, name });
  })();
}


  socket.on('lobbyError', handleLobbyError);
  socket.on('updateUsers', updatePlayerList);
  socket.on('countdown', handleCountdown);
  socket.on('userLeft', handleUserLeft);
  socket.on('startGame', startGameHandler);
  socket.on('intermediatePodium', handleIntermediatePodium);
  socket.on('gameUpdate', handleGameUpdate);
  socket.on('playerFailed', handlePlayerFailed);
  socket.on('flagUpdate', handleFlagUpdate);
  socket.on('progressUpdate', handleProgressUpdate);
  socket.on('gameOver', handleGameOver);
  socket.on('playerStatusChanged', handlePlayerStatusChanged);
  socket.on('spectateUpdate', handleSpectateUpdate);
  socket.on('gamePaused', handleGamePaused);
  socket.on('gameResumed', handleGameResumed);
  socket.on('playerDisconnected', handlePlayerDisconnected);
  socket.on('reconnectGameData', reconnectGameHandler);

socket.on('connect', async () => {
  const inGameSocketId = localStorage.getItem('inGameSocketId');
  const code = window.location.pathname.split('/').pop().toUpperCase();
  const name = await waitForUsername();

  if (inGameSocketId && code && name && validateCode(code)) {
    console.log("Reconnect check with ID:", inGameSocketId);

    socket.emit('checkPlayerStatus', { playerId: inGameSocketId }, (inGame) => {
      const readyBtn = document.getElementById('readyUp');
      if (!readyBtn) return;
      
      if (inGame) {
        readyBtn.textContent = 'Reconnect';
        readyBtn.disabled = false;
        readyBtn.onclick = () => {
          socket.emit('playerReconnected', { oldId: inGameSocketId });
          socket.emit('requestReconnectGameData');
          readyBtn.disabled = true;
        };
      } else {
        localStorage.removeItem('inGameSocketId');
        readyBtn.textContent = 'Ready Up';
        readyBtn.disabled = false;
        readyBtn.onclick = () => socket.emit('readyUp');
      }
    });
  } else {
    const readyBtn = document.getElementById('readyUp');
    if (readyBtn) {
      readyBtn.textContent = 'Ready Up';
      readyBtn.disabled = false;
      readyBtn.onclick = () => socket.emit('readyUp');
    }
  }
});


socket.on('inGameStatus', (isInGame) => {
  const readyBtn = document.getElementById('readyUp');
  if (!readyBtn) return;

  if (isInGame) {
    readyBtn.textContent = 'Reconnect';
    readyBtn.onclick = () => {
      socket.emit('requestReconnectGameData');
      readyBtn.disabled = true;
    };
  } else {
    readyBtn.textContent = 'Ready Up';
    readyBtn.disabled = false;
    readyBtn.onclick = () => socket.emit('readyUp');
  }
});

async function handleLobbyError(msg) {
  if (['Lobby not found', 'Lobby full', 'Name taken'].includes(msg)) {
    const name = await waitForUsername() || "";
    window.location.href = `/lobbycreation?error=${encodeURIComponent(msg.toLowerCase().replace(' ', '_'))}&name=${encodeURIComponent(name)}`;
  }
}

function updatePlayerList(users) {
  const list = document.getElementById('playerList');
  if (list) {
    list.innerHTML = users.map(user => {
      const uid = user.uid || '';
      // try png first, fallback to jpg, then to site logo
      const imgSrc = uid ? `/profile_pics/${uid}.png` : '/assets/images/minesweeperlogo.png';
      return `
      <li class="${user.ready ? 'ready' : ''}" data-id="${user.id}">
        <img class="player-avatar" src="${imgSrc}" data-uid="${uid}" alt="avatar" onerror="(function(el){ if(el.dataset.uid && el.src.indexOf('.png')!==-1){ el.src='/profile_pics/'+el.dataset.uid+'.jpg'; } else { el.src='/assets/images/minesweeperlogo.png'; } })(this)">
        <span class="player-name-text">${user.name}</span> ${user.ready ? '✅' : ''}
      </li>
    `}).join('');
  }

  const statusEl = document.getElementById('lobbyStatus');
  if (statusEl) {
    if (users.length < 2) {
      statusEl.textContent = 'Waiting for players...';
    } else if (!users.every(u => u.ready)) {
      statusEl.textContent = 'All players must ready up!';
    } else {
      statusEl.textContent = '';
    }
  }
}

function handleCountdown(seconds) {
  const timer = document.getElementById('lobbyStatus');
  if (!timer) return;
  
  if (seconds === -1) {
    timer.style.fontSize = '';
    timer.style.color = '';
    timer.textContent = 'All players must ready up!';
    return;
  }
  
  if (seconds > 0) {
    timer.style.fontSize = '1.5rem';
    timer.style.color = '#add8e6';
    timer.textContent = `Starting in ${seconds}...`;
  }
}

function handleUserLeft(userId) {
  const container = document.querySelector(`.progress-container[data-userid="${userId}"]`);
  if (container) {
    container.remove();
    const progressRows = document.querySelectorAll('.progress-row');
    progressRows.forEach(row => {
      if (row.children.length === 1) {
        row.style.justifyContent = 'flex-start';
        row.firstElementChild.style.flex = '1 0 100%';
      }
    });
  }
}

function startGameHandler({ grid, rows, cols, mines, initialRevealed, users }) {
  localStorage.setItem('inGameSocketId', socket.id);
  document.querySelector('.content-box').style.display = 'none';
  const currentUserId = socket.id;
  playerStatus = 'alive';

  const container = document.querySelector('.container');
  container.innerHTML += `
    <div id="gameContainer">
      <div id="header">
        ${createProgressBars(currentUserId, users)}
        <div class="middle-container">
          <div id="gameTimer">Time: 0 s</div>
          <div id="flagCounter">Flags left: ${mines}</div>
        </div>
      </div>
      <div id="minesweeperGrid"></div>
    </div>
  `;

  const gridElement = document.getElementById('minesweeperGrid');
  const revealedCells = new Set(initialRevealed.map(c => `${c.x},${c.y}`));
  
  for (let y = 0; y < rows; y++) {
    const row = document.createElement('div');
    row.className = 'gridRow';
    for (let x = 0; x < cols; x++) {
      const cell = createCell(x, y, revealedCells, grid);
      row.appendChild(cell);
    }
    gridElement.appendChild(row);
  }

  startTimer();
}

function handleIntermediatePodium({ finishedPlayers, playingPlayers }) {
  alivePlayers = playingPlayers;

  if (playerStatus === 'alive') return;

  const modal = document.getElementById('intermediatePodiumModal');
  if (!modal || modal.classList.contains('visible')) return;

  modal.classList.add('visible');

  document.getElementById('closeintermediatePodiumModal').addEventListener('click', () => {
    modal.classList.remove('visible');
    addSpectateButton();
  });

  document.getElementById('spectatePlayers').addEventListener('click', () => {
    modal.classList.remove('visible');
    showSpectatePlayersModal();
  });

  const spectateBtn = document.getElementById('spectatePlayers');
  if (spectateBtn) {
    spectateBtn.style.display = alivePlayers.length > 0 ? 'block' : 'none';
  }
}

function handleGameUpdate({ cells, revealed }) {
  const revealedCells = new Set(revealed.map(c => `${c.x},${c.y}`));
  cells.forEach(({ x, y, value }) => {
    const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    if (cell) {
      cell.classList.add('revealed');
      cell.textContent = value || '';
      if (value === 'X') cell.classList.add('mine');
    }
  });
}

function handlePlayerFailed({ x, y }) {
  const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
  if (cell) {
    cell.classList.add('revealed', 'mine');
    cell.textContent = 'X';
  }
  
  document.querySelectorAll('.gridCell').forEach(cell => {
    cell.onclick = null;
    cell.oncontextmenu = null;
  });
  
  stopTimer();
  
}

function handleFlagUpdate({ userId, x, y, flagged, flagsLeft }) {
  const isSpectator = spectating && spectatedPlayerId === userId;
  if (userId !== socket.id && !isSpectator) return;

  const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
  if (cell) {
    cell.classList.toggle('flagged', flagged);
    cell.textContent = flagged ? '🚩' : '';
  }
  
  const flagCounter = document.getElementById('flagCounter');
  if (flagCounter) {
    flagCounter.textContent = `Flags left: ${flagsLeft}`;
  }
}

function handleProgressUpdate(usersProgress) {
  const myId = socket.id;
    
  usersProgress.forEach(user => {
    let container = document.querySelector(`.progress-container[data-userid="${user.id}"]`);
    if (!container) {
      const users = usersProgress.map(up => ({ id: up.id, name: up.name }));
      const progressContainer = document.querySelector('.progress-rows-container');
      if (progressContainer) {
        progressContainer.innerHTML = createProgressBars(myId, users);
      }
      return;
    }
    
    const progressBar = container.querySelector('.progress-bar');
    if (progressBar) {
      progressBar.value = user.progress;
      const label = container.querySelector('.progress-label');
      if (label && user.id !== myId) {
        label.textContent = user.name;
      }
    }
  });
}

function handleGameOver({ results, grid }) {
  localStorage.removeItem('inGameSocketId');
  stopTimer();
  if (spectateTimerInterval) clearInterval(spectateTimerInterval);
  revealFullGrid(grid);
  resetSpectation();

  const intermediateModal = document.getElementById('intermediatePodiumModal');
  if (intermediateModal) intermediateModal.style.display = 'none';

  const modal = document.getElementById('gameOverModal');
  if (modal) {
    const message = document.getElementById('gameOverMessage');
    if (message) message.innerHTML = createPodiumDisplay(results);
    modal.style.display = 'flex';

    const rematchButton = document.getElementById('rematchButton');
    if (rematchButton) {
      rematchButton.onclick = () => {
        const lobbyCode = window.location.pathname.split('/').pop();
        window.location.href = `/lobby/${lobbyCode}`;
      };
    }

    const mainMenuButton = document.getElementById('mainMenuButton');
    if (mainMenuButton) {
      mainMenuButton.onclick = () => {
        window.location.href = '/lobbycreation';
      };
    }
  }
}

function handlePlayerStatusChanged({ playerId, status }) {
  if (playerId === socket.id) {
    playerStatus = status;
    if (status !== 'alive') {
      stopTimer();
    }
  }

  if (status === 'dead' || status === 'finished') {
    alivePlayers = alivePlayers.filter(player => player.id !== playerId);

    if (spectating && spectatedPlayerId === playerId && alivePlayers.length > 0) {
      spectatedPlayerId = alivePlayers[0].id;
      socket.emit('spectatePlayer', alivePlayers[0].id);
    }
  }
}

function handleSpectateUpdate({ grid, rows, cols, revealedCells, flags, time, flagsLeft }) {
  const gridElement = document.getElementById('minesweeperGrid');
  if (!gridElement) return;

  if (spectateTimerInterval) {
    clearInterval(spectateTimerInterval);
  }

  gridElement.innerHTML = '';

  const revealedSet = new Set(revealedCells.map(c => `${c.x},${c.y}`));

  for (let y = 0; y < rows; y++) {
    const row = document.createElement('div');
    row.className = 'gridRow';
    for (let x = 0; x < cols; x++) {
      const cell = document.createElement('div');
      cell.className = 'gridCell';
      cell.dataset.x = x;
      cell.dataset.y = y;

      const isRevealed = revealedSet.has(`${x},${y}`);
      if (isRevealed) {
        cell.classList.add('revealed');
        cell.textContent = grid[y][x] || '';
        if (grid[y][x] === 'X') cell.classList.add('mine');
      }

      row.appendChild(cell);
    }
    gridElement.appendChild(row);
  }

  if (Array.isArray(flags)) {
    flags.forEach(({ x, y }) => {
      const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
      if (cell && !cell.classList.contains('revealed')) {
        cell.textContent = '🚩';
        cell.classList.add('flagged');
      }
    });
  }

  const timerEl = document.getElementById('gameTimer');
  if (timerEl) {
    let currentTime = time || 0;
    timerEl.textContent = `Time: ${currentTime} s`;
    
    spectateTimerInterval = setInterval(() => {
      currentTime++;
      timerEl.textContent = `Time: ${currentTime} s`;
    }, 1000);
  }

  const flagCounter = document.getElementById('flagCounter');
  if (flagCounter && flagsLeft !== undefined) {
    flagCounter.textContent = `Flags left: ${flagsLeft}`;
  }
}

function handleGamePaused({ playerId, timeout }) {
  pauseTimer();
  const playerName = getPlayerName(playerId);
  showDisconnectModal(playerName, timeout);
}

function handleGameResumed({ reconnectedPlayerId, penalty }) {
  resumeTimer();
  if (reconnectedPlayerId === socket.id && penalty > 0) {
    showPenaltyAnimation(socket.id, penalty * 1000);
    updateTimerDisplay();
  }
  
  hideDisconnectModal();
}

function handlePlayerDisconnected({ playerId, timeout }) {
  if (timeout) {
    const playerName = getPlayerName(playerId);
    showDisconnectedMessage(playerName);
    hideDisconnectModal();
  }
}

function reconnectGameHandler(data) {
  localStorage.setItem('inGameSocketId', socket.id);
  gameTimer.isPaused = data.isPaused;

  const oldGameContainer = document.getElementById('gameContainer');
  if (oldGameContainer) oldGameContainer.remove();
  
  const readyBtn = document.getElementById('readyUp');
  if (readyBtn) readyBtn.disabled = false;
  
  document.querySelector('.content-box').style.display = 'none';

  const container = document.querySelector('.container');
  container.innerHTML += `
    <div id="gameContainer">
      <div id="header">
        ${createProgressBars(socket.id, data.users)}
        <div class="middle-container">
          <div id="gameTimer">Time: 0 s</div>
          <div id="flagCounter">Flags left: ${data.mines - data.flags.length}</div>
        </div>
      </div>
      <div id="minesweeperGrid"></div>
    </div>
  `;

  const gridElement = document.getElementById('minesweeperGrid');
  gridElement.innerHTML = '';
  
  const revealedSet = new Set(data.revealedCells.map(c => `${c.x},${c.y}`));
  
  for (let y = 0; y < data.rows; y++) {
    const row = document.createElement('div');
    row.className = 'gridRow';
    for (let x = 0; x < data.cols; x++) {
      const cell = document.createElement('div');
      cell.className = 'gridCell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      
      const isRevealed = revealedSet.has(`${x},${y}`);
      const isFlagged = data.flags.some(f => f.x === x && f.y === y);
      
      if (isRevealed) {
        cell.classList.add('revealed');
        cell.textContent = data.grid[y][x] || '';
        if (data.grid[y][x] === 'X') cell.classList.add('mine');
      } 
      else if (isFlagged) {
        cell.classList.add('flagged');
        cell.textContent = '🚩';
      }
      
      if (!isRevealed) {
        cell.onclick = () => socket.emit('revealCell', { x, y });
        cell.oncontextmenu = (e) => {
          e.preventDefault();
          socket.emit('placeFlag', { x, y });
        };
      }
      
      row.appendChild(cell);
    }
    gridElement.appendChild(row);
  }

  if (data.isPaused) {
    pauseTimer();
  } else {
    if (playerStatus === 'alive') {
      if (gameTimer.interval) {
        clearInterval(gameTimer.interval);
      }
      gameTimer.interval = setInterval(updateTimerDisplay, 1000);
    }
    updateTimerDisplay();
  }

  gameTimer.startTime = data.startTime;
  gameTimer.pausedDuration = data.pausedDuration || 0;
  gameTimer.penaltySeconds = (data.penalty || 0) / 1000;

    if (data.penalty > 0) {
    gameTimer.penaltySeconds = data.penalty / 1000;
    updateTimerDisplay();
  }


if (data.isPaused) {
  pauseTimer();
} else if (playerStatus === 'alive') {
  resumeTimer(); 
}
}

function showDisconnectModal(playerName, timeout) {
  hideDisconnectModal();
  
  if (!document.getElementById('disconnectModal')) {
    const modal = document.createElement('div');
    modal.id = 'disconnectModal';
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <h2>${playerName} disconnected</h2>
        <p>Waiting <span id="disconnectCountdown">${timeout}</span> seconds...</p>
        <p>Game is paused</p>
      </div>
    `;
    document.body.appendChild(modal);
  }
  
  disconnectCountdown = timeout;
  updateDisconnectCountdown();
  
  disconnectModalInterval = setInterval(() => {
    disconnectCountdown--;
    updateDisconnectCountdown();
    
    if (disconnectCountdown <= 0) {
      clearInterval(disconnectModalInterval);
      disconnectModalInterval = null;
      resumeTimer();
      hideDisconnectModal(); 
    }
  }, 1000);
}

function updateDisconnectCountdown() {
  const countdownEl = document.getElementById('disconnectCountdown');
  if (countdownEl) {
    countdownEl.textContent = disconnectCountdown;
    
    if (disconnectCountdown <= 3) {
      countdownEl.style.color = 'red';
      countdownEl.style.fontWeight = 'bold';
      countdownEl.style.animation = 'pulse 0.5s infinite';
    }
  }
}

function hideDisconnectModal() {
  if (disconnectModalInterval) {
    clearInterval(disconnectModalInterval);
  }
  
  const modal = document.getElementById('disconnectModal');
  if (modal) {
    modal.remove();
  }
}

function showDisconnectedMessage(playerName) {
  console.log(`${playerName} did not reconnect in time`);
}

function showPenaltyAnimation(playerId, penalty) {
  const penaltySeconds = penalty / 1000;
  const progressContainer = document.querySelector(`.progress-container[data-userid="${playerId}"]`);
  
  if (progressContainer) {
    const penaltyEl = document.createElement('div');
    penaltyEl.className = 'penalty-animation';
    penaltyEl.textContent = `+${penaltySeconds}`;
    penaltyEl.style.color = 'red';
    
    progressContainer.appendChild(penaltyEl);
    
    penaltyEl.style.animation = 'floatUp 1s forwards';
    
    setTimeout(() => {
      penaltyEl.remove();
    }, 1000);
  }
}

function getPlayerName(playerId) {
  const playerList = document.getElementById('playerList');
  if (playerList) {
    const playerItem = playerList.querySelector(`[data-id="${playerId}"]`);
    if (playerItem) {
      return playerItem.textContent.replace('✅', '').trim();
    }
  }
  return 'Opponent';
}

function createCell(x, y, revealedCells, grid) {
  const cell = document.createElement('div');
  cell.className = 'gridCell' + (revealedCells.has(`${x},${y}`) ? ' revealed' : '');
  cell.dataset.x = x;
  cell.dataset.y = y;
  
  if (revealedCells.has(`${x},${y}`)) {
    cell.textContent = grid[y][x] || '';
  }

  cell.onclick = () => {
    if (!revealedCells.has(`${x},${y}`)) {
      socket.emit('revealCell', { x, y });
    }
  };

  cell.oncontextmenu = (e) => {
    e.preventDefault();
    if (!revealedCells.has(`${x},${y}`)) {
      socket.emit('placeFlag', { x, y });
    }
  };

  return cell;
}

function revealFullGrid(grid) {
  grid.forEach((row, y) => {
    row.forEach((cellValue, x) => {
      const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
      if (cell) {
        cell.classList.add('revealed');
        cell.textContent = cellValue || '';
        if (cellValue === 'X') cell.classList.add('mine');
      }
    });
  });
}

function createProgressBars(currentUserId, users) {
  const currentUser = users.find(u => u.id === currentUserId);
  const opponents = users.filter(u => u.id !== currentUserId);
  
  const playersToDisplay = [currentUser, ...opponents];
  
  let rows = [];
  for (let i = 0; i < playersToDisplay.length; i += 2) {
    const rowPlayers = playersToDisplay.slice(i, i + 2);
    rows.push(rowPlayers);
  }
  
  return `
    <div class="progress-rows-container">
      ${rows.map(rowPlayers => `
        <div class="progress-row">
          ${rowPlayers.map(player => player ? `
            <div class="progress-container" data-userid="${player.id}">
              <div class="progress-label">
                ${player.id === currentUserId ? 'You' : player.name}
              </div>
              <progress class="progress-bar" value="0" max="100"></progress>
            </div>
          ` : '').join('')}
        </div>
      `).join('')}
    </div>
  `;
}

function showSpectatePlayersModal() {
  const modal = document.getElementById('spectatePlayersModal');
  const list = document.getElementById('spectatePlayersList');
  
  if (!modal || !list) return;
  
  list.innerHTML = '';
  document.getElementById('closeSpectateModal').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  if (alivePlayers.length === 0) {
    list.innerHTML = '<div class="no-players">No active players to spectate</div>';
  } else {
    alivePlayers.forEach(player => {
      const playerItem = document.createElement('div');
      playerItem.className = 'spectate-item';
      playerItem.innerHTML = `
        <div>${player.name}</div>
        <div class="spectate-stats">
        </div>
      `;
      playerItem.dataset.id = player.id;
      
      playerItem.addEventListener('click', () => {
        spectatedPlayerId = player.id;
        spectating = true;
        modal.style.display = 'none';

        const intermediateModal = document.getElementById('intermediatePodiumModal');
        if (intermediateModal) intermediateModal.style.display = 'none';
        
        socket.emit('spectatePlayer', player.id);
        
        addSpectateButton();
      });
      
      list.appendChild(playerItem);
    });
  }
  
  modal.style.display = 'flex';
}

function addSpectateButton() {
  if (document.getElementById('spectateButton')) return;
  
  const gameContainer = document.getElementById('gameContainer');
  if (!gameContainer) return;
  
  const spectateBtn = document.createElement('button');
  spectateBtn.id = 'spectateButton';
  spectateBtn.className = 'spectate-button';
  spectateBtn.textContent = 'Spectate';
  
  spectateBtn.addEventListener('click', showSpectatePlayersModal);
  
  const grid = document.getElementById('minesweeperGrid');
  gameContainer.insertBefore(spectateBtn, grid);
}

function resetSpectation() {
  spectating = false;
  spectatedPlayerId = null;
  alivePlayers = [];
  
  const spectateBtn = document.getElementById('spectateButton');
  if (spectateBtn) spectateBtn.remove();
}

function createPodiumDisplay(results) {
  const currentUserId = socket.id;
  const displayResults = results.map(player => ({
    ...player,
    status: player.status === 'finished' ? 'winner' : player.status
  }));
  
  const winners = results.filter(r => r.status === 'winner')
    .sort((a, b) => a.time - b.time);
  const losers = results.filter(r => r.status === 'loser' || r.status === 'disconnected')
    .sort((a, b) => b.progress - a.progress);
  const sortedResults = [...winners, ...losers];

  sortedResults.forEach((player, index) => {
    player.rank = index + 1;
  });

  const firstPlace = sortedResults.find(p => p.rank === 1);
  
  const playersAfterFirst = sortedResults.filter(p => p.rank > 1);
  const leftPlayers = [];
  const rightPlayers = [];
  
  playersAfterFirst.forEach((player, index) => {
    if (index % 2 === 0) {
      rightPlayers.push(player);
    } else {
      leftPlayers.unshift(player);
    }
  });

  let podiumHTML = '<div class="podium-container"><div class="podium-row">';
  
  leftPlayers.forEach(player => {
    podiumHTML += createPodiumTier(player, currentUserId);
  });
  
  if (firstPlace) {
    podiumHTML += createPodiumTier(firstPlace, currentUserId, true);
  }
  
  rightPlayers.forEach(player => {
    podiumHTML += createPodiumTier(player, currentUserId);
  });
  
  podiumHTML += '</div></div>';
  
  return podiumHTML;
}

function createPodiumTier(player, currentUserId, isCenter = false) {
  const tierClass = player.rank === 1 ? 'first' : 
                   player.rank === 2 ? 'second' : 
                   player.rank === 3 ? 'third' : 'other';
                   
  return `
    <div class="podium-tier ${tierClass} ${player.id === currentUserId ? 'current-player' : ''}">
      <div class="tier-rank">#${player.rank}</div>
      <div class="player-info">
        <div class="player-name">${player.name}</div>
        <div class="player-stats">
          <span>${player.progress}%</span>
          <br>
          <span>${player.time} s</span>
          ${player.penalty ? `<span class="penalty">+${player.penalty}</span>` : ''}

        </div>
      </div>
    </div>
  `;
}
