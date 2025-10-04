document.addEventListener('DOMContentLoaded', function() {
  const userIcon = document.getElementById('userIcon');
  const userDropdown = document.getElementById('userDropdown');
  const dropdownEmail = document.getElementById('dropdownEmail');
  const signInBtn = document.getElementById('signInBtn');
  const logoutBtn = document.getElementById('dropdownLogout');



firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    userIcon.style.display = 'flex';
    signInBtn.style.display = 'none';
    dropdownEmail.textContent = user.displayName || '';

    const statsBtn = document.getElementById('dropdownStats');
    if (user.displayName) {
      statsBtn.href = `/stats`; 
    } else {
      statsBtn.href = '#';
      statsBtn.addEventListener('click', function(e) {
        e.preventDefault();
        alert('No username set... weird... report it.');
      });
    }

    const myStatsBtn = document.getElementById("myStatsBtn");
    if (myStatsBtn) {
      myStatsBtn.style.display = 'inline-block'; 
      myStatsBtn.onclick = () => {
        window.location.href = `/stats/${encodeURIComponent(user.displayName)}`;
      };
    }

    // try to load profile picture
    const headerAvatar = document.getElementById('headerAvatar');
    const headerAvatarFallback = document.getElementById('headerAvatarFallback');
    const dropdownAvatar = document.getElementById('dropdownAvatar');
    const dropdownAvatarFallback = document.getElementById('dropdownAvatarFallback');
    if (user.uid) {
      const png = `/profile_pics/${user.uid}.png`;
      const jpg = `/profile_pics/${user.uid}.jpg`;
      fetch(png, { method: 'HEAD' }).then(r => {
        if (r.ok) {
          if (headerAvatar) { headerAvatar.src = png; headerAvatar.style.display = 'inline-block'; }
          if (headerAvatarFallback) headerAvatarFallback.style.display = 'none';
          if (dropdownAvatar) { dropdownAvatar.src = png; dropdownAvatar.style.display = 'inline-block'; }
          if (dropdownAvatarFallback) dropdownAvatarFallback.style.display = 'none';
        } else {
          fetch(jpg, { method: 'HEAD' }).then(r2 => {
            if (r2.ok) {
              if (headerAvatar) { headerAvatar.src = jpg; headerAvatar.style.display = 'inline-block'; }
              if (headerAvatarFallback) headerAvatarFallback.style.display = 'none';
              if (dropdownAvatar) { dropdownAvatar.src = jpg; dropdownAvatar.style.display = 'inline-block'; }
              if (dropdownAvatarFallback) dropdownAvatarFallback.style.display = 'none';
            }
          }).catch(() => {});
        }
      }).catch(() => {});
    }
  } else {
    userIcon.style.display = 'none';
    userDropdown.classList.remove('active');
    signInBtn.style.display = 'inline-block';
    dropdownEmail.textContent = '';
  }
});


  userIcon.addEventListener('click', function(e) {
    userDropdown.classList.toggle('active');
    e.stopPropagation();
  });

  document.addEventListener('click', function(e) {
    if (!userDropdown.contains(e.target) && !userIcon.contains(e.target)) {
      userDropdown.classList.remove('active');
    }
  });

  logoutBtn.addEventListener('click', function(e) {
    e.preventDefault();
    firebase.auth().signOut().then(function() {
      userDropdown.classList.remove('active');
      location.reload();
    });
  });
});


  const backButton = document.getElementById('backButtonIndex');
  if (backButton) {
    backButton.onclick = () => {
      window.location.href = '/';
    };
  }