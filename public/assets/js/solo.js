const GRID_SIZE = 10;
const MINE_COUNT = 15;
let timerInterval;
let startTime;
let revealedCells = new Set();
let flaggedCells = new Set();
let flagsLeft = MINE_COUNT;
let grid;
let gameActive = false;
let firstClick = true;
const BEST_TIME_KEY = 'minesweeperBestTime';
let gameTime = 0;

function initGame() {
  
  gameActive = true;
  firstClick = true;
  clearInterval(timerInterval);
  revealedCells = new Set();
  flaggedCells = new Set();
  flagsLeft = MINE_COUNT;
  grid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(0));
  
  const gridElement = document.getElementById('minesweeperGrid');
  gridElement.innerHTML = '';
  
  for (let y = 0; y < GRID_SIZE; y++) {
    const row = document.createElement('div');
    row.className = 'gridRow';
    for (let x = 0; x < GRID_SIZE; x++) {
      const cell = document.createElement('div');
      cell.className = 'gridCell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.textContent = '';
      row.appendChild(cell);
    }
    gridElement.appendChild(row);
  }
  document.getElementById('winModal').style.display = 'none';

  document.getElementById('flagCounter').textContent = `Flags left: ${flagsLeft}`;
  document.getElementById('gameTimer').textContent = 'Time: 0 s';
  document.querySelectorAll('.gridCell').forEach(cell => {
    cell.onclick = handleClick;
    cell.oncontextmenu = handleRightClick;
  });
}

function generateGrid(safeX, safeY) {
  const protectedArea = new Set();
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const px = safeX + dx;
      const py = safeY + dy;
      if (px >= 0 && px < GRID_SIZE && py >= 0 && py < GRID_SIZE) {
        protectedArea.add(`${px},${py}`);
      }
    }
  }

  let minesPlaced = 0;
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
          if (y + dy >= 0 && y + dy < GRID_SIZE &&
              x + dx >= 0 && x + dx < GRID_SIZE &&
              grid[y + dy][x + dx] === 'X') count++;
        }
      }
      grid[y][x] = count;
    }
  }
}

function handleClick(event) {
  if (!gameActive) return;
  const cell = event.target;
  const x = parseInt(cell.dataset.x);
  const y = parseInt(cell.dataset.y);
  
  if (firstClick) {
    firstClick = false;
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
    generateGrid(x, y);
  }

  if (flaggedCells.has(`${x},${y}`) || revealedCells.has(`${x},${y}`)) return;

  if (grid[y][x] === 'X') {
    gameActive = false;
    clearInterval(timerInterval);
    revealFullGrid();
    return;
  }

  floodFill(x, y);
  checkWin();
}

function handleRightClick(event) {
  if (!gameActive) return;
  event.preventDefault();
  const cell = event.target;
  const x = parseInt(cell.dataset.x);
  const y = parseInt(cell.dataset.y);
  const key = `${x},${y}`;

  if (revealedCells.has(key)) return;

  if (flaggedCells.has(key)) {
    flaggedCells.delete(key);
    flagsLeft++;
    cell.textContent = '';
  } else {
    if (flagsLeft <= 0) return;
    flaggedCells.add(key);
    flagsLeft--;
    cell.textContent = '🚩';
  }

  cell.classList.toggle('flagged');
  document.getElementById('flagCounter').textContent = `Flags left: ${flagsLeft}`;
}

function floodFill(x, y) {
  const queue = [[x, y]];
  const visited = new Set();

  while (queue.length > 0) {
    const [cx, cy] = queue.shift();
    const key = `${cx},${cy}`;

    if (visited.has(key)) continue;
    if (cx < 0 || cx >= GRID_SIZE || cy < 0 || cy >= GRID_SIZE) continue;
    if (grid[cy][cx] === 'X') continue;
    if (revealedCells.has(key) || flaggedCells.has(key)) continue;

    visited.add(key);
    revealedCells.add(key);
    const cell = document.querySelector(`[data-x="${cx}"][data-y="${cy}"]`);
    cell.classList.add('revealed');
    cell.textContent = grid[cy][cx] || '';

    if (grid[cy][cx] === 0) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          queue.push([cx + dx, cy + dy]);
        }
      }
    }
  }
}

function checkWin() {
  const totalSafe = GRID_SIZE * GRID_SIZE - MINE_COUNT;
  if (revealedCells.size === totalSafe) {
    gameActive = false;
    clearInterval(timerInterval);
    gameTime = Math.floor((Date.now() - startTime) / 1000);
    showWinModal(gameTime);
  }
}
function showWinModal(timeTaken) {
  let bestTime = localStorage.getItem(BEST_TIME_KEY);
  
  if (!bestTime || timeTaken < parseInt(bestTime)) {
    bestTime = timeTaken;
    localStorage.setItem(BEST_TIME_KEY, bestTime.toString());
  }
  
  document.getElementById('winTime').textContent = timeTaken;
  document.getElementById('bestTime').textContent = bestTime || 'N/A';
  document.getElementById('winModal').style.display = 'flex';

  document.getElementById('restartButton').onclick = function() {
    document.getElementById('winModal').style.display = 'none';
    initGame();
  };
}


document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('closeWinModal').onclick = function() {
    document.getElementById('winModal').style.display = 'none';
  };
});



function revealFullGrid() {
  grid.forEach((row, y) => {
    row.forEach((cellValue, x) => {
      const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
      cell.classList.add('revealed');
      cell.textContent = cellValue || '';
      if (cellValue === 'X') cell.classList.add('mine');
    });
  });
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  document.getElementById('gameTimer').textContent = `Time: ${elapsed} s`;
}
  document.getElementById('backButtonIndex').onclick = () => {
    window.location.href = '/';
  };
    document.getElementById('restartButton').onclick = function() {
    initGame();
  };
    initGame();
