/* Adventure Time TCG — public site behavior
 * 1. Theme switcher with persistence (candy / ice / nightosphere)
 * 2. Soft navigation between public pages
 * 3. Live status page polling against the JSON health probes
 */
(function () {
  "use strict";

  var THEMES = ["candy", "ice", "nightosphere"];
  var STORAGE_KEY = "attcg-web-theme";
  var THEME_META = {
    candy: "#fff0f5",
    ice: "#f0f7ff",
    nightosphere: "#0d0010",
  };
  var statusInterval = null;
  var currentNavigation = null;

  // ---- Theme -------------------------------------------------------------
  function storedTheme() {
    try {
      var value = window.localStorage.getItem(STORAGE_KEY);
      return THEMES.indexOf(value) !== -1 ? value : null;
    } catch (err) {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (err) {
      /* ignore */
    }
  }

  function applyTheme(theme) {
    if (THEMES.indexOf(theme) === -1) {
      theme = "candy";
    }
    document.documentElement.setAttribute("data-theme", theme);

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && THEME_META[theme]) {
      meta.setAttribute("content", THEME_META[theme]);
    }

    var buttons = document.querySelectorAll("[data-theme-name]");
    for (var i = 0; i < buttons.length; i++) {
      var isActive = buttons[i].getAttribute("data-theme-name") === theme;
      buttons[i].setAttribute("aria-pressed", isActive ? "true" : "false");
    }
  }

  function initialTheme() {
    var stored = storedTheme();
    if (stored) {
      return stored;
    }
    if (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "nightosphere";
    }
    return "candy";
  }

  function initThemeSwitch() {
    applyTheme(initialTheme());

    var buttons = document.querySelectorAll("[data-theme-name]");
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].getAttribute("data-theme-ready") === "true") {
        continue;
      }
      buttons[i].setAttribute("data-theme-ready", "true");
      buttons[i].addEventListener("click", function (event) {
        var theme = event.currentTarget.getAttribute("data-theme-name");
        applyTheme(theme);
        storeTheme(theme);
      });
    }
  }

  // ---- Soft navigation ---------------------------------------------------
  function isPlainLeftClick(event) {
    return (
      event.button === 0 &&
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey
    );
  }

  function shouldHandleLink(link, event) {
    if (!link || !isPlainLeftClick(event)) {
      return false;
    }
    if (
      link.target ||
      link.hasAttribute("download") ||
      link.getAttribute("href") == null
    ) {
      return false;
    }

    var href = link.getAttribute("href");
    if (
      href.charAt(0) === "#" ||
      href.indexOf("mailto:") === 0 ||
      href.indexOf("tel:") === 0
    ) {
      return false;
    }

    var url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin) {
      return false;
    }

    return ["/", "/status", "/privacy", "/account-deletion"].indexOf(url.pathname) !== -1;
  }

  function updateActiveNav(pathname) {
    var links = document.querySelectorAll(".nav a");
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var linkPath = new URL(link.href, window.location.href).pathname;
      if (linkPath === pathname) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    }
  }

  function replacePageFromDocument(nextDocument, url, shouldPush) {
    var currentMain = document.querySelector("#main-content");
    var nextMain = nextDocument.querySelector("#main-content");
    if (!currentMain || !nextMain) {
      window.location.href = url.href;
      return;
    }

    stopStatusPage();
    document.title = nextDocument.title;
    currentMain.className = nextMain.className;
    currentMain.innerHTML = nextMain.innerHTML;
    updateActiveNav(url.pathname);

    if (shouldPush) {
      history.pushState({}, "", url.href);
    }

    initStatusPage();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function setNavigating(isNavigating) {
    document.documentElement.classList.toggle("is-soft-navigating", isNavigating);
  }

  function navigateSoft(url, shouldPush) {
    if (currentNavigation) {
      currentNavigation.abort();
    }
    currentNavigation = new AbortController();
    setNavigating(true);

    return fetch(url.href, {
      headers: { accept: "text/html" },
      signal: currentNavigation.signal,
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Navigation failed");
        }
        return response.text();
      })
      .then(function (html) {
        var nextDocument = new DOMParser().parseFromString(html, "text/html");
        var swap = function () {
          replacePageFromDocument(nextDocument, url, shouldPush);
        };

        if (document.startViewTransition) {
          document.startViewTransition(swap);
        } else {
          swap();
        }
      })
      .catch(function (error) {
        if (error.name !== "AbortError") {
          window.location.href = url.href;
        }
      })
      .finally(function () {
        currentNavigation = null;
        setNavigating(false);
      });
  }

  function initSoftNavigation() {
    document.addEventListener("click", function (event) {
      var link = event.target.closest && event.target.closest("a");
      if (!shouldHandleLink(link, event)) {
        return;
      }

      var url = new URL(link.href, window.location.href);
      if (url.href === window.location.href) {
        return;
      }

      event.preventDefault();
      navigateSoft(url, true);
    });

    window.addEventListener("popstate", function () {
      navigateSoft(new URL(window.location.href), false);
    });
  }

  // ---- Status page -------------------------------------------------------
  var STATE_LABELS = {
    operational: "Operational",
    degraded: "Degraded",
    down: "Down",
    checking: "Checking",
  };

  function setBadge(root, selector, state, hint) {
    var component = root.querySelector(
      '[data-component="' + selector + '"]'
    );
    if (!component) {
      return;
    }
    var badge = component.querySelector("[data-badge]");
    var label = component.querySelector("[data-badge-label]");
    if (badge) {
      badge.setAttribute("data-state", state);
    }
    if (label) {
      label.textContent = STATE_LABELS[state] || state;
    }
    if (hint) {
      var hintEl = component.querySelector("[data-hint]");
      if (hintEl) {
        hintEl.textContent = hint;
      }
    }
  }

  function checkEndpoint(url) {
    var started = performance.now();
    return fetch(url, {
      headers: { accept: "application/json" },
      cache: "no-store",
    })
      .then(function (response) {
        return response
          .json()
          .catch(function () {
            return {};
          })
          .then(function (data) {
            return {
              ok: response.ok,
              status: response.status,
              data: data,
              latency: Math.round(performance.now() - started),
            };
          });
      })
      .catch(function () {
        return { ok: false, status: 0, data: {}, latency: null };
      });
  }

  function pad(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function nowUtc() {
    var d = new Date();
    return (
      d.getUTCFullYear() +
      "-" +
      pad(d.getUTCMonth() + 1) +
      "-" +
      pad(d.getUTCDate()) +
      " " +
      pad(d.getUTCHours()) +
      ":" +
      pad(d.getUTCMinutes()) +
      ":" +
      pad(d.getUTCSeconds())
    );
  }

  function initStatusPage() {
    stopStatusPage();

    var root = document.querySelector("[data-status-page]");
    if (!root) {
      return;
    }

    var banner = root.querySelector("[data-status-banner]");
    var bannerTitle = root.querySelector("[data-banner-title]");
    var bannerText = root.querySelector("[data-banner-text]");
    var updatedAt = root.querySelector("[data-updated-at]");

    function refresh() {
      setBadge(root, "edge", "checking");
      setBadge(root, "api", "checking");
      setBadge(root, "database", "checking");

      Promise.all([checkEndpoint("/health"), checkEndpoint("/ready")]).then(
        function (results) {
          var health = results[0];
          var ready = results[1];

          var edgeUp = health.status > 0 || ready.status > 0;
          var apiUp = health.ok && health.data.status === "ok";
          var dbUp = ready.ok && ready.data.status === "ready";

          setBadge(root, "edge", edgeUp ? "operational" : "down");
          setBadge(root, "api", apiUp ? "operational" : "down");
          setBadge(
            root,
            "database",
            dbUp ? "operational" : "down",
            dbUp
              ? "Collections, quests, gifts, and battle history are available."
              : "Some saved progress may be temporarily unavailable."
          );

          var overall = "operational";
          if (!edgeUp || !apiUp) {
            overall = "down";
          } else if (!dbUp) {
            overall = "degraded";
          }

          if (banner) {
            banner.setAttribute("data-state", overall);
          }
          if (bannerTitle && bannerText) {
            if (overall === "operational") {
              bannerTitle.textContent = "Adventure Time TCG is ready to play";
              bannerText.textContent =
                "Sign-in, collections, quests, and battles are responding normally.";
            } else if (overall === "degraded") {
              bannerTitle.textContent = "Some game features may be limited";
              bannerText.textContent =
                "You may be able to open the app, but saved progress or battles may not load correctly.";
            } else {
              bannerTitle.textContent = "Adventure Time TCG is having trouble";
              bannerText.textContent =
                "The app may not load right now. Please try again in a few minutes.";
            }
          }
          if (updatedAt) {
            updatedAt.textContent = nowUtc();
          }
        }
      );
    }

    refresh();
    statusInterval = setInterval(refresh, 15000);
  }

  function stopStatusPage() {
    if (statusInterval) {
      clearInterval(statusInterval);
      statusInterval = null;
    }
  }

  // ---- Boot --------------------------------------------------------------
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(function () {
    initThemeSwitch();
    initSoftNavigation();
    initStatusPage();
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        initStatusPage();
      }
    });
  });
})();
