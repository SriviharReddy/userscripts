// ==UserScript==
// @name         YouTube Channel → Videos Tab
// @namespace    https://youtube.com
// @version      1.0
// @description  Redirects YouTube channel pages to the Videos tab instead of Home
// @match        https://www.youtube.com/*
// @match        https://youtube.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Channel URL patterns:
    //   /channel/UC...
    //   /@handle
    //   /c/customname
    //   /user/username
    const CHANNEL_RE = /^\/(@[^\/]+|channel\/[^\/]+|c\/[^\/]+|user\/[^\/]+)\/?$/;

    function maybeRedirect(url) {
        const u = new URL(url);
        if (CHANNEL_RE.test(u.pathname)) {
            // It's a bare channel page (home) → go to /videos
            const target = u.pathname.replace(/\/$/, '') + '/videos' + u.search + u.hash;
            return target;
        }
        return null;
    }

    // --- Initial page load ---
    const redirect = maybeRedirect(location.href);
    if (redirect) {
        location.replace(redirect);
    }

    // --- SPA navigation (YouTube is a single-page app) ---
    // YouTube fires `yt-navigate-finish` after every client-side navigation.
    document.addEventListener('yt-navigate-finish', () => {
        const redirect = maybeRedirect(location.href);
        if (redirect) {
            // Use history.replaceState + navigate to avoid infinite loops
            window.location.replace(redirect);
        }
    });
})();
