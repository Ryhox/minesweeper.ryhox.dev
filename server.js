const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

const LOBBY_TIMEOUT = 300000;
const PORT = 3000;
const GRID_SIZE = 10;
const MINE_COUNT = 15;
const lobbies = {};

app.use(express.static(path.join(__dirname, 'public')));

app.get('/lobby/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  
  // Only serve the page if lobby exists
  if (lobbies[code]) {
    res.sendFile(path.join(__dirname, 'public', 'lobby.html'));
  } else {
    res.redirect(`/lobbycreation.html?error=lobby_not_found&code=${code}`);
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function generateGrid(safeFirstCell) {
  const grid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
  let minesPlaced = 0;
  const protectedArea = new Set();

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const px = safeFirstCell.x + dx;
      const py = safeFirstCell.y + dy;
      if (px >= 0 && px < GRID_SIZE && py >= 0 && py < GRID_SIZE) {
        protectedArea.add(`${px},${py}`);
      }
    }
  }

  while (minesPlaced < MINE_COUNT) {
    const x = Math.floor(Math.random() * GRID_SIZE);
    const y = Math.floor(Math.random() * GRID_SIZE);
    if (!protectedArea.has(`${x},${y}`) && grid[y][x] !== 'X') {
      grid[y][x] = 'X';
      minesPlaced++;
    }
  }

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      if (grid[y][x] === 'X') continue;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (x + dx >= 0 && x + dx < GRID_SIZE &&
              y + dy >= 0 && y + dy < GRID_SIZE &&
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
  const queue = [[x, y]];
  const visited = new Set();

  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    const key = `${cx},${cy}`;

    if (visited.has(key)) continue;
    if (cx < 0 || cx >= GRID_SIZE || cy < 0 || cy >= GRID_SIZE) continue;
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

function emitProgressUpdate(lobby) {
  const totalSafe = GRID_SIZE * GRID_SIZE - MINE_COUNT;

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

// Socket.IO
io.on('connection', (socket) => {
  let currentLobby = null;

  socket.on('createLobby', () => {
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
      grid: null
    };
    socket.emit('lobbyCreated', code);
  });

  socket.on('joinLobby', ({ code, name }) => {
    const formattedCode = code.toUpperCase();
    const lobby = lobbies[formattedCode];

  if (!lobby) {
    return socket.emit('lobbyError', 'Lobby not found');
  }

    if (lobby.users.length >= 2) {
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
      flagsLeft: MINE_COUNT,
      initialRevealed: new Set(),
      winner: false,
        grid: null // ADD THIS

    });

    io.to(formattedCode).emit('updateUsers', lobby.users.map(u => ({
      name: u.name,
      ready: u.ready
    })));
  });

  socket.on('readyUp', () => {
    if (!currentLobby) return;
    const lobby = lobbies[currentLobby];
    const user = lobby.users.find(u => u.id === socket.id);
    if (!user) return;

    user.ready = !user.ready;
  if (lobby.countdown && !lobby.users.every(u => u.ready)) {
    clearInterval(lobby.countdown);
    lobby.countdown = null;
    io.to(lobby.code).emit('countdown', 0); // Hide timer on clients
  }
    io.to(lobby.code).emit('updateUsers', lobby.users.map(u => ({
      name: u.name,
      ready: u.ready
    })));

  if (lobby.users.length === 2 && 
      lobby.users.every(u => u.ready) && 
      !lobby.countdown) {
    startCountdown(lobby);
  }
  });

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


    const totalSafe = GRID_SIZE * GRID_SIZE - MINE_COUNT;
    if (user.revealed.size === totalSafe) {
      user.winner = true;
      io.to(lobby.code).emit('gameOver', {
        winnerId: user.id,
        loserId: lobby.users.find(u => u.id !== socket.id)?.id,
        winnerName: user.name,
        loserName: lobby.users.find(u => u.id !== socket.id)?.name,
        grid: lobby.grid,
        reason: 'completed'
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

  socket.on('leaveLobby', () => {
    if (!currentLobby) return;
    const lobby = lobbies[currentLobby];
    const userIndex = lobby.users.findIndex(u => u.id === socket.id);
    if (userIndex === -1) return;

    lobby.users.splice(userIndex, 1);

        if (lobby.countdown) {
      clearInterval(lobby.countdown);
      lobby.countdown = null;
      io.to(lobby.code).emit('countdown', 0);
    }

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
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    };

    lobby.grid = generateGrid(safeFirstCell);
    lobby.users.forEach(user => {
          user.ready = false; 

      user.revealed.clear();
      user.flagged.clear();
      user.flagsLeft = MINE_COUNT;
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
      initialRevealed: Array.from(lobby.users[0].revealed).map(cell => {
        const [x, y] = cell.split(',').map(Number);
        return { x, y, value: lobby.grid[y][x] };
      }),
      users: lobby.users.map(u => ({ id: u.id, name: u.name }))
    });
  }
});

maintainLobbies();
http.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));
