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

        // Show password reset button only if signed in with password provider
        const hasPasswordProvider = user.providerData.some(
            (provider) => provider.providerId === 'password'
        );
        const passwordCard = document.querySelector('.password-card');
        if (passwordCard) {
            passwordCard.style.display = hasPasswordProvider ? 'flex' : 'none';
        }
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
    const user = auth.currentUser;
    if (!user) return;
    
    if (confirm('Permanently delete your account?')) {
      try {
        // Delete from our database
        await fetch('/api/deleteUser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid })
        });
        
        // Delete from Firebase
        await user.delete();
        window.location.href = '/login.html';
      } catch (err) {
        showErrorAlert('Error deleting account: ' + err.message);
      }
    }
  });

saveNameBtn.addEventListener('click', async () => {
  const newName = usernameInput.value.trim();
  const user = auth.currentUser;

  if (!newName) return showErrorAlert('Please enter a name');
  if (!user) return showErrorAlert('User not authenticated');

  try {
    // Check username availability
    const checkRes = await fetch('/api/checkUsername', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newName })
    });

    const checkData = await checkRes.json();
    if (checkData.exists) {
      return showErrorAlert('Username already taken');
    }

    // Call your backend updateUser API first
    const updateRes = await fetch('/api/updateUser', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: user.uid,
        newUsername: newName,
        email: user.email
      })
    });

    const updateData = await updateRes.json();

    if (!updateRes.ok) {
      return showErrorAlert(updateData.message || 'Error updating user');
    }

    // Only if backend update succeeded, update Firebase profile & UI
    await user.updateProfile({ displayName: newName });
    usernameSpan.textContent = newName;
    showCustomAlert('Username updated successfully');

  } catch (err) {
    showErrorAlert('Error updating: ' + err.message);
  }
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