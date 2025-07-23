const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const https = require('https');

require('dotenv').config();

const app = express();
const server = http.createServer(app);
app.use(express.json());
app.use(express.static('public')); 

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

//rename cooldown for ACCOUNT
const RENAME_COOLDOWN_DAYS = 0; 


// SETTINGSSSS
const DIFFICULTY_SETTINGS = {
  easy: { rows: 10, cols: 10, mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard: { rows: 30, cols: 16, mines: 99 }
};

const RECONNECT_TIMEOUT = 10000;
const LOBBY_CLEAR_TIME = 30000; 
const RECONNECT_PENALTY = 5000; 

const lobbies = {};
const playerSessions = {};
const lobbyTimeouts = {};


function generateLobbyCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function createGrid(rows, cols, mines, startX, startY) {
  const grid = Array(rows).fill().map(() => Array(cols).fill(0));
  const minePositions = [];
  const protectedArea = new Set();

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const px = startX + dx;
      const py = startY + dy;
      if (px >= 0 && px < cols && py >= 0 && py < rows) {
        protectedArea.add(`${px},${py}`);
      }
    }
  }

  while (minePositions.length < mines) {
    const x = Math.floor(Math.random() * cols);
    const y = Math.floor(Math.random() * rows);
    
    if (protectedArea.has(`${x},${y}`)) continue;
    
    if (grid[y][x] === 0) {
      grid[y][x] = 'X';
      minePositions.push([x, y]);
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const newX = x + dx;
          const newY = y + dy;
          
          if (newX >= 0 && newX < cols && newY >= 0 && newY < rows && grid[newY][newX] !== 'X') {
            grid[newY][newX]++;
          }
        }
      }
    }
  }
  
  return grid;
}

function getInitialRevealed(grid, startX, startY, rows, cols) {
  const revealed = [];
  const queue = [{x: startX, y: startY}];
  const visited = new Set();
  visited.add(`${startX},${startY}`);

  while (queue.length > 0) {
    const cell = queue.shift();
    revealed.push(cell);

    if (grid[cell.y][cell.x] !== 0) continue;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        
        const newX = cell.x + dx;
        const newY = cell.y + dy;
        
        if (newX < 0 || newX >= cols || newY < 0 || newY >= rows) continue;
        
        const key = `${newX},${newY}`;
        if (visited.has(key)) continue;
        
        if (grid[newY][newX] !== 'X') {
          visited.add(key);
          queue.push({x: newX, y: newY});
        }
      }
    }
  }
  
  return revealed;
}

function calculateProgress(gameState, playerState) {
  const totalSafeCells = gameState.rows * gameState.cols - gameState.mines;
  const playerRevealedCells = playerState.revealedCells.filter(
    cell => !playerState.initialRevealedCells.some(
      init => init.x === cell.x && init.y === cell.y
    )
  );
  
  const playerRevealedSafeCells = playerRevealedCells.filter(
    cell => gameState.grid[cell.y][cell.x] !== 'X'
  ).length;

  const revealableCells = totalSafeCells - playerState.initialRevealedCells.length;
  
  if (revealableCells <= 0) return 100;
  
  return Math.min(100, Math.floor((playerRevealedSafeCells / revealableCells) * 100));
}

app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/assets/images', 'minesweeperlogo.png'));
});
app.get('/lobby/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'lobby.html'));
});

app.get('/api/lobbies', (req, res) => {
  const activeLobbies = Object.values(lobbies)
    .filter(lobby => lobby.status === 'waiting')
    .map(lobby => ({
      code: lobby.code,
      host: lobby.host.name,
      players: lobby.users.length,
      maxPlayers: lobby.maxPlayers,
      difficulty: lobby.difficulty
    }));
  
  res.json(activeLobbies);
});

