// Default settings
const DEFAULT_GRID_WIDTH = 10;
const DEFAULT_GRID_HEIGHT = 10;
const DEFAULT_MINE_COUNT = 15;

// Current game settings (mutable)
let GRID_WIDTH = DEFAULT_GRID_WIDTH;
let GRID_HEIGHT = DEFAULT_GRID_HEIGHT;
let MINE_COUNT = DEFAULT_MINE_COUNT;

let timerInterval;
let startTime;
let revealedCells = new Set();
let flaggedCells = new Set();
let flagsLeft;
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
  grid = Array(GRID_HEIGHT).fill().map(() => Array(GRID_WIDTH).fill(0));

  const gridElement = document.getElementById('minesweeperGrid');
  gridElement.innerHTML = '';

  for (let y = 0; y < GRID_HEIGHT; y++) {
    const row = document.createElement('div');
    row.className = 'gridRow';
    for (let x = 0; x < GRID_WIDTH; x++) {
      const cell = document.createElement('div');
      cell.className = 'gridCell';
      cell.dataset.x = x;
      cell.dataset.y = y;
      cell.textContent = '';
      row.appendChild(cell);
    }
    gridElement.appendChild(row);
  }

  document.getElementById('soloWinModal').style.display = 'none';
  document.getElementById('flagCounter').textContent = `Flags left: ${flagsLeft}`;
  document.getElementById('gameTimer').textContent = 'Time: 0 s';

  document.querySelectorAll('.gridCell').forEach(cell => {
    cell.onclick = handleClick;
    cell.oncontextmenu = handleRightClick;
    cell.classList.remove('revealed', 'flagged', 'mine');
    cell.textContent = '';
  });
}

function generateGrid(safeX, safeY) {
  const protectedArea = new Set();
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const px = safeX + dx;
      const py = safeY + dy;
      if (px >= 0 && px < GRID_WIDTH && py >= 0 && py < GRID_HEIGHT) {
        protectedArea.add(`${px},${py}`);
      }
    }
  }

  let minesPlaced = 0;
  while (minesPlaced < MINE_COUNT) {
    const x = Math.floor(Math.random() * GRID_WIDTH);
    const y = Math.floor(Math.random() * GRID_HEIGHT);

    if (!protectedArea.has(`${x},${y}`) && grid[y][x] !== 'X') {
      grid[y][x] = 'X';
      minesPlaced++;
    }
  }

  for (let y = 0; y < GRID_HEIGHT; y++) {
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (grid[y][x] === 'X') continue;
      let count = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (
            y + dy >= 0 &&
            y + dy < GRID_HEIGHT &&
            x + dx >= 0 &&
            x + dx < GRID_WIDTH &&
            grid[y + dy][x + dx] === 'X'
          )
            count++;
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

  const key = `${x},${y}`;
  if (flaggedCells.has(key) || revealedCells.has(key)) return;

  if (grid[y][x] === 'X') {
    gameActive = false;
    clearInterval(timerInterval);
    revealFullGrid();
    gameTime = Math.floor((Date.now() - startTime) / 1000);
    showWinModal(gameTime, false); 
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
    if (cx < 0 || cx >= GRID_WIDTH || cy < 0 || cy >= GRID_HEIGHT) continue;
    if (grid[cy][cx] === 'X') continue;
    if (revealedCells.has(key) || flaggedCells.has(key)) continue;

    visited.add(key);
    revealedCells.add(key);
    const cell = document.querySelector(`[data-x="${cx}"][data-y="${cy}"]`);
    if (!cell) continue;
    cell.classList.add('revealed');
    cell.textContent = grid[cy][cx] || '';

    if (grid[cy][cx] === 0) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx !== 0 || dy !== 0) {
            queue.push([cx + dx, cy + dy]);
          }
        }
      }
    }
  }
}

function checkWin() {
  const totalSafe = GRID_WIDTH * GRID_HEIGHT - MINE_COUNT;
  if (revealedCells.size === totalSafe) {
    gameActive = false;
    clearInterval(timerInterval);
    gameTime = Math.floor((Date.now() - startTime) / 1000);
    showWinModal(gameTime, true);
  }
}

