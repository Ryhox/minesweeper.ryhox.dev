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

  const avatarInput = document.getElementById('avatarInput');
  const profileAvatarPreview = document.getElementById('profileAvatarPreview');
  const headerAvatar = document.getElementById('headerAvatar');
  const headerAvatarFallback = document.getElementById('headerAvatarFallback');
  const dropdownAvatar = document.getElementById('dropdownAvatar');
  const dropdownAvatarFallback = document.getElementById('dropdownAvatarFallback');

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

    if (user && user.uid) {
    const picUrlPng = `/profile_pics/${user.uid}.png?v=${Date.now()}`;
    const picUrlJpg = `/profile_pics/${user.uid}.jpg?v=${Date.now()}`;
      fetch(picUrlPng, { method: 'HEAD' }).then(r => {
        if (r.ok) setAvatar(picUrlPng);
        else fetch(picUrlJpg, { method: 'HEAD' }).then(r2 => { if (r2.ok) setAvatar(picUrlJpg); });
      }).catch(() => {});
    }

        emailElem.textContent = maskEmail(email);

        logoutBtn.style.display = 'inline-block';
        deleteBtn.style.display = 'inline-block';

        const hasPasswordProvider = user.providerData.some(
            (provider) => provider.providerId === 'password'
        );
        const passwordCard = document.querySelector('.password-card');
        if (passwordCard) {
            passwordCard.style.display = hasPasswordProvider ? 'flex' : 'none';
        }
    } else {
        window.location.href = 'login';
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
        await fetch('/api/deleteUser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: user.uid })
        });
        
        await user.delete();
        window.location.href = '/login';
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
    const checkRes = await fetch('/api/checkUsername', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newName })
    });

    const checkData = await checkRes.json();
    if (checkData.exists) {
      return showErrorAlert('Username already taken');
    }

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

  function setAvatar(url) {
    if (profileAvatarPreview) profileAvatarPreview.src = url;
    if (headerAvatar) { headerAvatar.src = url; headerAvatar.style.display = 'inline-block'; }
    if (headerAvatarFallback) headerAvatarFallback.style.display = 'none';
    if (dropdownAvatar) { dropdownAvatar.src = url; dropdownAvatar.style.display = 'inline-block'; }
    if (dropdownAvatarFallback) dropdownAvatarFallback.style.display = 'none';
  }

let cropper = null;
const cropModal = document.getElementById('cropModal');
const cropImage = document.getElementById('cropImage');
const cropConfirmBtn = document.getElementById('cropConfirmBtn');
const cropCancelBtn = document.getElementById('cropCancelBtn');
const cropResetBtn = document.getElementById('cropResetBtn');
const zoomRange = document.getElementById('zoomRange');

if (avatarInput) {
  avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return showErrorAlert('Please select an image file');

    const reader = new FileReader();
    reader.onload = function(ev) {
      cropImage.src = ev.target.result;
      cropModal.style.display = 'flex';

      if (cropper) { cropper.destroy(); cropper = null; }

      cropper = new Cropper(cropImage, {
        aspectRatio: 1,
        viewMode: 1,
        dragMode: 'move',
        autoCropArea: 1,
        movable: true,
        zoomable: true,
        rotatable: true,
        scalable: false,
        cropBoxMovable: false,
        cropBoxResizable: false,
        background: false,
        guides: false,
        highlight: false,
      });

      zoomRange.value = 1;
    };
    reader.readAsDataURL(file);
  });
}

zoomRange.addEventListener('input', () => {
  if (cropper) cropper.zoomTo(parseFloat(zoomRange.value));
});

cropResetBtn.addEventListener('click', () => {
  if (cropper) cropper.reset();
  zoomRange.value = 1;
});

cropConfirmBtn.addEventListener('click', async () => {
  if (!cropper) return;
  const canvas = cropper.getCroppedCanvas({ width: 400, height: 400, imageSmoothingQuality: 'high' });
  const dataUrl = canvas.toDataURL('image/png');
  cropModal.style.display = 'none';
  cropper.destroy();
  cropper = null;
  zoomRange.value = 1;

  if (profileAvatarPreview) profileAvatarPreview.src = dataUrl;

  const user = firebase.auth().currentUser;
  if (!user) return showErrorAlert('Not authenticated');

  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/uploadProfilePic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, image: dataUrl })
    });
    const data = await res.json();
    if (!res.ok) return showErrorAlert(data.error || 'Upload failed');

    setAvatar(data.url + '?v=' + Date.now());
    showCustomAlert('Profile picture updated');
  } catch (err) {
    showErrorAlert('Upload failed: ' + err.message);
  }
});

cropCancelBtn.addEventListener('click', () => {
  cropModal.style.display = 'none';
  if (cropper) { cropper.destroy(); cropper = null; }
  avatarInput.value = '';
});


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
