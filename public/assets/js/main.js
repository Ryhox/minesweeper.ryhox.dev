const socket = io();
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
} else if (errorParam === 'lobby_full') {
    codeError.textContent = `Lobby is full`;
  window.history.replaceState({}, document.title, window.location.pathname);
} else if (errorParam === 'name_taken') {
    codeError.textContent = `Someone is already named that way in this Lobby.`;
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
  this.value = this.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase();
      codeError.textContent = '';
    });
    // Add this with other DOMContentLoaded code for lobbycreation.html
document.getElementById('browseLobbies').addEventListener('click', () => {
  fetch('/api/lobbies')
    .then(response => response.json())
    .then(lobbies => {
      const modal = document.getElementById('lobbyBrowserModal');
      const list = document.getElementById('lobbyList');
      const noLobbiesMessage = document.getElementById('noLobbiesMessage');
      
      // Clear previous content
      list.innerHTML = '';
      
      if (lobbies.length === 0) {
        noLobbiesMessage.style.display = 'block';
        list.style.display = 'none'; // Hide the list container
      } else {
        noLobbiesMessage.style.display = 'none';
        list.style.display = 'block'; // Show the list container
        
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
          
          // Add click handler to the join button
          lobbyItem.querySelector('.join-lobby-btn').addEventListener('click', (e) => {
            const name = document.getElementById('nameInput').value.trim();
            if (validateName(name)) {
              window.location.href = `/lobby/${lobby.code}`;
            } else {
              document.getElementById('nameError').textContent = "Please enter a valid name first";
            }
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

document.getElementById('confirmCreate').addEventListener('click', () => {
 const difficulty = document.getElementById('difficultySelect').value;
 const playerCount = parseInt(document.getElementById('playerCount').value);

 socket.emit('createLobby', { difficulty, playerCount });
 document.getElementById('difficultyModal').classList.remove('visible');
});

    createBtn.onclick = () => {
      const name = nameInput.value.trim();
      if (!validateName(name)) {
        nameError.textContent = "Name must be 1-16 characters";
        return;
      }
      localStorage.setItem("playerName", name);
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
  if (msg === 'Lobby not found' || msg === 'Lobby full' || msg === 'Name taken') {
    const name = localStorage.getItem("playerName") || "";
    window.location.href = `/lobbycreation.html?error=${encodeURIComponent(msg.toLowerCase().replace(' ', '_'))}&name=${encodeURIComponent(name)}`;
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
    statusEl.textContent = 'Waiting for players...';
  } else if (!users.every(u => u.ready)) {
    statusEl.textContent = 'All players must ready up!';
  } else {
    statusEl.textContent = '';
  }
  });


socket.on('countdown', (seconds) => {
    const timer = document.getElementById('lobbyStatus');

    if (seconds > 0) {
      timer.style.fontSize = '1.5rem';
      timer.style.color = '#add8e6';
      timer.textContent = `Starting in ${seconds}...`;
} 
});

socket.on('userLeft', (userId) => {
    const container = document.querySelector(`.progress-container[data-userid="${userId}"]`);
    if (container) {
        container.remove();
        // Trigger a layout update if needed
        const progressRows = document.querySelectorAll('.progress-row');
        progressRows.forEach(row => {
            if (row.children.length === 1) {
                // If row has only one child, make it take full width
                row.style.justifyContent = 'flex-start';
                row.firstElementChild.style.flex = '1 0 100%';
            }
        });
    }
});

socket.on('startGame', ({ grid, rows, cols, mines, initialRevealed, users }) => {
    document.querySelector('.content-box').style.display = 'none';
    document.getElementById('readyUp').style.display = 'none';
    
    const currentUserId = socket.id;
    const opponents = users.filter(u => u.id !== currentUserId);
    
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
function createProgressBars(currentUserId, users) {
    const currentUser = users.find(u => u.id === currentUserId);
    const opponents = users.filter(u => u.id !== currentUserId);
    
    // Always put current player first
    const playersToDisplay = [currentUser, ...opponents];
    
    // Create rows with max 2 players per row
    let rows = [];
    for (let i = 0; i < playersToDisplay.length; i += 2) {
        const rowPlayers = playersToDisplay.slice(i, i + 2);
        rows.push(rowPlayers);
    }
    
    return `
        <div class="progress-rows-container">
            ${rows.map(rowPlayers => `
                <div class="progress-row">
                    ${rowPlayers.map(player => `
                        <div class="progress-container" data-userid="${player.id}">
                            <div class="progress-label">
                                ${player.id === currentUserId ? 'You' : player.name}
                            </div>
                            <progress class="progress-bar" value="0" max="100"></progress>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        </div>
    `;
}
    const gridElement = document.getElementById('minesweeperGrid');
    revealedCells = new Set(initialRevealed.map(c => `${c.x},${c.y}`));


for (let y = 0; y < rows; y++) {
 const row = document.createElement('div');
 row.className = 'gridRow';
 for (let x = 0; x < cols; x++) {
 const cell = createCell(x, y, revealedCells, grid);
 row.appendChild(cell);
 }
 gridElement.appendChild(row);
}


    const startTime = Date.now();
    timerInterval = setInterval(() => {
      document.getElementById('gameTimer').textContent = 
        `Time: ${Math.floor((Date.now() - startTime) / 1000)} s`;
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
    
    usersProgress.forEach(user => {
        let container = document.querySelector(`.progress-container[data-userid="${user.id}"]`);
        if (!container) {
            // If container doesn't exist (new player joined), recreate all progress bars
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
});

socket.on('gameOver', ({ winnerId, loserId, winnerName, loserName, grid, reason }) => {
  clearInterval(timerInterval);
  revealFullGrid(grid);

  const modal = document.getElementById('gameOverModal');
  const message = document.getElementById('gameOverMessage');
  const currentUserId = socket.id;

  message.className = '';
  
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