io.on('connection', (socket) => {
  let currentRoom = null;

  socket.on('joinRoom', (roomId) => {
    currentRoom = roomId;
    socket.join(roomId);
  });

socket.on('createLobby', ({ difficulty, playerCount }) => {
  const code = generateLobbyCode();
  const hostName = playerSessions[socket.id]?.name || "Host";
  
  const lobby = {
    code,
    host: { id: socket.id, name: hostName, ready: false },
    users: [{ id: socket.id, name: hostName, ready: false }],
    maxPlayers: playerCount,
    status: 'waiting',
    difficulty,
    spectators: [],
    gameState: null,
    countdownInterval: null,
    disconnectTimers: {},
    penalties: {},
    paused: false
  };
  
  if (lobby.countdownInterval) {
    clearInterval(lobby.countdownInterval);
    lobby.countdownInterval = null;
  }
  
  lobbies[code] = lobby;
  
  playerSessions[socket.id] = { name: hostName, lobby: code };
  socket.join(code);
  socket.emit('lobbyCreated', code);
});

  socket.on('joinLobby', ({ code, name }) => {
    const lobby = lobbies[code];

    if (!lobby) {
      socket.emit('lobbyError', 'Lobby not found');
      return;
    }
    
    if (lobby.users.length >= lobby.maxPlayers) {
      socket.emit('lobbyError', 'Lobby full');
      return;
    }
    
    if (lobby.users.some(user => user.name === name)) {
      socket.emit('lobbyError', 'Name taken');
      return;
    }

  if (lobby.status === 'completed') {
    lobby.status = 'waiting';
    lobby.gameState = null;
    lobby.spectators = [];
    lobby.disconnectTimers = {};
    lobby.penalties = {};
    lobby.paused = false;
    
    lobby.users.forEach(user => {
      user.ready = false;
    });
    
    if (lobbyTimeouts[code]) {
      clearTimeout(lobbyTimeouts[code]);
      delete lobbyTimeouts[code];
    }
  }

    playerSessions[socket.id] = { name, lobby: code };
    lobby.users.push({ id: socket.id, name, ready: false });
    socket.join(code);
    
    io.to(code).emit('updateUsers', lobby.users);
  });

  socket.on('checkPlayerStatus', ({ playerId }, callback) => {
    const session = playerSessions[playerId];
    if (!session || !session.lobby) return callback(false);
    
    const lobby = lobbies[session.lobby];
    const inGame = lobby && lobby.status === 'playing' && lobby.gameState?.playerStates?.[playerId];
    
    callback(inGame);
  });

  socket.on('readyUp', () => {
    const player = playerSessions[socket.id];
    if (!player || !player.lobby) return;
    
    const lobby = lobbies[player.lobby];
    const userIndex = lobby.users.findIndex(u => u.id === socket.id);
    
    if (userIndex !== -1) {
      const wasReady = lobby.users[userIndex].ready;
      lobby.users[userIndex].ready = !wasReady;
      io.to(lobby.code).emit('updateUsers', lobby.users);
      
      if (wasReady && lobby.countdownInterval) {
        clearInterval(lobby.countdownInterval);
        lobby.countdownInterval = null;
        lobby.status = 'waiting';
        io.to(lobby.code).emit('countdown', -1);
        return;
      }
      
      if (lobby.users.length >= 2 && lobby.users.every(user => user.ready) && lobby.status === 'waiting') {
        lobby.status = 'starting';
        startGame(lobby);
      }
    }
  });

  socket.on('playerReconnected', ({ oldId }) => {
    const session = playerSessions[oldId];
    if (!session || !session.lobby) return;

    playerSessions[socket.id] = { ...session };
    delete playerSessions[oldId];

    const lobby = lobbies[session.lobby];
    if (!lobby || lobby.status !== 'playing') return;

    const playerState = lobby.gameState.playerStates[oldId];
    if (playerState) {
      lobby.gameState.playerStates[socket.id] = playerState;
      delete lobby.gameState.playerStates[oldId];
    }

  if (lobby.penalties[oldId]) {
    lobby.penalties[socket.id] = (lobby.penalties[socket.id] || 0) + lobby.penalties[oldId];
    delete lobby.penalties[oldId];
  }

if (lobby.paused) {
  const pauseDuration = Date.now() - lobby.pauseStartTime;
  
  Object.values(lobby.gameState.playerStates).forEach(state => {
    if (state.status === 'alive') {
      state.pausedDuration += pauseDuration;
    }
  });
  
  lobby.paused = false;
}

const penalty = RECONNECT_PENALTY;
lobby.penalties[socket.id] = (lobby.penalties[socket.id] || 0) + penalty;
lobby.gameState.playerStates[socket.id].penalty += penalty;


    lobby.users.forEach(user => {
      if (user.id === oldId) user.id = socket.id;
    });

    if (lobby.disconnectTimers[oldId]) {
      clearTimeout(lobby.disconnectTimers[oldId]);
      delete lobby.disconnectTimers[oldId];
    }
    
    lobby.paused = false;
  io.to(lobby.code).emit('gameResumed', {
  reconnectedPlayerId: socket.id,
  penalty: penalty / 1000
});

  });

  socket.on('requestReconnectGameData', () => {
    const player = playerSessions[socket.id];
    if (!player || !player.lobby) return;

    const lobby = lobbies[player.lobby];
    if (!lobby || lobby.status !== 'playing') return;

    const playerState = lobby.gameState.playerStates[socket.id];
    if (!playerState) return;

    socket.emit('reconnectGameData', {
      grid: lobby.gameState.grid,
      rows: lobby.gameState.rows,
      cols: lobby.gameState.cols,
      mines: lobby.gameState.mines,
      revealedCells: playerState.revealedCells,
      flags: playerState.flags,
      users: lobby.users,
      startTime: playerState.startTime,
      pausedDuration: playerState.pausedDuration,
      penalty: playerState.penalty, 
      isPaused: lobby.paused
    });

    if (lobby.disconnectTimers[socket.id]) {
      clearTimeout(lobby.disconnectTimers[socket.id]);
      delete lobby.disconnectTimers[socket.id];
    }
  });

  socket.on('revealCell', ({ x, y }) => {
    const player = playerSessions[socket.id];
    if (!player || !player.lobby) return;

    const lobby = lobbies[player.lobby];
    if (!lobby || lobby.status !== 'playing' || lobby.paused) return;
    
    const gameState = lobby.gameState;
    const playerState = gameState.playerStates[socket.id];
    
    if (!playerState || playerState.status !== 'alive') return;
    
    if (playerState.revealedCells.some(cell => cell.x === x && cell.y === y) || 
        playerState.flags.some(cell => cell.x === x && cell.y === y)) {
      return;
    }
    
    if (gameState.grid[y][x] === 'X') {
      playerState.status = 'dead';
      playerState.endTime = Date.now();
      playerState.time = Math.floor((playerState.endTime - playerState.startTime - playerState.pausedDuration) / 1000);
      
      socket.emit('playerFailed', { x, y });
      io.to(lobby.code).emit('playerStatusChanged', {
        playerId: socket.id,
        status: 'dead'
      });
      
      checkGameCompletion(lobby);
      return;
    }
    
    playerState.revealedCells.push({ x, y });
    
    if (gameState.grid[y][x] === 0) {
      const queue = [{x, y}];
      const visited = new Set();
      visited.add(`${x},${y}`);
      
      while (queue.length > 0) {
        const current = queue.shift();
        
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            
            const newX = current.x + dx;
            const newY = current.y + dy;
            
            if (newX < 0 || newX >= gameState.cols || newY < 0 || newY >= gameState.rows) continue;
            
            const key = `${newX},${newY}`;
            if (visited.has(key)) continue;
            
            if (!playerState.revealedCells.some(cell => cell.x === newX && cell.y === newY) &&
                !playerState.flags.some(cell => cell.x === newX && cell.y === newY)) {
              playerState.revealedCells.push({ x: newX, y: newY });
              visited.add(key);
              
              if (gameState.grid[newY][newX] === 0) {
                queue.push({ x: newX, y: newY });
              }
            }
          }
        }
      }
    }
    
    playerState.progress = calculateProgress(gameState, playerState);
    
    const revealedCellsUpdate = [];
    for (const cell of playerState.revealedCells) {
      revealedCellsUpdate.push({
        x: cell.x,
        y: cell.y,
        value: gameState.grid[cell.y][cell.x]
      });
    }
    
    socket.emit('gameUpdate', {
      cells: revealedCellsUpdate,
      revealed: playerState.revealedCells
    });
    
    lobby.spectators.forEach(spectator => {
      if (spectator.spectating === socket.id) {
        io.to(spectator.id).emit('gameUpdate', {
          cells: revealedCellsUpdate,
          revealed: playerState.revealedCells
        });
      }
    });
    
    const totalSafeCells = gameState.rows * gameState.cols - gameState.mines;
    const revealedSafeCells = playerState.revealedCells.filter(
      cell => gameState.grid[cell.y][cell.x] !== 'X'
    ).length;
    
    if (revealedSafeCells === totalSafeCells) {
      playerState.status = 'finished';
      playerState.endTime = Date.now();
      playerState.time = Math.floor((playerState.endTime - playerState.startTime - playerState.pausedDuration) / 1000);
      
      io.to(lobby.code).emit('playerStatusChanged', {
        playerId: socket.id,
        status: 'finished'
      });
      
      checkGameCompletion(lobby);
    }
    
    updateProgress(lobby);
  });

  socket.on('placeFlag', ({ x, y }) => {
    const player = playerSessions[socket.id];
    if (!player || !player.lobby) return;
    
    const lobby = lobbies[player.lobby];
    if (!lobby || lobby.status !== 'playing' || lobby.paused) return;
    
    const gameState = lobby.gameState;
    const playerState = gameState.playerStates[socket.id];
    
    if (!playerState || playerState.status !== 'alive') return;
    
    const flagIndex = playerState.flags.findIndex(
      flag => flag.x === x && flag.y === y
    );
    
    if (flagIndex === -1) {
      if (playerState.flags.length < gameState.mines) {
        playerState.flags.push({ x, y });
      }
    } else {
      playerState.flags.splice(flagIndex, 1);
    }
    
    const flagsLeft = gameState.mines - playerState.flags.length;
    socket.emit('flagUpdate', {
      userId: socket.id,
      x,
      y,
      flagged: flagIndex === -1,
      flagsLeft
    });

    lobby.spectators.forEach(spectator => {
      if (spectator.spectating === socket.id) {
        io.to(spectator.id).emit('flagUpdate', {
          userId: socket.id,
          x,
          y,
          flagged: flagIndex === -1,
          flagsLeft
        });
      }
    });
  });

  socket.on('spectatePlayer', (targetPlayerId) => {
    const player = playerSessions[socket.id];
    if (!player || !player.lobby) return;
    
    const lobby = lobbies[player.lobby];
    if (!lobby || lobby.status !== 'playing') return;
    
    const targetPlayer = lobby.users.find(u => u.id === targetPlayerId);
    if (!targetPlayer) return;
    
    const targetPlayerState = lobby.gameState.playerStates[targetPlayerId];
    if (!targetPlayerState || targetPlayerState.status !== 'alive') return;
    
    const existingSpectatorIndex = lobby.spectators.findIndex(
      s => s.id === socket.id
    );
    
    if (existingSpectatorIndex === -1) {
      lobby.spectators.push({
        id: socket.id,
        spectating: targetPlayerId
      });
    } else {
      lobby.spectators[existingSpectatorIndex].spectating = targetPlayerId;
    }
    
    socket.emit('spectateUpdate', {
      grid: lobby.gameState.grid,
      rows: lobby.gameState.rows,
      cols: lobby.gameState.cols,
      revealedCells: targetPlayerState.revealedCells,
      flags: targetPlayerState.flags,
      time: Math.floor((Date.now() - targetPlayerState.startTime - targetPlayerState.pausedDuration) / 1000),
      flagsLeft: lobby.gameState.mines - targetPlayerState.flags.length
    });
  });

  socket.on('disconnect', () => {
    const player = playerSessions[socket.id];
    if (!player || !player.lobby) return;
    
    const lobby = lobbies[player.lobby];
    if (!lobby) return;
    
    if (lobby.status === 'playing') {
      const playerState = lobby.gameState.playerStates[socket.id];
      
      if (playerState && playerState.status === 'alive') {
        lobby.disconnectTimers[socket.id] = setTimeout(() => {
      if (lobby.paused) {
        const pauseDuration = Date.now() - lobby.pauseStartTime;
    
    Object.values(lobby.gameState.playerStates).forEach(state => {
      if (state.status === 'alive') {
        state.pausedDuration += pauseDuration;
      }
    });
    
    lobby.paused = false;
  }
          
          const userIndex = lobby.users.findIndex(u => u.id === socket.id);
          if (userIndex !== -1) {
            lobby.users.splice(userIndex, 1);
          }
          
          const alivePlayers = lobby.users.filter(user => 
            lobby.gameState.playerStates[user.id]?.status === 'alive'
          );
          
          if (alivePlayers.length <= 1) {
            checkGameCompletion(lobby);
          }
          
          io.to(lobby.code).emit('playerDisconnected', {
            playerId: socket.id,
            timeout: true
          });
          
          delete lobby.disconnectTimers[socket.id];
        }, RECONNECT_TIMEOUT);
        
      if (!lobby.paused) {
        lobby.paused = true;
        lobby.pauseStartTime = Date.now(); 
        io.to(lobby.code).emit('gamePaused', {
          playerId: socket.id,
          timeout: RECONNECT_TIMEOUT / 1000
        });
        }
      }
    }
    
    const userIndex = lobby.users.findIndex(u => u.id === socket.id);
    if (userIndex !== -1) {
      lobby.users.splice(userIndex, 1);
      
      if (lobby.host.id === socket.id && lobby.users.length > 0) {
        lobby.host = lobby.users[0];
      }
      
if (lobby.users.length === 0 && lobby.status !== 'playing') {
  if (lobbyTimeouts[lobby.code]) {
    clearTimeout(lobbyTimeouts[lobby.code]);
  }
  lobbyTimeouts[lobby.code] = setTimeout(() => {
    if (lobby.users.length === 0 && lobby.status !== 'playing') {
      delete lobbies[lobby.code];
      delete lobbyTimeouts[lobby.code];
      console.log(`Lobby ${lobby.code} deleted due to inactivity.`);
    }
    }, LOBBY_CLEAR_TIME);
      } else {
        io.to(lobby.code).emit('updateUsers', lobby.users);
        io.to(lobby.code).emit('userLeft', socket.id);
      }
    }
    
    const spectatorIndex = lobby.spectators.findIndex(s => s.id === socket.id);
    if (spectatorIndex !== -1) {
      lobby.spectators.splice(spectatorIndex, 1);
    }
  });

  function startGame(lobby) {
    const settings = DIFFICULTY_SETTINGS[lobby.difficulty];
    const startX = Math.floor(Math.random() * settings.cols);
    const startY = Math.floor(Math.random() * settings.rows);

    const grid = createGrid(settings.rows, settings.cols, settings.mines, startX, startY);
    const initialRevealed = getInitialRevealed(grid, startX, startY, settings.rows, settings.cols);
    
    lobby.status = 'playing';
    lobby.gameState = {
      grid,
      rows: settings.rows,
      cols: settings.cols,
      mines: settings.mines,
      difficulty: lobby.difficulty,
      playerStates: {}
    };
    
    lobby.users.forEach(user => {
      lobby.gameState.playerStates[user.id] = {
        revealedCells: [...initialRevealed],
        initialRevealedCells: [...initialRevealed],
        flags: [],
        status: 'alive',
        progress: 0,
        startTime: null,
        endTime: null,
        pausedDuration: 0,
        penalty: 0
      };
    });
    
    runCountdown(lobby, settings, grid, initialRevealed);
  }

  function runCountdown(lobby, settings, grid, initialRevealed) {
    if (lobby.countdownInterval) {
      clearInterval(lobby.countdownInterval);
    }
    
    lobby.status = 'starting';
    io.to(lobby.code).emit('countdown', 3);
    
    let countdown = 2;
    lobby.countdownInterval = setInterval(() => {
      io.to(lobby.code).emit('countdown', countdown);
      countdown--;
      
      if (countdown < 0) {
        clearInterval(lobby.countdownInterval);
        lobby.countdownInterval = null;
        lobby.status = 'playing';
        
        lobby.users.forEach(user => {
          lobby.gameState.playerStates[user.id].startTime = Date.now();
        });
        
        io.to(lobby.code).emit('startGame', {
          grid,
          rows: settings.rows,
          cols: settings.cols,
          mines: settings.mines,
          initialRevealed,
          users: lobby.users
        });
      }
    }, 1000);
  }

  function updateProgress(lobby) {
    const progressData = lobby.users.map(user => {
      const playerState = lobby.gameState.playerStates[user.id];
      return {
        id: user.id,
        name: user.name,
        progress: playerState.progress
      };
    });
    
    io.to(lobby.code).emit('progressUpdate', progressData);
  }

