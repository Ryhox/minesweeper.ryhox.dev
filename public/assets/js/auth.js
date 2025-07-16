document.addEventListener('DOMContentLoaded', function () {
  const auth = firebase.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

  const loginEmailInput = document.getElementById('loginUsername');
  const loginPasswordInput = document.getElementById('loginPassword');
  const registerEmailInput = document.getElementById('registerEmail');
  const registerPasswordInput = document.getElementById('registerPassword');
  const registerUsernameInput = document.getElementById('registerUsername');
  const form = document.querySelector('.form_main');

  const isLoginPage = !!loginEmailInput && !!loginPasswordInput;
  const isRegisterPage = !!registerEmailInput && !!registerPasswordInput;

  // Load saved displayName from localStorage if available
  auth.onAuthStateChanged(user => {
    if (user) {
      const savedName = localStorage.getItem('displayName');
      if (savedName && user.displayName !== savedName) {
        user.updateProfile({ displayName: savedName });
      }
    }
  });

  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    if (isLoginPage) {
      const email = loginEmailInput.value;
      const password = loginPasswordInput.value;
      if (!email || !password) return showErrorAlert("Bitte fülle alle Felder aus.");

      auth.signInWithEmailAndPassword(email, password)
        .then(({ user }) => {
          const savedName = localStorage.getItem('displayName');
          if (savedName && user.displayName !== savedName) {
            return user.updateProfile({ displayName: savedName });
          }
        })
        .then(() => auth.currentUser.getIdToken())
        .then(token => {
          setCookie('auth_token', token, 30);
          window.location.href = 'https://minesweeper.nexorhub.com';
        })
        .catch(() => showErrorAlert('E-Mail oder Passwort falsch'));
    }

    if (isRegisterPage) {
      const email = registerEmailInput.value;
      const password = registerPasswordInput.value;
      const username = registerUsernameInput.value;

      if (!email || !password || !username) return showErrorAlert("Bitte fülle alle Felder aus.");

      auth.createUserWithEmailAndPassword(email, password)
        .then(({ user }) => {
          localStorage.setItem('displayName', username);
          return user.updateProfile({ displayName: username });
        })
        .then(() => auth.currentUser.getIdToken())
        .then(token => {
          setCookie('auth_token', token, 30);
          window.location.href = 'https://minesweeper.nexorhub.com';
        })
        .catch(err => {
          const msg = err.message.includes('email')
            ? 'E-Mail bereits registriert'
            : 'Passwort zu schwach (min. 6 Zeichen)';
          showErrorAlert(msg);
        });
    }
  });

  // OAuth login
  const oauthButtons = {
    'google': new firebase.auth.GoogleAuthProvider(),
    'twitter': new firebase.auth.TwitterAuthProvider(),
    'github': new firebase.auth.GithubAuthProvider(),
    'discord': new firebase.auth.OAuthProvider('oidc.discord')
  };

  document.querySelectorAll('.signin').forEach(btn => {
    btn.addEventListener('click', () => {
      const brand = btn.querySelector('i')?.classList[1]?.split('-')[1];
      const provider = oauthButtons[brand];
      if (!provider) return;

      auth.signInWithPopup(provider)
        .then(({ user }) => {
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
            return user.updateProfile({ displayName: username });
          }
        })
        .then(() => auth.currentUser.getIdToken())
        .then(token => {
          setCookie('auth_token', token, 30);
          window.location.href = '/profile.html';
        })
        .catch(() => showErrorAlert(`${brand} Anmeldung fehlgeschlagen`));
    });
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
});
