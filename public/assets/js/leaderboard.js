document.addEventListener('DOMContentLoaded', function () {
    const modeButtons = document.querySelectorAll('.mode-btn');
    const timeRangeSelect = document.getElementById('timeRange');
    const leaderboardContainer = document.getElementById('leaderboardContainer');

    let currentMode = 'multiplayer';
    let currentTimeRange = 'all';

    async function fetchAndRenderLeaderboard() {
        leaderboardContainer.innerHTML = '<div class="leaderboard-loading">Loading Leaderboard...</div>';

        try {
            const response = await fetch(`/api/getLeaderboard?type=${currentMode}&timeRange=${currentTimeRange}`);
            if (!response.ok) {
                throw new Error('Failed to fetch leaderboard data');
            }
            const data = await response.json();
            renderLeaderboard(data);
        } catch (error) {
            console.error('Leaderboard error:', error);
            leaderboardContainer.innerHTML = '<div class="leaderboard-empty">Could not load leaderboard.</div>';
        }
    }

    function renderLeaderboard(data) {
        if (!data || data.length === 0) {
            leaderboardContainer.innerHTML = '<div class="leaderboard-empty">No players on the leaderboard for this filter.</div>';
            return;
        }

        const valueHeader = currentMode === 'multiplayer' ? 'Wins' : 'Best Time';
        
        let tableHTML = `
            <div class="leaderboard-table">
                <div class="leaderboard-header">
                    <div class="leaderboard-cell rank">#</div>
                    <div class="leaderboard-cell username">Player</div>
                    <div class="leaderboard-cell value">${valueHeader}</div>
                </div>
        `;

        data.forEach(player => {
            const displayValue = currentMode === 'multiplayer' ? player.value : `${player.value}s`;
            tableHTML += `
                <a href="/stats/${encodeURIComponent(player.username)}" class="leaderboard-row">
                    <div class="leaderboard-cell rank">${player.rank}</div>
                    <div class="leaderboard-cell username">${player.username}</div>
                    <div class="leaderboard-cell value">${displayValue}</div>
                </a>
            `;
        });

        tableHTML += '</div>';
        leaderboardContainer.innerHTML = tableHTML;
    }

    modeButtons.forEach(button => {
        button.addEventListener('click', () => {
            modeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentMode = button.dataset.mode;
            fetchAndRenderLeaderboard();
        });
    });

    timeRangeSelect.addEventListener('change', () => {
        currentTimeRange = timeRangeSelect.value;
        fetchAndRenderLeaderboard();
    });

    // Initial load
    fetchAndRenderLeaderboard();
});