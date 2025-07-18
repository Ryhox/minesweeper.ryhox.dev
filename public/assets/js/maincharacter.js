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
      } else {
        userIcon.style.display = 'none';
        userDropdown.classList.remove('active');
        signInBtn.style.display = 'inline-block';
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