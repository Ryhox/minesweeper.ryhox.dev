document.addEventListener('DOMContentLoaded', function () {
  const auth = firebase.auth();
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(console.error);

  const loginEmailInput = document.getElementById('loginUsername');
  const loginPasswordInput = document.getElementById('loginPassword');
  const registerEmailInput = document.getElementById('registerEmail');
  const registerPasswordInput = document.getElementById('registerPassword');
  const registerUsernameInput = document.getElementById('registerUsername');
  const form = document.querySelector('.form_main');

  let oauthLoginInProgress = false;

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

  auth.onAuthStateChanged(async user => {
    if (user) {
      try {
        const response = await fetch('/api/getUser', {
          headers: {
            'Authorization': `Bearer ${await user.getIdToken()}`
          }
        });
        const userData = await response.json();
        if (userData.username && user.displayName !== userData.username) {
          await user.updateProfile({ displayName: userData.username });
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      }
    }
  });

  if (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (oauthLoginInProgress) return;

      const isLoginPage = !!loginEmailInput && !!loginPasswordInput;
      const isRegisterPage = !!registerEmailInput && !!registerPasswordInput && !!registerUsernameInput;

      if (isLoginPage && !isRegisterPage) {
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value.trim();
        if (!email || !password) return showErrorAlert("Please fill in all fields");

        try {
          const { user } = await auth.signInWithEmailAndPassword(email, password);
          const token = await user.getIdToken();

          const response = await fetch('/api/getUser', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const userData = await response.json();
            if (userData.username && user.displayName !== userData.username) {
              await user.updateProfile({ displayName: userData.username });
            }
          }

          setCookie('auth_token', token, 30);
          window.location.href = '/profile.html';
        } catch {
          showErrorAlert('E-Mail or Passwort is wrong');
        }

      } else if (isRegisterPage) {
        const email = registerEmailInput.value.trim();
        const password = registerPasswordInput.value.trim();
        const username = registerUsernameInput.value.trim();

        if (!email || !password || !username) return showErrorAlert("Please fill in all fields");

        const captchaResponse = grecaptcha.getResponse();
        if (!captchaResponse) {
          showErrorAlert("Please verify that you are not a robot by completing the captcha.");
          return;
        }

        try {
          const checkRes = await fetch('/api/checkUsername', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, exact: true })
          });

          if (!checkRes.ok) throw new Error('Server error during username check');
          const checkData = await checkRes.json();

          if (checkData.exists) {
            showErrorAlert('This username is already taken');
            return;
          }

          const createRes = await fetch('/api/createUser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email })
          });

          if (!createRes.ok) throw new Error('Failed to create local user');

          const { user } = await auth.createUserWithEmailAndPassword(email, password);
          await user.updateProfile({ displayName: username });
          const token = await user.getIdToken();
          setCookie('auth_token', token, 30);

          window.location.href = '/profile.html';

        } catch (err) {
          console.error('Registration error:', err);
          if (err.message.includes('email')) {
            showErrorAlert('Email address is already in use');
          } else if (err.message.includes('password')) {
            showErrorAlert('Password must be at least 6 characters');
          } else {
            showErrorAlert('Registration failed. Please try again.');
          }
        }
      }
    });
  }

  const oauthButtons = {
    'google': new firebase.auth.GoogleAuthProvider(),
    'twitter': new firebase.auth.TwitterAuthProvider(),
    'github': new firebase.auth.GithubAuthProvider(),
    'discord': new firebase.auth.OAuthProvider('oidc.discord')
  };

  document.querySelectorAll('.signin').forEach(btn => {
    btn.addEventListener('click', async () => {
      oauthLoginInProgress = true;

      const brand = btn.querySelector('i')?.classList[1]?.split('-')[1];
      const provider = oauthButtons[brand];
      if (!provider) return;

      try {
        const { user } = await auth.signInWithPopup(provider);
        const token = await user.getIdToken();

        const response = await fetch('/api/getUser', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        const userData = response.ok ? await response.json() : null;

        if (!userData || !userData.username) {
          let username;
          if (brand === 'google') {
            username = user.email?.split('@')[0];
          } else {
            username = user.displayName 
                    || user.providerData[0]?.displayName 
                    || user.email?.split('@')[0] 
                    || `user${Math.floor(100000 + Math.random() * 900000)}`;
          }

          const email = user.email || 'noemail';

          const createRes = await fetch('/api/createUser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email })
          });

          if (!createRes.ok) {
            throw new Error('Failed to create user');
          }

          await user.updateProfile({ displayName: username });

        } else if (user.displayName !== userData.username) {
          await user.updateProfile({ displayName: userData.username });
        }

        setCookie('auth_token', token, 30);
        window.location.href = '/profile.html';

      } catch (err) {
        showErrorAlert(`${brand} Login Failed`);
        console.error('OAuth error:', err);
        oauthLoginInProgress = false;
      }
    });
  });
});