function checkGameCompletion(lobby) {
    const allPlayers = lobby.users;
    const alivePlayers = allPlayers.filter(user => {
    const state = lobby.gameState.playerStates[user.id];
    return state && state.status === 'alive';
  });
  
  if (alivePlayers.length === 1 && allPlayers.length === 1) {
    const winner = alivePlayers[0];
    const winnerState = lobby.gameState.playerStates[winner.id];
    winnerState.status = 'finished';
    winnerState.endTime = Date.now();
    winnerState.time = Math.floor(
      (winnerState.endTime - winnerState.startTime - winnerState.pausedDuration) / 1000
    );
    
    io.to(lobby.code).emit('playerStatusChanged', {
      playerId: winner.id,
      status: 'finished'
    });
  }

    const gameCompleted = allPlayers.every(user => {
      const state = lobby.gameState.playerStates[user.id];
      return state && (state.status === 'dead' || state.status === 'finished' || state.status === 'disconnected');
    });

    if (gameCompleted) {
      const results = allPlayers.map(user => {
        const state = lobby.gameState.playerStates[user.id];
        let baseTime = 0;
        
  if (state) {
    if (state.status === 'dead' || state.status === 'finished') {
      baseTime = Math.floor(
        (state.endTime - state.startTime - state.pausedDuration) / 1000
      );
    } 
    else if (state.status === 'disconnected') {
      baseTime = Math.floor(
        (Date.now() - state.startTime - state.pausedDuration) / 1000
      );
          }
        }

        const penalty = lobby.penalties[user.id] ? 
          Math.floor(lobby.penalties[user.id] / 1000) : 0;
        
        return {
          id: user.id,
          name: user.name,
          status: state?.status === 'finished' ? 'winner' : 'loser',
          time: baseTime + penalty,
          penalty: penalty,
          progress: state?.progress || 0
        };
      });

      io.to(lobby.code).emit('gameOver', { results, grid: lobby.gameState.grid });
      lobby.status = 'completed';
    } else {
      const finishedPlayers = allPlayers.filter(user => {
        const state = lobby.gameState.playerStates[user.id];
        return state && state.status === 'finished';
      });

      const playingPlayers = allPlayers.filter(user => {
        const state = lobby.gameState.playerStates[user.id];
        return state && state.status === 'alive';
      });

      if (finishedPlayers.length > 0 || playingPlayers.length > 0) {
        io.to(lobby.code).emit('intermediatePodium', {
          finishedPlayers: finishedPlayers.map(user => ({
            id: user.id,
            name: user.name,
            status: 'winner',
            time: lobby.gameState.playerStates[user.id]?.time,
            progress: lobby.gameState.playerStates[user.id]?.progress
          })),
          playingPlayers: playingPlayers.map(user => ({
            id: user.id,
            name: user.name
          }))
        });
      }
    }
  }
});



