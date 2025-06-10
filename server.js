// FUNFACT
//  A cat named Félicette was launched into space in 1963 and came back ALIVE🐈.



const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');


// gameSettings | https://www.youtube.com/watch?v=tJNBOT1lvaI

const DIFFICULTY_SETTINGS = {
  beginner: { rows: 10, cols: 10, mines: 15 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 }
};
const LOBBY_TIMEOUT = 300000;
const PORT = 3000;
const lobbies = {};

// LobbyCodeCreation Logic | https://www.youtube.com/watch?v=kS7G2yI75bw
app.use(express.static(path.join(__dirname, 'public')));

app.get('/lobby/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  
  if (lobbies[code]) {
    res.sendFile(path.join(__dirname, 'public', 'lobby.html'));
  } else {
    res.redirect(`/lobbycreation.html?error=lobby_not_found&code=${code}`);
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
// Add this with other routes
app.get('/api/lobbies', (req, res) => {
  const lobbyList = Object.values(lobbies).map(lobby => ({
    code: lobby.code,
    host: lobby.users[0]?.name || 'Unknown',
    players: lobby.users.length,
    maxPlayers: lobby.maxPlayers,
    difficulty: Object.keys(DIFFICULTY_SETTINGS).find(
      key => DIFFICULTY_SETTINGS[key].rows === lobby.rows && 
            DIFFICULTY_SETTINGS[key].cols === lobby.cols && 
            DIFFICULTY_SETTINGS[key].mines === lobby.mines
    ) || 'custom',
    createdAt: lobby.createdAt
  }));
  res.json(lobbyList);
});
// GameGeneration Logic 
function generateGrid(rows, cols, mines, safeFirstCell) {
  const grid = Array(rows).fill().map(() => Array(cols).fill(0));
  let minesPlaced = 0;
  const protectedArea = new Set();

  // Add the safe first cell and its adjacent cells to protected area
  protectedArea.add(`${safeFirstCell.x},${safeFirstCell.y}`);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const px = safeFirstCell.x + dx;
      const py = safeFirstCell.y + dy;
      if (px >= 0 && px < cols && py >= 0 && py < rows) {
        protectedArea.add(`${px},${py}`);
      }
    }
  }

  // Place mines randomly, avoiding protected area
  while (minesPlaced < mines) {
    const x = Math.floor(Math.random() * cols);
    const y = Math.floor(Math.random() * rows);
    if (!protectedArea.has(`${x},${y}`) && grid[y][x] !== 'X') {
      grid[y][x] = 'X';
      minesPlaced++;
    }
  }

  // Calculate numbers for non-mine cells
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 'X') continue;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (x + dx >= 0 && x + dx < cols &&
              y + dy >= 0 && y + dy < rows &&
              grid[y + dy][x + dx] === 'X') {
            count++;
          }
        }
      }
      grid[y][x] = count;
    }
  }
  return grid;
}

function floodFill(grid, x, y, revealed, newlyRevealed) {
  const rows = grid.length;
  const cols = grid[0].length;
  const queue = [[x, y]];
  const visited = new Set();

  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    const key = `${cx},${cy}`;

    if (visited.has(key)) continue;
    if (cx < 0 || cx >= cols || cy < 0 || cy >= rows) continue;
    if (grid[cy][cx] === 'X') continue;
    if (revealed.has(key)) continue;

    visited.add(key);
    newlyRevealed.add(key);
    revealed.add(key);

    if (grid[cy][cx] === 0) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          queue.push([cx + dx, cy + dy]);
        }
      }
    }
  }
}
// Play Logic
function emitProgressUpdate(lobby) {
const totalSafe = lobby.rows * lobby.cols - lobby.mines;

  const usersProgress = lobby.users.map(user => {
    const revealedCount = user.revealed.size || 0;
    const initialRevealedCount = user.initialRevealed.size || 0;
    const flaggedCount = user.flagged.size || 0;

    const progressDenominator = totalSafe - initialRevealedCount;
    const progressNumerator = revealedCount - initialRevealedCount + flaggedCount;

    const progress = progressDenominator > 0
      ? Math.min(100, Math.round((progressNumerator / progressDenominator) * 100))
      : 0;

    return {
      id: user.id,
      name: user.name,
      progress
    };
  });

  io.to(lobby.code).emit('progressUpdate', usersProgress);
}

// what the Function name says.
function scheduleLobbyCleanup(lobby) {
  if (!lobby.cleanupTimeout) {
    lobby.cleanupTimeout = setTimeout(() => {
      if (lobby.users.length === 0) {
        delete lobbies[lobby.code];
      }
    }, LOBBY_TIMEOUT);
  }
}

function maintainLobbies() {
  setInterval(() => {
    const now = Date.now();
    Object.values(lobbies).forEach(lobby => {
      if (lobby.users.length === 0 && (now - lobby.createdAt) > LOBBY_TIMEOUT) {
        delete lobbies[lobby.code];
      }
    });
  }, 60000);
}

