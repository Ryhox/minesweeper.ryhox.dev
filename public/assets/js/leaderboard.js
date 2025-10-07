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

            // Fetch UID for each player using /api/getStats/:username
            const playersWithUid = await Promise.all(
                data.map(async player => {
                    try {
                        const statsRes = await fetch(`/api/getStats/${encodeURIComponent(player.username)}`);
                        if (!statsRes.ok) throw new Error();
                        const stats = await statsRes.json();
                        return { ...player, uid: stats.uid };
                    } catch {
                        return { ...player, uid: null };
                    }
                })
            );

            renderLeaderboard(playersWithUid);
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
            let avatarImg;
            if (player.uid) {
                const avatarPng = `/profile_pics/${player.uid}.png?v=${Date.now()}`;
                const avatarJpg = `/profile_pics/${player.uid}.jpg?v=${Date.now()}`;
            avatarImg = `
            <img class="leaderboard-avatar" src="${avatarPng}" alt="avatar" 
              onerror="this.onerror=null;this.src='${avatarJpg}';">
            `;

            } else {
                avatarImg = `
                    <img class="leaderboard-avatar" src="/assets/images/icon.png" alt="avatar">
                `;
            }
            const displayValue = currentMode === 'multiplayer' ? player.value : `${player.value}s`;
            tableHTML += `
                <a href="/stats/${encodeURIComponent(player.username)}" class="leaderboard-row">
                    <div class="leaderboard-cell rank">${player.rank}</div>
                    <div class="leaderboard-cell username">${avatarImg}${player.username}</div>
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

    fetchAndRenderLeaderboard();
});