const ROOT_DIR = path.resolve(__dirname);
const USER_DATA_DIR = path.join(ROOT_DIR, 'userDATA');

if (!fs.existsSync(USER_DATA_DIR)) {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
}



app.get('/stats/:username', (req, res) => {
    const username = req.params.username;
    res.sendFile(path.join(__dirname, 'public', 'stats.html'));
});

app.get('/api/getStats/:username', (req, res) => {
    const username = req.params.username.toLowerCase();

    fs.readdir(USER_DATA_DIR, (err, files) => {
        if (err) {
            console.error('Failed to read user data dir:', err);
            return res.status(500).json({ error: 'Server error' });
        }

        const jsonFiles = files.filter(f => f.endsWith('.json'));

        let foundUserFile = null;

        for (const file of jsonFiles) {
            const data = JSON.parse(fs.readFileSync(path.join(USER_DATA_DIR, file), 'utf-8'));
            if (data.username && data.username.toLowerCase() === username) {
                foundUserFile = path.join(USER_DATA_DIR, file);
                break;
            }
        }

        if (!foundUserFile) {
            return res.status(404).json({ error: 'User not found' });
        }

        const stats = JSON.parse(fs.readFileSync(foundUserFile, 'utf-8'));

        res.json({
            username: stats.username,
            multiplayer: stats.multiplayer || {},    
            singleplayer: stats.singleplayer || {},
            combined: stats.combined || {}
        });
    });
});