// actually create the Lobby | https://www.youtube.com/watch?v=Yhu7sck0gAA
io.on('connection', (socket) => {
  let currentLobby = null;

socket.on('createLobby', (settings) => { 
  
 console.log("Received lobby settings:", settings); 

  const { difficulty, playerCount } = settings;
  const { rows, cols, mines } = DIFFICULTY_SETTINGS[difficulty];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  lobbies[code] = {
    code,
    users: [],
    countdown: null,
    cleanupTimeout: null,
    createdAt: Date.now(),
    grid: null,
    rows, 
    cols,  
    mines, 
    maxPlayers: playerCount,
    
  };
  socket.emit('lobbyCreated', code);
});

// Join lobby-Logic
socket.on('joinLobby', ({ code, name }) => {
  const formattedCode = code.toUpperCase();
  const lobby = lobbies[formattedCode];

  if (!lobby) {
    return socket.emit('lobbyError', 'Lobby not found');
  }

  if (lobby.users.length >= lobby.maxPlayers) {
    return socket.emit('lobbyError', 'Lobby full');
  }

  if (lobby.users.some(u => u.name === name)) {
    return socket.emit('lobbyError', 'Name taken');
  }

    if (currentLobby) {
      const prevLobby = lobbies[currentLobby];
      const userIndex = prevLobby.users.findIndex(u => u.id === socket.id);
      if (userIndex !== -1) {
        prevLobby.users.splice(userIndex, 1);
        io.to(prevLobby.code).emit('updateUsers', prevLobby.users.map(u => ({
          name: u.name,
          ready: u.ready
        })));
      }
      socket.leave(currentLobby);
    }

    currentLobby = formattedCode;
    socket.join(formattedCode);

    if (lobby.cleanupTimeout) {
      clearTimeout(lobby.cleanupTimeout);
      lobby.cleanupTimeout = null;
    }

    lobby.users.push({
      id: socket.id,
      name: name.slice(0, 16),
      ready: false,
      revealed: new Set(),
      flagged: new Set(),
      flagsLeft: lobby.mines,
      initialRevealed: new Set(),
      winner: false,
       grid: null

    });

    io.to(formattedCode).emit('updateUsers', lobby.users.map(u => ({
      name: u.name,
      ready: u.ready
    })));
  });

  // READYYYYY???
  socket.on('readyUp', () => {
    if (!currentLobby) return;
    const lobby = lobbies[currentLobby];
    const user = lobby.users.find(u => u.id === socket.id);
    if (!user) return;

    user.ready = !user.ready;
  if (lobby.countdown && !lobby.users.every(u => u.ready)) {
    clearInterval(lobby.countdown);
    lobby.countdown = null;
    io.to(lobby.code).emit('countdown', 0); 
  }
    io.to(lobby.code).emit('updateUsers', lobby.users.map(u => ({
      name: u.name,
      ready: u.ready
    })));

  if (lobby.users.length >= 2 && 
      lobby.users.every(u => u.ready) && 
      !lobby.countdown) {
    startCountdown(lobby);
  }
  });

  // make it playable.
  socket.on('revealCell', ({ x, y }) => {
    if (!currentLobby) return;
    const lobby = lobbies[currentLobby];
    const user = lobby.users.find(u => u.id === socket.id);
    if (!user || !lobby.grid || user.winner) return;

    const cellKey = `${x},${y}`;
    if (user.revealed.has(cellKey) || user.flagged.has(cellKey)) return;

    if (lobby.grid[y][x] === 'X') {
      user.winner = false;
      const winner = lobby.users.find(u => u.id !== socket.id);
      if (winner) winner.winner = true;
      
      io.to(lobby.code).emit('gameOver', {
        winnerId: winner?.id,
        loserId: user.id,
        winnerName: winner?.name,
        loserName: user.name,
        grid: lobby.grid,
        reason: 'self-mine'
      });
      return;
    }

    const newlyRevealed = new Set();
    if (lobby.grid[y][x] === 0) {
      floodFill(lobby.grid, x, y, user.revealed, newlyRevealed);
    } else {
      newlyRevealed.add(cellKey);
      user.revealed.add(cellKey);
    }

socket.emit('gameUpdate', {
  userId: socket.id,
  cells: Array.from(newlyRevealed).map(c => {
    const [x, y] = c.split(',').map(Number);
    return { x, y, value: lobby.grid[y][x] };
  })
});


const totalSafe = lobby.rows * lobby.cols - lobby.mines;
    if (user.revealed.size === totalSafe) {
      user.winner = true;
        const losers = lobby.users.filter(u => u.id !== socket.id);

  io.to(lobby.code).emit('gameOver', {
    winnerId: user.id,
    loserIds: losers.map(u => u.id),
    winnerName: user.name,
    loserNames: losers.map(u => u.name),
    grid: lobby.grid,
    reason: 'win'
});
    }
    emitProgressUpdate(lobby);
  });

  socket.on('placeFlag', ({ x, y }) => {
    if (!currentLobby) return;
    const lobby = lobbies[currentLobby];
    const user = lobby.users.find(u => u.id === socket.id);
    if (!user || !lobby.grid || user.winner) return;

    const cellKey = `${x},${y}`;
    if (user.revealed.has(cellKey)) return;

    if (user.flagged.has(cellKey)) {
      user.flagged.delete(cellKey);
      user.flagsLeft++;
    } else {
      if (user.flagsLeft <= 0) return;
      user.flagged.add(cellKey);
      user.flagsLeft--;
    }

    io.to(lobby.code).emit('flagUpdate', {
      userId: socket.id,
      x,
      y,
      flagged: user.flagged.has(cellKey),
      flagsLeft: user.flagsLeft
    });
    emitProgressUpdate(lobby);
  });

  // why would you even want to leave... :((
socket.on('leaveLobby', () => {
  if (!currentLobby) return;
  const lobby = lobbies[currentLobby];
  const userIndex = lobby.users.findIndex(u => u.id === socket.id);
  if (userIndex === -1) return;

  const leavingUser = lobby.users.splice(userIndex, 1)[0];

  if (lobby.countdown) {
    clearInterval(lobby.countdown);
    lobby.countdown = null;
    io.to(lobby.code).emit('countdown', 0);
  }

  io.to(lobby.code).emit('userLeft', leavingUser.id);

  io.to(lobby.code).emit('updateUsers', lobby.users.map(u => ({
    name: u.name,
    ready: u.ready
  })));

  if (lobby.users.length === 0) {
    scheduleLobbyCleanup(lobby);
  } else {
    io.to(lobby.code).emit('gameOver', {
      winnerId: lobby.users[0]?.id,
      loserId: socket.id,
      winnerName: lobby.users[0]?.name,
      loserName: "Opponent",
      grid: lobby.grid,
      reason: 'left'
    });
  }

  socket.leave(lobby.code);
  currentLobby = null;
});


socket.on('disconnect', () => {
  if (!currentLobby) return;
  const lobby = lobbies[currentLobby];
  const userIndex = lobby.users.findIndex(u => u.id === socket.id);
  if (userIndex === -1) return;

  const disconnectedUser = lobby.users.splice(userIndex, 1)[0];

  if (lobby.countdown) {
    clearInterval(lobby.countdown);
    lobby.countdown = null;
    io.to(lobby.code).emit('countdown', 0);
  }

  io.to(lobby.code).emit('userLeft', disconnectedUser.id);

  io.to(lobby.code).emit('updateUsers', lobby.users.map(u => ({
    name: u.name,
    ready: u.ready
  })));

  if (lobby.users.length === 1 && lobby.grid && !lobby.users[0].winner) {
    io.to(lobby.code).emit('gameOver', {
      winnerId: lobby.users[0].id,
      loserId: disconnectedUser.id,
      winnerName: lobby.users[0].name,
      loserName: disconnectedUser.name,
      grid: lobby.grid,
      reason: 'disconnect'
    });
  }

  if (lobby.users.length === 0) {
    scheduleLobbyCleanup(lobby);
  }
  currentLobby = null;
});

  // what the function name says.
  function startCountdown(lobby) {
    let seconds = 3;
    lobby.countdown = setInterval(() => {
      io.to(lobby.code).emit('countdown', seconds);
      if (--seconds < 0) {
        clearInterval(lobby.countdown);
        lobby.countdown = null;
        initializeGame(lobby);
         io.to(lobby.code).emit('updateUsers', lobby.users.map(u => ({
        name: u.name,
        ready: u.ready 
      })));
      }
    }, 1000);
  }

  function initializeGame(lobby) {
    
  const safeFirstCell = {
    x: Math.floor(Math.random() * lobby.cols),
    y: Math.floor(Math.random() * lobby.rows)
    };

lobby.grid = generateGrid(lobby.rows, lobby.cols, lobby.mines, safeFirstCell);
    lobby.users.forEach(user => {
          user.ready = false; 

      user.revealed.clear();
      user.flagged.clear();
      user.flagsLeft = lobby.mines; 
      user.initialRevealed.clear();
      user.winner = false;

      const newlyRevealed = new Set();
      floodFill(lobby.grid, safeFirstCell.x, safeFirstCell.y, user.revealed, newlyRevealed);
      newlyRevealed.forEach(cell => {
        user.initialRevealed.add(cell);
        user.revealed.add(cell);
      });
    });

    io.to(lobby.code).emit('startGame', {
      grid: lobby.grid,
      rows: lobby.rows,
      cols: lobby.cols,
  mines: lobby.mines,
      initialRevealed: Array.from(lobby.users[0].revealed).map(cell => {
        const [x, y] = cell.split(',').map(Number);
        return { x, y, value: lobby.grid[y][x] };
      }),
      users: lobby.users.map(u => ({ id: u.id, name: u.name }))
    });
  }
});

maintainLobbies();
http.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));