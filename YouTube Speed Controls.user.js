// ==UserScript==
// @name         YouTube Speed Controls
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Adds speed control buttons that use YouTube's native speed API
// @match        https://www.youtube.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'yt-custom-speed';
  const MIN_SPEED = 0.25;
  const MAX_SPEED = 2;


  let currentSpeed = parseFloat(sessionStorage.getItem(STORAGE_KEY)) || 1;
  currentSpeed = clamp(currentSpeed);
  let buttonsInjected = false;
  let speedDisplay = null;

  /* ── helpers ─────────────────────────────────── */

  function clamp(val) {
    return Math.min(MAX_SPEED, Math.max(MIN_SPEED, Math.round(val * 100) / 100));
  }

  function getPlayer() {
    return document.getElementById('movie_player');
  }

  function applySpeed() {
    const player = getPlayer();
    if (player && typeof player.setPlaybackRate === 'function') {
      player.setPlaybackRate(currentSpeed);
    }
    if (speedDisplay) speedDisplay.textContent = currentSpeed.toFixed(2) + 'x';
  }

  function setSpeed(value) {
    currentSpeed = clamp(value);
    sessionStorage.setItem(STORAGE_KEY, currentSpeed);
    applySpeed();
  }

  /** Sync the display if YouTube changes speed on its own (e.g. user uses native menu) */
  function syncFromPlayer() {
    const player = getPlayer();
    if (player && typeof player.getPlaybackRate === 'function') {
      const native = player.getPlaybackRate();
      if (native && Math.abs(native - currentSpeed) > 0.001) {
        currentSpeed = native;
        sessionStorage.setItem(STORAGE_KEY, currentSpeed);
        if (speedDisplay) speedDisplay.textContent = currentSpeed.toFixed(2) + 'x';
      }
    }
  }

  /* ── SVG icon builders (DOM API – CSP safe) ── */

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs, children) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v);
    (children || []).forEach(c => el.appendChild(c));
    return el;
  }

  function makeIcon(children) {
    return svgEl('svg', {
      width: '22', height: '22', viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor',
      'stroke-width': '2.2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    }, children);
  }

  function iconReset() {
    return makeIcon([
      svgEl('path', { d: 'M3 12a9 9 0 1 1 3 7' }),
      svgEl('polyline', { points: '3 22 3 16 9 16' }),
    ]);
  }

  function iconSingle() {
    return makeIcon([
      svgEl('polyline', { points: '9 4 17 12 9 20' }),
    ]);
  }

  function iconDouble() {
    return makeIcon([
      svgEl('polyline', { points: '6 4 14 12 6 20' }),
      svgEl('polyline', { points: '13 4 21 12 13 20' }),
    ]);
  }

  /* ── UI ──────────────────────────────────────── */

  function createButton(iconFn, title, onClick, scrollStep) {
    const btn = document.createElement('button');
    btn.appendChild(iconFn());
    btn.title = title;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });

    /* scroll-wheel: up = faster, down = slower */
    if (scrollStep) {
      btn.addEventListener('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.deltaY < 0) setSpeed(currentSpeed + scrollStep);  // scroll up
        else              setSpeed(currentSpeed - scrollStep);   // scroll down
      }, { passive: false });
      btn.title += '  (scroll to adjust)';
    }

    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'transparent',
      color: '#fff',
      border: 'none',
      borderRadius: '0',
      padding: '7px',
      cursor: 'pointer',
      lineHeight: '0',
      transition: 'opacity 0.2s',
      opacity: '0.9',
    });
    btn.addEventListener('mouseenter', () => (btn.style.opacity = '1'));
    btn.addEventListener('mouseleave', () => (btn.style.opacity = '0.9'));
    return btn;
  }

  function injectButtons() {
    if (buttonsInjected) return;

    const rightControls = document.querySelector('.ytp-right-controls');
    if (!rightControls) return;

    buttonsInjected = true;

    /* wrapper */
    const wrapper = document.createElement('div');
    wrapper.id = 'yt-speed-wrapper';
    Object.assign(wrapper.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      marginRight: '6px',
      verticalAlign: 'middle',
      height: '100%',
    });

    /* speed display */
    speedDisplay = document.createElement('span');
    speedDisplay.id = 'yt-speed-display';
    Object.assign(speedDisplay.style, {
      color: '#fff',
      fontSize: '13px',
      fontFamily: "'Roboto', Arial, sans-serif",
      fontWeight: '500',
      marginRight: '2px',
      minWidth: '40px',
      textAlign: 'center',
      letterSpacing: '0.3px',
    });
    speedDisplay.textContent = currentSpeed.toFixed(2) + 'x';
    wrapper.appendChild(speedDisplay);

    /* reset 1× */
    wrapper.appendChild(
      createButton(iconReset, 'Reset speed to 1×', () => setSpeed(1))
    );

    /* +0.10 */
    wrapper.appendChild(
      createButton(iconSingle, 'Increase speed by 0.10×', () => setSpeed(currentSpeed + 0.1), 0.1)
    );

    /* +0.25 */
    wrapper.appendChild(
      createButton(iconDouble, 'Increase speed by 0.25×', () => setSpeed(currentSpeed + 0.25), 0.25)
    );

    /* insert before the first child of right-controls */
    rightControls.insertBefore(wrapper, rightControls.firstChild);

    applySpeed();
  }

  /* ── keep in sync ──────────────────────────── */

  /** Re-apply speed after SPA navigation or video change */
  function onVideoReady() {
    injectButtons();
    applySpeed();
  }

  /* Listen for YouTube's SPA navigation events */
  document.addEventListener('yt-navigate-finish', () => {
    // Buttons may have been removed during navigation
    if (!document.getElementById('yt-speed-wrapper')) {
      buttonsInjected = false;
    }
    // Delay to let YouTube's own initialization finish first
    setTimeout(onVideoReady, 300);
    setTimeout(onVideoReady, 800);
  });

  /* Also listen for yt-page-data-updated (fires on video switch within watch page) */
  document.addEventListener('yt-page-data-updated', () => {
    setTimeout(onVideoReady, 300);
    setTimeout(onVideoReady, 800);
  });

  /* Sync display when user changes speed via native YouTube menu */
  const video = document.querySelector('video');
  if (video) {
    video.addEventListener('ratechange', () => {
      syncFromPlayer();
    });
  }

  /* MutationObserver as fallback for button injection and new video elements */
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    /* Re-inject if buttons were removed */
    if (!document.getElementById('yt-speed-wrapper')) {
      buttonsInjected = false;
    }
    injectButtons();

    /* Bind ratechange on new video elements */
    const vid = document.querySelector('video');
    if (vid && !vid._ytSpeedSyncBound) {
      vid._ytSpeedSyncBound = true;
      vid.addEventListener('ratechange', () => syncFromPlayer());
    }

    /* On URL change, re-apply speed */
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(onVideoReady, 300);
      setTimeout(onVideoReady, 800);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });

  /* initial attempt */
  injectButtons();
  setTimeout(onVideoReady, 500);
  setTimeout(onVideoReady, 1500);
})();
