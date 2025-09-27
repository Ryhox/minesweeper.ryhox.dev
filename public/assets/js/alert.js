function showCustomAlert(msg, type = "error") {
  console.log("showCustomAlert aufgerufen:", msg, type); // Debug
  
  // Alte Benachrichtigungen entfernen
  const existing = document.querySelector('.custom-notification');
  if (existing) {
    console.log("Alte Benachrichtigung entfernt");
    existing.remove();
  }

  // Neue Benachrichtigung erstellen
  const div = document.createElement('div');
  div.className = `custom-notification ${type}`;
  div.textContent = msg;
  document.body.appendChild(div);
  
  console.log("Neue Benachrichtigung erstellt");

  // Nach 3.5 Sekunden ausblenden und entfernen
  setTimeout(() => {
    div.classList.add('fade-out');
    setTimeout(() => {
      if (div.parentNode) {
        div.remove();
        console.log("Benachrichtigung entfernt");
      }
    }, 300);
  }, 3500);
}

// Style nur einmal hinzufügen
if (!document.getElementById('custom-alert-style')) {
  console.log("Füge Style hinzu");
  const style = document.createElement('style');
  style.id = 'custom-alert-style';
  style.textContent = `
    .custom-notification {
      position: fixed;
      bottom: 24px;
      right: 24px;
      min-width: 220px;
      max-width: 90vw;
      background: #23272f;
      color: #fff;
      padding: 16px 28px;
      border-radius: 8px;
      box-shadow: 0 4px 18px rgba(0,0,0,0.25);
      font-size: 1.08em;
      font-family: inherit;
      z-index: 10000;
      opacity: 0.98;
      animation: slideIn 0.3s ease-out;
      border-left: 6px solid #ff4444;
    }
    .custom-notification.success { 
      border-left-color: #6bff8f; 
      background: #1b2e1b; 
      color: #d7ffd7;
    }
    .custom-notification.info { 
      border-left-color: #ffb400; 
      background: #23272f; 
      color: #ffe7b0;
    }
    .custom-notification.error { 
      border-left-color: #ff4444; 
      background: #23272f; 
      color: #ffd7d7;
    }
    .custom-notification.fade-out { 
      animation: fadeOut 0.3s ease-out forwards; 
    }
    @keyframes slideIn {
      from { 
        transform: translateX(100px); 
        opacity: 0; 
      }
      to { 
        transform: translateX(0); 
        opacity: 1; 
      }
    }
    @keyframes fadeOut {
      from { 
        opacity: 1; 
      }
      to { 
        opacity: 0; 
      }
    }
  `;
  document.head.appendChild(style);
}
