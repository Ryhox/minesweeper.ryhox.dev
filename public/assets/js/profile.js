   const auth = firebase.auth();
    const statusText = document.getElementById('status');
    const loginbtn = document.getElementById('loginbtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const nameSection = document.getElementById('nameSection');
    const saveNameBtn = document.getElementById('saveNameBtn');
    const usernameInput = document.getElementById('usernameInput');

    auth.onAuthStateChanged(user => {
      if (user) {
        const displayName = user.displayName || '(no username)';
        const email = user.email;
        statusText.textContent = `Logged in as: ${displayName} (${email})`;
        usernameInput.value = displayName;

        logoutBtn.style.display = 'inline-block';
        deleteBtn.style.display = 'inline-block';
        nameSection.style.display = 'block';
      } else {
        statusText.textContent = 'Not logged in';
        loginbtn.style.display = 'inline-block';
      }
    });

    logoutBtn.addEventListener('click', () => {
      auth.signOut().then(() => location.reload());
    });

    deleteBtn.addEventListener('click', () => {
      if (confirm("Are you sure you want to delete your account? This cannot be undone.")) {
        const user = auth.currentUser;
        user.delete()
          .then(() => {
            localStorage.removeItem('displayName');
            alert('Account deleted.');
            location.reload();
          })
          .catch(error => {
            if (error.code === 'auth/requires-recent-login') {
              alert('Please re-login and try deleting again.');
              auth.signOut().then(() => location.reload());
            } else {
              alert('Error deleting account: ' + error.message);
            }
          });
      }
    });

    saveNameBtn.addEventListener('click', () => {
      const newName = usernameInput.value.trim();
      if (!newName) return alert('Please enter a valid name.');

      const user = auth.currentUser;
      user.updateProfile({ displayName: newName })
        .then(() => {
          localStorage.setItem('displayName', newName);
          statusText.textContent = `Logged in as: ${newName} (${user.email})`;
          alert('Name updated!');
        })
        .catch(err => {
          alert('Error updating name: ' + err.message);
        });
    });