document.addEventListener('DOMContentLoaded', function () {
  const auth = firebase.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

  const loginEmailInput = document.getElementById('loginUsername');
  const loginPasswordInput = document.getElementById('loginPassword');
  const registerEmailInput = document.getElementById('registerEmail');
  const registerPasswordInput = document.getElementById('registerPassword');
  const registerUsernameInput = document.getElementById('registerUsername');
  const form = document.querySelector('.form_main');

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

  function setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
  }

  const style = document.createElement('style');
  style.textContent = `
    .error-notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease-out;
      z-index: 10000;
    }
    .fade-out {
      animation: fadeOut 0.3s ease-out forwards;
    }
    @keyframes slideIn {
      from { transform: translateY(100px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  // Auth state sync with localStorage
  auth.onAuthStateChanged(user => {
    if (user) {
      const savedName = localStorage.getItem('displayName');
      if (savedName && user.displayName !== savedName) {
        user.updateProfile({ displayName: savedName })
          .then(() => location.reload());
      } else if (!savedName && user.displayName) {
        localStorage.setItem('displayName', user.displayName);
      }
    }
  });

  // Main form handler (login/register)
  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      // Detect login or register by available fields
      const isLoginPage = !!loginEmailInput && !!loginPasswordInput;
      const isRegisterPage = !!registerEmailInput && !!registerPasswordInput && !!registerUsernameInput;

      if (isLoginPage && !isRegisterPage) {
        // Login
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value.trim();
        if (!email || !password) return showErrorAlert("Bitte fülle alle Felder aus.");

        try {
          const { user } = await auth.signInWithEmailAndPassword(email, password);
          const savedName = localStorage.getItem('displayName');
          if (savedName && user.displayName !== savedName) {
            await user.updateProfile({ displayName: savedName });
          } else if (!savedName && user.displayName) {
            localStorage.setItem('displayName', user.displayName);
          }
          const token = await auth.currentUser.getIdToken();
          setCookie('auth_token', token, 30);
          //window.location.href = '/index.html';
        } catch {
          showErrorAlert('E-Mail oder Passwort falsch');
        }
      } else if (isRegisterPage) {
        // Register
        const email = registerEmailInput.value.trim();
        const password = registerPasswordInput.value.trim();
        const username = registerUsernameInput.value.trim();

        if (!email || !password || !username) return showErrorAlert("Bitte fülle alle Felder aus.");

        try {
          const { user } = await auth.createUserWithEmailAndPassword(email, password);
          localStorage.setItem('displayName', username);
          await user.updateProfile({ displayName: username });
          const token = await auth.currentUser.getIdToken();
          setCookie('auth_token', token, 30);

          // Also send to backend
          const res = await fetch('/api/createUser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email })
          });
          const data = await res.json();
          alert(data.message);

          //window.location.href = '/index.html';
        } catch (err) {
          const msg = err.message.includes('email')
            ? 'E-Mail bereits registriert'
            : 'Passwort zu schwach (min. 6 Zeichen)';
          showErrorAlert(msg);
        }
      }
    });
  }

  // Standalone backend registration (for forms with id="registerForm")
  const registerForm = document.getElementById('registerForm');
  if (registerForm && registerForm !== form) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('registerUsername').value.trim();
      const email = document.getElementById('registerEmail').value.trim();

      if (!username || !email) {
        alert('Bitte Benutzername und E-Mail angeben.');
        return;
      }

      try {
        const res = await fetch('/api/createUser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email })
        });

        const data = await res.json();
        alert(data.message);
      } catch (err) {
        console.error('Fehler beim Benutzer erstellen:', err);
        alert('Es gab ein Problem bei der Verbindung zum Server.');
      }
    });
  }

  // OAuth login
  const oauthButtons = {
    'google': new firebase.auth.GoogleAuthProvider(),
    'twitter': new firebase.auth.TwitterAuthProvider(),
    'github': new firebase.auth.GithubAuthProvider(),
    'discord': new firebase.auth.OAuthProvider('oidc.discord')
  };

  document.querySelectorAll('.signin').forEach(btn => {
    btn.addEventListener('click', async () => {
      const brand = btn.querySelector('i')?.classList[1]?.split('-')[1];
      const provider = oauthButtons[brand];
      if (!provider) return;

      try {
        const { user } = await auth.signInWithPopup(provider);
        let username;

        if (brand === 'google') {
          username = user.email?.split('@')[0];
        } else if (brand === 'twitter' || brand === 'github') {
          username = user.displayName || user.providerData[0]?.displayName || user.email?.split('@')[0];
        } else if (brand === 'discord') {
          username = user.displayName || 'discord_user';
        }

        if (username) {
          localStorage.setItem('displayName', username);
          await user.updateProfile({ displayName: username });

          // Create .json file in backend
          await fetch('/api/createUser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email: user.email })
          });
        }

        const token = await auth.currentUser.getIdToken();
        setCookie('auth_token', token, 30);
        window.location.href = '/profile.html';
      } catch (err) {
        showErrorAlert(`${brand} Anmeldung fehlgeschlagen`);
      }
    });
  });
});