app.post('/api/createUser', (req, res) => {
  const { uid, username, email } = req.body;
  if (!uid || !username || !email) {
    return res.status(400).json({ message: 'Missing data' });
  }

  const userFile = path.join(USER_DATA_DIR, `${uid}.json`);
  if (fs.existsSync(userFile)) {
    return res.status(400).json({ message: 'User already exists' });
  }

  const userData = {
    uid,
    username,
    email,
    createdAt: new Date().toISOString(),
    nameHistory: []
  };

  try {
    fs.writeFileSync(userFile, JSON.stringify(userData, null, 2), 'utf8');
    res.json({ message: 'User created successfully' });
  } catch (err) {
    console.error('Error writing user file:', err);
    res.status(500).json({ message: 'Error saving user data' });
  }
});

app.post('/api/deleteUser', (req, res) => {
  const { uid } = req.body;
  const userFile = path.join(USER_DATA_DIR, `${uid}.json`);
  try {
    if (fs.existsSync(userFile)) {
      fs.unlinkSync(userFile);
      res.json({ message: 'User file deleted' });
    } else {
      res.json({ message: 'User file not found' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error deleting file' });
  }
});
app.post('/api/checkUsername', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ exists: false });

  const userFiles = fs.readdirSync(USER_DATA_DIR);
  const exists = userFiles.some(file => {
    const userData = JSON.parse(fs.readFileSync(path.join(USER_DATA_DIR, file), 'utf8'));
    return userData.username.toLowerCase() === username.toLowerCase();
  });

  res.json({ exists });
});


