document.addEventListener('DOMContentLoaded', function () {
    // Firebase and user elements
    const auth = firebase.auth();
    const statusText = document.getElementById('status');
    const usernameInput = document.getElementById('usernameInput');
    const usernameSpan = document.getElementById('username');

    // Stats view elements
    const modeButtons = document.querySelectorAll('.mode-btn');
    const timeRangeSelect = document.getElementById('timeRange');
    const statsSections = {
        'multiplayer': document.getElementById('multiplayer-stats'),
        'singleplayer': document.getElementById('singleplayer-stats'),
        'combined': document.getElementById('combined-stats')
    };

    // Initialize stats view
    function initStatsView() {
        setActiveMode('multiplayer');
    }

    // Set active mode with smooth transition
    function setActiveMode(mode) {
        Object.values(statsSections).forEach(section => {
            section.style.opacity = '0';
            setTimeout(() => {
                section.style.display = 'none';
            }, 300);
        });
        
        setTimeout(() => {
            statsSections[mode].style.display = 'block';
            setTimeout(() => {
                statsSections[mode].style.opacity = '1';
            }, 10);
        }, 300);
        
        modeButtons.forEach(button => {
            button.classList.remove('active');
            if (button.dataset.mode === mode) {
                button.classList.add('active');
            }
        });
        
        updateStats(mode, timeRangeSelect.value);
    }

    // Mode selection
    modeButtons.forEach(button => {
        button.addEventListener('click', function() {
            setActiveMode(this.dataset.mode);
        });
    });

    // Time range selection
    timeRangeSelect.addEventListener('change', function() {
        const activeMode = document.querySelector('.mode-btn.active').dataset.mode;
        updateStats(activeMode, this.value);
    });

    // Stats update placeholder
    function updateStats(mode, timeRange) {
        console.log(`Updating ${mode} stats for time range: ${timeRange}`);
    }

    // Initialize
    initStatsView();

    // Notification system
    function showErrorAlert(msg) {
        showAlert(msg, 'error-notification');
    }

    function showCustomAlert(msg) {
        showAlert(msg, 'custom-notification');
    }

    function showAlert(msg, type) {
        const existing = document.querySelector(`.${type}`);
        if (existing) existing.remove();
        
        const div = document.createElement('div');
        div.className = `${type} animate-in`;
        div.textContent = msg;
        document.body.appendChild(div);
        
        setTimeout(() => {
            div.classList.replace('animate-in', 'animate-out');
            setTimeout(() => div.remove(), 300);
        }, 3000);
    }

    // Premium Search System
    const searchWrapper = document.querySelector('.search-wrapper');
    const searchContainer = document.querySelector('.search-container');
    const searchBar = document.querySelector('.search-bar');
    const searchInput = document.querySelector('.search-input');
    const searchBtn = document.querySelector('.search-btn');
    const searchOverlay = document.querySelector('.search-overlay');

    function toggleSearch() {
        searchWrapper.classList.toggle('expanded');
        
        if (searchWrapper.classList.contains('expanded')) {
            searchInput.focus();
            searchBtn.innerHTML = '<i class="fas fa-times"></i>';
            searchBtn.classList.add('close-btn');
            document.body.style.overflow = 'hidden';
        } else {
            searchBtn.innerHTML = '<i class="fas fa-search"></i>';
            searchBtn.classList.remove('close-btn');
            searchInput.value = '';
            document.body.style.overflow = '';
        }
    }

    // Search event listeners
    searchInput.addEventListener('click', toggleSearch);
    searchBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSearch();
    });
    searchOverlay.addEventListener('click', toggleSearch);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchWrapper.classList.contains('expanded')) {
            toggleSearch();
        }
    });
    searchBar.addEventListener('click', (e) => e.stopPropagation());
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && searchInput.value.trim() !== '') {
            performSearch(searchInput.value.trim());
        }
    });

    function performSearch(query) {
        console.log('Searching for:', query);
        showCustomAlert(`Searching for: ${query}`);
        toggleSearch();
    }

    // Dynamic styles
    const style = document.createElement('style');
    style.textContent = `
        /* Notification animations */
        .animate-in {
            animation: slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        .animate-out {
            animation: fadeOut 0.3s ease-out forwards;
        }
        
        /* Search system */
        .search-wrapper {
            position: relative;
            margin-right: 20px;
            z-index: 100;
        }
        .search-container {
            transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
        }
        .search-bar {
            display: flex;
            align-items: center;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 30px;
            padding: 8px 15px;
            transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            will-change: transform, opacity;
        }
        .search-input {
            background: transparent;
            border: none;
            color: white;
            width: 180px;
            padding: 5px 10px;
            outline: none;
            font-size: 14px;
            transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
        }
        .search-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 99;
            opacity: 0;
            visibility: hidden;
            transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
            backdrop-filter: blur(5px);
            will-change: opacity;
        }
        
        /* Expanded state */
        .search-wrapper.expanded .search-container {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            z-index: 1000;
            width: min(90%, 600px);
        }
        .search-wrapper.expanded .search-bar {
            padding: 20px 25px;
            background: rgba(30, 30, 30, 0.98);
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .search-wrapper.expanded .search-input {
            width: 100%;
            font-size: 1.25rem;
        }
        .search-wrapper.expanded .search-overlay {
            opacity: 1;
            visibility: visible;
        }
        
        /* Animations */
        @keyframes slideIn {
            from { transform: translateY(100px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeOut {
            to { opacity: 0; transform: translateY(20px); }
        }
        .profile-section {
            transition: opacity 0.3s ease;
        }
    `;
    document.head.appendChild(style);
});