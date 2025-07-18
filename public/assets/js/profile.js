document.addEventListener('DOMContentLoaded', function () {
    const auth = firebase.auth();
    const statusText = document.getElementById('status');
    const logoutBtn = document.getElementById('logoutprofileBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const saveNameBtn = document.getElementById('saveNameBtnProfile');
    const usernameInput = document.getElementById('usernameInput');
    const emailElem = document.getElementById('email');
    const toggleEmailBtn = document.getElementById('toggleEmail');
    const sendResetEmailBtn = document.getElementById('sendResetEmailBtn');
    const usernameSpan = document.getElementById('username');

    // Stats expand/collapse
    const toggleSingleStatsBtn = document.getElementById('toggleSingleStatsBtn');
    const singleStatsContent = document.getElementById('singleStatsContent');
    const singleArrow = document.getElementById('singleArrow');
    const toggleMultiStatsBtn = document.getElementById('toggleMultiStatsBtn');
    const multiStatsContent = document.getElementById('multiStatsContent');
    const multiArrow = document.getElementById('multiArrow');

    let emailVisible = false;

    auth.onAuthStateChanged(user => {
        if (user) {
            const displayName = user.displayName || '(no username)';
            const email = user.email;
            const memberSince = user.metadata.creationTime
                ? new Date(user.metadata.creationTime).toLocaleDateString()
                : '';
            statusText.textContent = `Member since: ${memberSince}`;
            usernameSpan.textContent = displayName;
            usernameInput.value = displayName;

            emailElem.textContent = maskEmail(email);

            logoutBtn.style.display = 'inline-block';
            deleteBtn.style.display = 'inline-block';
        } else {
            window.location.href = 'login.html';
        }
    });

    function maskEmail(email) {
        if (!email) return '';
        const parts = email.split('@');
        if (parts[0].length <= 2) return email;
        return parts[0].slice(0, 2) + '****@' + parts[1];
    }

    toggleEmailBtn.addEventListener('click', () => {
        const user = auth.currentUser;
        if (!user) return;
        emailVisible = !emailVisible;
        emailElem.textContent = emailVisible ? user.email : maskEmail(user.email);
        toggleEmailBtn.textContent = emailVisible ? 'Hide' : 'Show';
    });

    sendResetEmailBtn.addEventListener('click', async () => {
        const user = firebase.auth().currentUser;
        if (!user || !user.email) {
            showErrorAlert('No email found. Please re-login.');
            return;
        }

        try {
            await firebase.auth().sendPasswordResetEmail(user.email);
            showCustomAlert('Password reset email sent to: ' + user.email);
        } catch (error) {
            showErrorAlert('Error sending reset email: ' + error.message);
        }
    });

    logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => location.reload());
    });

    deleteBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to delete your account? This cannot be undone.")) {
            const user = auth.currentUser;
            const username = user.displayName;
            try {
                await user.delete();
                localStorage.removeItem('displayName');
                await fetch('/api/deleteUser', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username })
                });
                showCustomAlert("Account deleted successfully.");
                location.reload();
            } catch (error) {
                if (error.code === 'auth/requires-recent-login') {
                    showCustomAlert("Please re-login and try deleting again.");
                    auth.signOut().then(() => location.reload());
                } else {
                    showCustomAlert("Error deleting account: " + error.message);
                }
            }
        }
    });

    saveNameBtn.addEventListener('click', async () => {
        const newName = usernameInput.value.trim();
        if (!newName) return showErrorAlert('Please enter a valid name.');

        const user = auth.currentUser;
        const oldName = user.displayName;

        try {
            const checkRes = await fetch('/api/checkUsername', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: newName })
            });
            const checkData = await checkRes.json();
            if (checkData.exists && newName !== oldName) {
                showErrorAlert('Username already taken. Please choose another.');
                return;
            }

            await user.updateProfile({ displayName: newName });
            localStorage.setItem('displayName', newName);
            usernameSpan.textContent = newName;
            statusText.textContent = `Member since: ${user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString() : ''}`;
            showCustomAlert("Username updated successfully.");

            await fetch('/api/updateUser', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldUsername: oldName, newUsername: newName, email: user.email })
            });
        } catch (err) {
            showErrorAlert('Error updating username: ' + err.message);
        }
    });

    function smoothToggle(contentElem, btnElem, arrowElem) {
        const expanded = contentElem.style.display === 'block';
        if (!expanded) {
            contentElem.style.display = 'block';
            contentElem.style.maxHeight = contentElem.scrollHeight + "px";
            btnElem.classList.add('expanded');
            btnElem.querySelector('span').textContent = 'Hide Stats';
        } else {
            contentElem.style.maxHeight = '0';
            contentElem.style.display = 'none';
            btnElem.classList.remove('expanded');
            btnElem.querySelector('span').textContent = 'Show Stats';
        }
    }

    toggleSingleStatsBtn.addEventListener('click', () => {
        smoothToggle(singleStatsContent, toggleSingleStatsBtn, singleArrow);
    });

    toggleMultiStatsBtn.addEventListener('click', () => {
        smoothToggle(multiStatsContent, toggleMultiStatsBtn, multiArrow);
    });

    function showErrorAlert(msg) {
        const existing = document.querySelector('.error-notification');
        if (existing) existing.remove();
        const div = document.createElement('div');
        div.className = 'error-notification';
        div.textContent = msg;
        document.body.appendChild(div);
        setTimeout(() => {
            div.classList.add('fade-out');
            setTimeout(() => div.remove(), 300);
        }, 3000);
    }

    function showCustomAlert(msg) {
        const existing = document.querySelector('.custom-notification');
        if (existing) existing.remove();
        const div = document.createElement('div');
        div.className = 'custom-notification';
        div.textContent = msg;
        document.body.appendChild(div);
        setTimeout(() => {
            div.classList.add('fade-out');
            setTimeout(() => div.remove(), 300);
        }, 3000);
    }

    const style = document.createElement('style');
    style.textContent = `
        .error-notification, .custom-notification {
        position: fixed;
        bottom: 24px;
        right: 24px;
        padding: 16px 28px;
        border-radius: 8px;
        color: white;
        font-size: 1.1em;
        z-index: 100000;
        animation: slideIn 0.3s ease-out;
        background: #ff4444;
        border-left: 6px solid #cc0000;
      }
        .custom-notification {
          background: #00cc00;
          border-left: 6px solid #008800;
        }
        .fade-out {
            animation: fadeOut 0.3s ease-out forwards;
        }
        @keyframes slideIn {
        from { transform: translateY(100px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fadeOut {
        to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
});