app.post('/api/updateUser', (req, res) => {
  const { uid, newUsername, email } = req.body;
  const userFile = path.join(USER_DATA_DIR, `${uid}.json`);

  if (!fs.existsSync(userFile)) {
    return res.status(404).json({ message: 'User not found' });
  }

  try {
    const userData = JSON.parse(fs.readFileSync(userFile, 'utf8'));
    const oldUsername = userData.username;

    if (oldUsername !== newUsername) {
      const lastChange = userData.nameHistory[userData.nameHistory.length - 1];
      if (lastChange) {
        const lastDate = new Date(lastChange.changedAt);
        const now = new Date();
        const diffMs = now - lastDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffDays < RENAME_COOLDOWN_DAYS) {
          const remainingMs = RENAME_COOLDOWN_DAYS * 24 * 60 * 60 * 1000 - diffMs;
          const remainingDays = Math.floor(remainingMs / (1000 * 60 * 60 * 24));
          const remainingHours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

          return res.status(400).json({
            message: `You can change your name again in ${remainingDays}d ${remainingHours}h ${remainingMinutes}m`
          });
        }
      }

      userData.nameHistory.push({
        name: oldUsername,
        changedAt: new Date().toISOString()
      });
    }

    userData.username = newUsername;
    userData.email = email;

    fs.writeFileSync(userFile, JSON.stringify(userData, null, 2), 'utf8');
    res.json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ message: 'Error updating user' });
  }
});
app.post('/api/getUser', (req, res) => {
  const { uid } = req.body;
  const userFile = path.join(USER_DATA_DIR, `${uid}.json`);
  
  if (!fs.existsSync(userFile)) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  try {
    const data = fs.readFileSync(userFile, 'utf8');
    const userData = JSON.parse(data);
    res.json(userData);
  } catch (err) {
    res.status(500).json({ error: 'Error reading user data' });
  }
});
app.get('/api/getAllUsernames', (req, res) => {
  try {
    const userFiles = fs.readdirSync(USER_DATA_DIR);
    const usernames = userFiles.map(file => {
      const userData = JSON.parse(fs.readFileSync(path.join(USER_DATA_DIR, file), 'utf8'));
      return userData.username;
    });
    res.json(usernames);
  } catch (err) {
    console.error('Error fetching usernames:', err);
    res.status(500).json({ message: 'Failed to fetch usernames' });
  }
});
app.post('/submit', async (req, res) => {
  const token = req.body['h-captcha-response'];
  const secret = '33f81284-b120-4654-b0a0-3d7c76061da6';

  const options = {
    hostname: 'hcaptcha.com',
    path: '/siteverify',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };

  const postData = `secret=${secret}&response=${token}`;
  options.headers['Content-Length'] = Buffer.byteLength(postData);

  const request = https.request(options, (response) => {
    let data = '';
    response.on('data', (chunk) => { data += chunk; });
    response.on('end', () => {
      try {
        const result = JSON.parse(data);
        console.log('Captcha verification result:', result);
        if (result.success) {
          res.json({ success: true });
        } else {
          res.status(400).json({
            success: false,
            message: 'Captcha validation failed',
            error: result['error-codes']
          });
        }
      } catch (err) {
        res.status(500).json({ success: false, message: 'Server error during captcha verification' });
      }
    });
  });
  request.on('error', (err) => {
    res.status(500).json({ success: false, message: 'Server error during captcha verification' });
  });
  request.write(postData);
  request.end();
});
app.post('/recaptcha', async (req, res) => {
  const token = req.body.token;
  const secret = process.env.RECAPTCHA_SECRET_KEY;

  if (!token) {
    return res.json({ success: false, message: 'Token fehlt' });
  }

  try {
    const verifyRes = await axios.post(
      `https://www.google.com/recaptcha/api/siteverify`,
      null,
      {
        params: {
          secret: secret,
          response: token,
        },
      }
    );

    if (verifyRes.data.success) {
      res.json({ success: true });
    } else {
      res.json({ success: false, message: verifyRes.data['error-codes'] });
    }
  } catch (err) {
    res.json({ success: false, message: 'Fehler bei Anfrage an Google' });
  }
});



const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));