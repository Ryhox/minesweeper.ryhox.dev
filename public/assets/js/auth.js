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
        // LOGIN PROCESS
        const email = loginEmailInput.value.trim();
        const password = loginPasswordInput.value.trim();
        
        if (!email || !password) {
          showCustomAlert("Bitte fülle alle Felder aus", "error");
          return;
        }

        const captchaResponse = grecaptcha.getResponse();
        if (!captchaResponse) {
          showCustomAlert("Bitte löse das Captcha", "error");
          return;
        }

        try {
          const { user } = await auth.signInWithEmailAndPassword(email, password);
          const token = await user.getIdToken();
          setCookie('auth_token', token, 30);
          showCustomAlert("Login erfolgreich!", "success");
          setTimeout(() => {
            window.location.href = '/profile';
          }, 1500);
        } catch (error) {
          let errorMessage = "Login fehlgeschlagen!";
          if (error.code === 'auth/user-not-found') {
            errorMessage = "Benutzer nicht gefunden!";
          } else if (error.code === 'auth/wrong-password') {
            errorMessage = "Falsches Passwort!";
          } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Ungültige E-Mail Adresse!";
          }
          showCustomAlert(errorMessage, "error");
        }

      } else if (isRegisterPage) {
        // REGISTER PROCESS
        const email = registerEmailInput.value.trim();
        const password = registerPasswordInput.value.trim();
        const username = registerUsernameInput.value.trim();

        if (!email || !password || !username) {
          showCustomAlert("Bitte fülle alle Felder aus", "error");
          return;
        }

        const captchaResponse = grecaptcha.getResponse();
        if (!captchaResponse) {
          showCustomAlert("Bitte löse das Captcha", "error");
          return;
        }

        // Username validation
        if (username.length < 3) {
          showCustomAlert("Benutzername muss mindestens 3 Zeichen lang sein", "error");
          return;
        }

        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          showCustomAlert("Benutzername darf nur Buchstaben, Zahlen und Unterstriche enthalten", "error");
          return;
        }

        // Password validation
        if (password.length < 6) {
          showCustomAlert("Passwort muss mindestens 6 Zeichen lang sein", "error");
          return;
        }

        try {
          // Check if username exists
          const checkRes = await fetch('/api/checkUsername', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
          });

          const checkData = await checkRes.json();
          if (checkData.exists) {
            showCustomAlert('Benutzername ist bereits vergeben', "error");
            return;
          }

          // Create user
          const { user } = await auth.createUserWithEmailAndPassword(email, password);
          await user.updateProfile({ displayName: username });

          // Create user in database
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
          showCustomAlert("Registrierung erfolgreich!", "success");
          setTimeout(() => {
            window.location.href = '/profile';
          }, 1500);

        } catch (error) {
          console.error('Registration error:', error);
          let errorMessage = "Registrierung fehlgeschlagen!";
          if (error.code === 'auth/email-already-in-use') {
            errorMessage = "E-Mail Adresse wird bereits verwendet!";
          } else if (error.code === 'auth/weak-password') {
            errorMessage = "Passwort ist zu schwach!";
          } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Ungültige E-Mail Adresse!";
          }
          showCustomAlert(errorMessage, "error");
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
      if (oauthLoginInProgress) return;
      oauthLoginInProgress = true;

      const brand = btn.querySelector('i')?.classList[1]?.split('-')[1];
      const provider = oauthButtons[brand];
      if (!provider) {
        oauthLoginInProgress = false;
        return;
      }

      showCustomAlert(`${brand} Login wird vorbereitet...`, "info");

      try {
        const { user } = await auth.signInWithPopup(provider);
        const token = await user.getIdToken();

        let currentName = user.displayName || user.email?.split('@')[0] || `user${Math.floor(100000 + Math.random() * 900000)}`;

        // Check if user exists in database
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
          // Create new user if doesn't exist
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

        // Update profile if needed
        if (user.displayName !== currentName) {
          await user.updateProfile({ displayName: currentName });
        }

        setCookie('auth_token', token, 30);
        showCustomAlert(`${brand} Login erfolgreich!`, "success");
        setTimeout(() => {
          window.location.href = '/profile';
        }, 1500);

      } catch (error) {
        console.error('OAuth error:', error);
        let errorMessage = `${brand} Login fehlgeschlagen!`;
        if (error.code === 'auth/popup-closed-by-user') {
          errorMessage = "Login wurde abgebrochen";
        } else if (error.code === 'auth/popup-blocked') {
          errorMessage = "Popup wurde blockiert. Bitte erlaube Popups für diese Seite";
        }
        showCustomAlert(errorMessage, "error");
        oauthLoginInProgress = false;
      }
    });
  });
});