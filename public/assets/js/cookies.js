document.addEventListener('DOMContentLoaded', function () {
  if (localStorage.getItem('cookiesAccepted') === 'true') return;

  const style = `
    @import url('https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css');

    #cookie-banner {
      position: fixed;
      inset: 0;
      z-index: 99999;
      background-color: rgba(0, 0, 0, 0.6);
      display: flex;
      justify-content: center;
      align-items: center;
      font-family: 'Segoe UI', sans-serif;
      backdrop-filter: blur(6px);
    }

    #cookie-box {
      background-color: #1e1e1e;
      border-radius: 20px;
      border: 1px solid #2c2c2c;
      padding: 30px 24px;
      width: 95vw;
      max-width: 420px;
      box-shadow: 0 12px 24px rgba(0, 0, 0, 0.6);
      animation: fadeIn 0.4s ease-out;
      color: #f0f0f0;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.98); }
      to { opacity: 1; transform: scale(1); }
    }

    .cookie-icon {
      text-align: center;
      font-size: 48px;
      color: #eab789;
      margin-bottom: 16px;
    }

    #cookie-box h5 {
      text-align: center;
      color: #ffffff;
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 10px;
    }

    #cookie-box p {
      text-align: center;
      color: #cccccc;
      font-size: 15px;
      line-height: 1.5;
      margin-bottom: 20px;
    }

    #cookie-box a {
      color: #eab789;
      text-decoration: underline;
      font-weight: 500;
    }

    .cookie-buttons {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .cookie-buttons button {
      padding: 12px 20px;
      font-size: 15px;
      font-weight: 600;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.25s ease;
      min-width: 110px;
    }

    #cookie-accept {
      background-color: #eab789;
      color: #2c1d0e;
      border: none;
    }

    #cookie-accept:hover {
      background-color: #d69d6c;
    }

    #cookie-decline {
      background-color: transparent;
      color: #eab789;
      border: 2px solid #eab789;
    }

    #cookie-decline:hover {
      background-color: #2b2b2b;
    }
  `;

  const styleTag = document.createElement('style');
  styleTag.textContent = style;
  document.head.appendChild(styleTag);

  const banner = document.createElement('div');
  banner.id = 'cookie-banner';
  banner.innerHTML = `
    <div id="cookie-box">
      <div class="cookie-icon"><i class="fa-solid fa-cookie-bite"></i></div>
      <h5>Your privacy is important to us</h5>
      <p>
        We use cookies to improve your experience. <br> Read our 
        <a href="/privacy-policy" target="_blank">Privacy Policy</a>.
      </p>
      <div class="cookie-buttons">
        <button id="cookie-accept">Accept</button>
        <button id="cookie-decline">Decline</button>
      </div>
    </div>
  `;

  document.body.appendChild(banner);

  document.getElementById('cookie-accept').onclick = function () {
    localStorage.setItem('cookiesAccepted', 'true');
    banner.remove();
  };

  document.getElementById('cookie-decline').onclick = function () {
    localStorage.setItem('cookiesAccepted', 'true');
    banner.remove();
    window.location.href = '/';
  };
});
