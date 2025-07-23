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

  auth.onAuthStateChanged(async user => {
    if (user) {
      try {
        const token = await user.getIdToken();
        const response = await fetch('/api/getUser', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ uid: user.uid })
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
          return showErrorAlert("Please verify that you are not a robot.");
        }

        try {
          const checkRes = await fetch('/api/checkUsername', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
          });

          const checkData = await checkRes.json();
          if (checkData.exists) {
            return showErrorAlert('Username already taken');
          }

          const { user } = await auth.createUserWithEmailAndPassword(email, password);
          await user.updateProfile({ displayName: username });

          await fetch('/api/createUser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: user.uid,
              username,
              email
            })
          });

          const token = await user.getIdToken();
          setCookie('auth_token', token, 30);
          window.location.href = '/profile.html';
        } catch (err) {
          console.error('Registration error:', err);
          showErrorAlert('Registration failed: ' + err.message);
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

        let currentName = user.displayName || user.email?.split('@')[0] || `user${Math.floor(100000 + Math.random() * 900000)}`;

        const userRes = await fetch('/api/getUser', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ uid: user.uid })
        });

        if (userRes.ok) {
          const userData = await userRes.json();
          currentName = userData.username || currentName;
        } else {
          await fetch('/api/createUser', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: user.uid,
              username: currentName,
              email: user.email || 'noemail'
            })
          });
        }

        if (user.displayName !== currentName) {
          await user.updateProfile({ displayName: currentName });
        }

        setCookie('auth_token', token, 30);
        window.location.href = '/profile.html';

      } catch (err) {
        showErrorAlert(`${brand} Login failed: ${err.message}`);
        oauthLoginInProgress = false;
      }
    });
  });
});