function showWinModal(timeTaken, won = true) {
  let bestTime = localStorage.getItem(BEST_TIME_KEY);

  if (won && (!bestTime || timeTaken < parseInt(bestTime))) {
    bestTime = timeTaken;
    localStorage.setItem(BEST_TIME_KEY, bestTime.toString());
  }

  document.getElementById('winTime').textContent = timeTaken;
  document.getElementById('bestTime').textContent = bestTime || 'N/A';
  document.getElementById('winMessage').textContent = won ? '🎉 Gewonnen!' : '💥 Verloren!';
  document.getElementById('soloWinModal').style.display = 'flex';
}

function revealFullGrid() {
  grid.forEach((row, y) => {
    row.forEach((cellValue, x) => {
      const cell = document.querySelector(`[data-x="${x}"][data-y="${y}"]`);
      if (!cell) return;
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

// --- Settings modal functions ---
function openSettingsModal() {
  document.getElementById('settingsModal').style.display = 'flex';

  document.getElementById('inputWidth').value = GRID_WIDTH;
  document.getElementById('inputHeight').value = GRID_HEIGHT;
  document.getElementById('inputMines').value = MINE_COUNT;
}

function closeSettingsModal() {
  document.getElementById('settingsModal').style.display = 'none';
}

function applySettings() {
  const w = parseInt(document.getElementById('inputWidth').value);
  const h = parseInt(document.getElementById('inputHeight').value);
  const m = parseInt(document.getElementById('inputMines').value);

  if (
    isNaN(w) || isNaN(h) || isNaN(m) ||
    w < 5 || w > 30 ||
    h < 5 || h > 30 ||
    m < 1 || m >= w * h
  ) {
    alert('Bitte gültige Werte eingeben:\n- Breite und Höhe: 5 bis 30\n- Minen: mind. 1 und kleiner als Breite×Höhe');
    return;
  }

  GRID_WIDTH = w;
  GRID_HEIGHT = h;
  MINE_COUNT = m;
  flagsLeft = MINE_COUNT;

  closeSettingsModal();
  initGame();
}

document.addEventListener('DOMContentLoaded', function () {
  const restartBtn = document.getElementById('restartButton');
  if (restartBtn) {
    restartBtn.onclick = function () {
      initGame();
    };
  }

  const settingsBtn = document.getElementById('settingsButton');
  if (settingsBtn) {
    settingsBtn.onclick = openSettingsModal;
  }

  const resetSettingsBtn = document.getElementById('resetSettingsButton');
  if (resetSettingsBtn) {
resetSettingsBtn.onclick = function () {
  GRID_WIDTH = DEFAULT_GRID_WIDTH;
  GRID_HEIGHT = DEFAULT_GRID_HEIGHT;
  MINE_COUNT = DEFAULT_MINE_COUNT;
  flagsLeft = MINE_COUNT;

  document.getElementById('inputWidth').value = GRID_WIDTH;
  document.getElementById('inputHeight').value = GRID_HEIGHT;
  document.getElementById('inputMines').value = MINE_COUNT;

  closeSettingsModal();
  initGame();
};

  }

  const settingsConfirmBtn = document.getElementById('settingsConfirmButton');
  if (settingsConfirmBtn) {
    settingsConfirmBtn.onclick = applySettings;
  }

  const settingsCancelBtn = document.getElementById('settingsCancelButton');
  if (settingsCancelBtn) {
    settingsCancelBtn.onclick = closeSettingsModal;
  }

  const closeWinModalBtn = document.getElementById('closeWinModal');
  if (closeWinModalBtn) {
    closeWinModalBtn.onclick = function () {
      document.getElementById('soloWinModal').style.display = 'none';
    };
  }

    const closeSettingsModalBtn = document.getElementById('closeSettingsModal');
  if (closeSettingsModalBtn) {
    closeSettingsModalBtn.onclick = function () {
      document.getElementById('settingsModal').style.display = 'none';
    };
  }

  const backButton = document.getElementById('backButtonIndex');
  if (backButton) {
    backButton.onclick = () => {
      window.location.href = '/';
    };
  }

  initGame();
});
