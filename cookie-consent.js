/* Marconi306 — Cookie consent + Google Consent Mode v2 (GA4) */
(function () {
  'use strict';

  const GA_ID = 'G-YNDZ5Z0DG2';
  const STORAGE_KEY = 'm306_cookie_consent_v1';
  const CHOICE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 6 mesi
  let analyticsLoaded = false;

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };

  // Stato predefinito: Analytics e advertising negati finché l'utente non accetta.
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 500
  });

  function readChoice() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      // Compatibilità con una eventuale versione precedente.
      if (raw === 'accepted' || raw === 'rejected') return raw;

      const data = JSON.parse(raw);
      if (!data || !['accepted', 'rejected'].includes(data.choice) || !Number.isFinite(data.ts)) return null;
      if (Date.now() - data.ts > CHOICE_MAX_AGE_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      return data.choice;
    } catch (_) {
      return null;
    }
  }

  function saveChoice(choice) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice: choice, ts: Date.now() }));
    } catch (_) {}
  }

  function clearAnalyticsCookies() {
    try {
      document.cookie.split(';').forEach(function (part) {
        const name = part.split('=')[0].trim();
        if (name !== '_ga' && !name.startsWith('_ga_')) return;
        document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax';
        document.cookie = name + '=; Max-Age=0; path=/; domain=.marconi306.it; SameSite=Lax';
      });
    } catch (_) {}
  }

  function loadAnalytics() {
    if (analyticsLoaded || document.querySelector('script[data-m306-ga4]')) return;
    analyticsLoaded = true;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    script.dataset.m306Ga4 = '1';
    document.head.appendChild(script);

    window.gtag('js', new Date());
    window.gtag('config', GA_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false
    });
  }

  function grantAnalytics() {
    window.gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    loadAnalytics();
  }

  function denyAnalytics() {
    window.gtag('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    clearAnalyticsCookies();
  }

  const initialChoice = readChoice();
  if (initialChoice === 'accepted') grantAnalytics();
  else denyAnalytics();

  function removeBanner() {
    const banner = document.getElementById('m306-cookie-banner');
    if (banner) banner.remove();
  }

  function showBanner(force) {
    if (!force && readChoice()) return;
    removeBanner();

    const banner = document.createElement('section');
    banner.id = 'm306-cookie-banner';
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Preferenze cookie');
    banner.innerHTML = `
      <div class="cookie-banner__inner">
        <div class="cookie-banner__copy">
          <strong>Cookie e privacy</strong>
          <p>Usiamo strumenti tecnici necessari al funzionamento del sito e, solo con il tuo consenso, Google Analytics per capire in forma aggregata come viene utilizzato Marconi306. Non utilizziamo funzioni pubblicitarie di Analytics.</p>
          <a href="privacy.html#cookie">Leggi l'informativa privacy</a>
        </div>
        <div class="cookie-banner__actions">
          <button type="button" class="cookie-btn cookie-btn--secondary" data-cookie-reject>Rifiuta</button>
          <button type="button" class="cookie-btn cookie-btn--primary" data-cookie-accept>Accetta</button>
        </div>
      </div>`;

    document.body.appendChild(banner);

    banner.querySelector('[data-cookie-accept]').addEventListener('click', function () {
      saveChoice('accepted');
      grantAnalytics();
      removeBanner();
    });

    banner.querySelector('[data-cookie-reject]').addEventListener('click', function () {
      saveChoice('rejected');
      denyAnalytics();
      removeBanner();
    });
  }

  function bindSettingsLinks() {
    document.querySelectorAll('[data-cookie-settings]').forEach(function (button) {
      if (button.dataset.cookieBound === '1') return;
      button.dataset.cookieBound = '1';
      button.addEventListener('click', function (event) {
        event.preventDefault();
        showBanner(true);
      });
    });
  }

  function initUi() {
    bindSettingsLinks();
    if (!readChoice()) showBanner(false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initUi);
  else initUi();

  window.Marconi306CookieConsent = {
    open: function () { showBanner(true); },
    choice: readChoice
  };
})();
