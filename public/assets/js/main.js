const socket = io();
const GRID_SIZE = 10;
const MINE_COUNT = 15;
let opponentName = "Opponent";
let timerInterval;
const urlParams = new URLSearchParams(window.location.search);
const errorParam = urlParams.get('error');
const codeParam = urlParams.get('code');

document.addEventListener('DOMContentLoaded', () => {
  const backButtonIndex = document.getElementById('backButtonIndex');
  if (backButtonIndex) {
    backButtonIndex.onclick = () => {
      window.location.href = '/';
    };
  }
});

const validateName = (name) => name.trim().length > 0 && name.length <= 16;
const validateCode = (code) => code.length === 4 && /^[A-Z0-9]+$/.test(code);
if (errorParam === 'lobby_not_found' && codeParam) {
  codeError.textContent = `Lobby ${codeParam} not found`;
  window.history.replaceState({}, document.title, window.location.pathname);
}
if (window.location.pathname === '/lobbycreation.html') {
  document.addEventListener('DOMContentLoaded', () => {
    const nameInput = document.getElementById('nameInput');
    const createBtn = document.getElementById('createLobby');
    const joinBtn = document.getElementById('joinLobby');
    const codeInput = document.getElementById('lobbyCode');
    const nameError = document.getElementById('nameError');
    const codeError = document.getElementById('codeError');

    const savedName = localStorage.getItem('playerName');
    if (savedName) {
      nameInput.value = savedName;
    }

    nameInput.addEventListener('input', () => {
      localStorage.setItem('playerName', nameInput.value);
      nameError.textContent = '';
    });

    socket.on('lobbyCreated', (code) => {
      window.location.href = `/lobby/${code}`;
    });

    codeInput.addEventListener('input', function(e) {
      this.value = this.value.replace(/[^A-Z0-9]/g, '').slice(0,4).toUpperCase();
      codeError.textContent = '';
    });

    createBtn.onclick = () => {
      const name = nameInput.value.trim();
      if (!validateName(name)) {
        nameError.textContent = "Name must be 1-16 characters";
        return;
      }
      localStorage.setItem("playerName", name);
      socket.emit('createLobby');
    };

    joinBtn.onclick = () => {
      const code = codeInput.value.trim().toUpperCase();
      const name = nameInput.value.trim();
      
      let hasError = false;
      if (!validateName(name)) {
        nameError.textContent = "Name must be 1-16 characters";
        hasError = true;
      }
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
  const code = window.location.pathname.split('/').pop().toUpperCase();
  const name = localStorage.getItem("playerName");
  let revealedCells = new Set();

  document.getElementById('backButton').onclick = () => {
    window.location.href = '/lobbycreation.html';
  };


  if (!name || !validateName(name)) {
    alert("Invalid name. Returning to home.");
    window.location.href = '/';
  }

  document.getElementById('readyUp').onclick = () => socket.emit('readyUp');
  const codeDisplay = document.getElementById('lobbyCodeDisplay');
  codeDisplay.textContent = code;

  codeDisplay.addEventListener('click', () => {
    navigator.clipboard.writeText(code);
    codeDisplay.classList.add('copied');
    setTimeout(() => codeDisplay.classList.remove('copied'), 800);
  });

socket.on('lobbyError', (msg) => {
  if (msg === 'Lobby not found') {
    codeError.textContent = msg;
  } else if (msg === 'Lobby full') {
    codeError.textContent = msg;
  } else if (msg === 'Name taken') {
    nameError.textContent = msg;
  }
});

  socket.on('updateUsers', (users) => {
  const list = document.getElementById('playerList');
  list.innerHTML = users.map(user => `
    <li class="${user.ready ? 'ready' : ''}">
      ${user.name} ${user.ready ? '✅' : ''}
    </li>
  `).join('');

  const statusEl = document.getElementById('lobbyStatus');
  if (users.length < 2) {
    statusEl.textContent = 'Waiting for another player...';
  } else if (!users.every(u => u.ready)) {
    statusEl.textContent = 'Both players must ready up!';
  } else {
    statusEl.textContent = '';
  }
  });

  socket.on('countdown', (seconds) => {
    const timer = document.getElementById('countdownTimer');
  timer.style.display = seconds > 0 ? 'block' : 'none';
      if (seconds === 0) {
      timer.textContent = '';
      return;
    }

  timer.textContent = seconds > 0 ? `Starting in ${seconds}...` : '';
    timer.style.display = 'block';
  });

  socket.on('startGame', ({ grid, initialRevealed, users }) => {
    document.querySelector('.content-box').style.display = 'none';
    document.getElementById('readyUp').style.display = 'none';
    
    const currentUserId = socket.id;
    const opponent = users.find(u => u.id !== currentUserId);
    opponentName = opponent?.name || 'Opponent';

    const container = document.querySelector('.container');
    container.innerHTML += `
      <div id="gameContainer">
        <div id="header">
          <div class="progress-container">
            <div class="progress-label">Your Progress</div>
            <progress id="playerProgress" class="progress-bar" value="0" max="100"></progress>
          </div>
          <div class="middle-container">
            <div id="gameTimer">Time: 0s</div>
            <div id="flagCounter">Flags left: ${MINE_COUNT}</div>
          </div>
          <div class="progress-container">
            <div class="progress-label">${opponentName}'s Progress</div>
            <progress id="opponentProgress" class="progress-bar" value="0" max="100"></progress>
          </div>
        </div>
        <div id="minesweeperGrid"></div>
      </div>
    `;

    const gridElement = document.getElementById('minesweeperGrid');
    revealedCells = new Set(initialRevealed.map(c => `${c.x},${c.y}`));

    for (let y = 0; y < GRID_SIZE; y++) {
      const row = document.createElement('div');
      row.className = 'gridRow';
      for (let x = 0; x < GRID_SIZE; x++) {
        const cell = createCell(x, y, revealedCells, grid);
        row.appendChild(cell);
      }
      gridElement.appendChild(row);
    }

    const startTime = Date.now();
    timerInterval = setInterval(() => {
      document.getElementById('gameTimer').textContent = 
        `Time: ${Math.floor((Date.now() - startTime) / 1000)}s`;
    }, 1000);
  });

  socket.on('gameUpdate', ({ cells, revealed }) => {
    revealedCells = new Set(revealed);
    cells.forEach(({ x, y, value }) => {
      const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
      cell.classList.add('revealed');
      cell.textContent = value || '';
      if (value === 'X') cell.classList.add('mine');
    });
  });

  socket.on('flagUpdate', ({ userId, x, y, flagged, flagsLeft }) => {
    if (userId !== socket.id) return;
    
    const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
    cell.classList.toggle('flagged', flagged);
    cell.textContent = flagged ? '🚩' : '';
    document.getElementById('flagCounter').textContent = `Flags left: ${flagsLeft}`;
  });

  socket.on('progressUpdate', (usersProgress) => {
    const myId = socket.id;
    const myProgress = usersProgress.find(u => u.id === myId)?.progress || 0;
    const opponent = usersProgress.find(u => u.id !== myId);

    document.getElementById('playerProgress').value = myProgress;
    if (opponent) {
      document.getElementById('opponentProgress').value = opponent.progress;
      document.querySelector('#opponentProgress').previousElementSibling.textContent = 
        `${opponent.name}'s Progress`;
    }
  });

socket.on('gameOver', ({ winnerId, loserId, winnerName, loserName, grid, reason }) => {
  clearInterval(timerInterval);
  revealFullGrid(grid);

  const modal = document.getElementById('gameOverModal');
  const message = document.getElementById('gameOverMessage');
  const currentUserId = socket.id;

  // Remove previous classes
  message.className = '';
  
  // Determine viewer's role
  const isWinner = currentUserId === winnerId;
  const isLoser = currentUserId === loserId;
  
  // Create styled name elements
  const winnerSpan = `<span class="winner-name">${winnerName}</span>`;
  const loserSpan = `<span class="loser-name">${loserName}</span>`;

  let displayText = '';
  if (isWinner) {
    message.classList.add('victory-message');
    switch(reason) {
      case 'self-mine':
        displayText = `${loserSpan} bombed themselves!<br>YOU WIN! 🏆`;
        break;
      case 'disconnect':
        displayText = `${loserSpan} disconnected!<br>YOU WIN! 🏆`;
        break;
      case 'left':
        displayText = `${loserSpan} left!<br>YOU WIN! 🏆`;
        break;
      default:
        displayText = `YOU defeated ${loserSpan}! 🎉`;
    }
  } else if (isLoser) {
    message.classList.add('defeat-message');
    switch(reason) {
      case 'self-mine':
        displayText = `YOU bombed yourself!<br>Against ${winnerSpan} 💥`;
        break;
      case 'disconnect':
        displayText = `Connection lost!<br>${winnerSpan} wins 😢`;
        break;
      default:
        displayText = `You lost against ${winnerSpan}! 😭`;
    }
  }

  message.innerHTML = displayText;
  modal.style.display = 'flex';

  // Button handlers
  document.getElementById('rematchButton').onclick = () => {
    window.location.reload();
  };

  document.getElementById('mainMenuButton').onclick = () => {
    window.location.href = '/lobbycreation.html';
  };
});
  socket.emit('joinLobby', { code, name });
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
      cell.classList.add('revealed');
      cell.textContent = cellValue || '';
      if (cellValue === 'X') cell.classList.add('mine');
    });
  });
}