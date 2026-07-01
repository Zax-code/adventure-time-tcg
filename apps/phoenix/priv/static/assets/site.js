/* Adventure Time TCG — public site behavior
 * 1. Theme switcher with persistence (candy / ice / nightosphere)
 * 2. Live status page polling against the JSON health probes
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
      buttons[i].addEventListener("click", function (event) {
        var theme = event.currentTarget.getAttribute("data-theme-name");
        applyTheme(theme);
        storeTheme(theme);
      });
    }
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
    var root = document.querySelector("[data-status-page]");
    if (!root) {
      return;
    }

    var banner = root.querySelector("[data-status-banner]");
    var bannerTitle = root.querySelector("[data-banner-title]");
    var bannerText = root.querySelector("[data-banner-text]");
    var updatedAt = root.querySelector("[data-updated-at]");
    var latencyValue = root.querySelector("[data-latency-value]");

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
              ? "Readiness probe passed (SELECT 1)."
              : "Readiness probe failing or unreachable."
          );

          if (latencyValue) {
            latencyValue.textContent =
              ready.latency == null ? "—" : ready.latency + " ms";
          }

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
              bannerTitle.textContent = "All systems operational";
              bannerText.textContent =
                "The public edge, API, and database are responding normally.";
            } else if (overall === "degraded") {
              bannerTitle.textContent = "Partial service disruption";
              bannerText.textContent =
                "The edge and API are up, but the database readiness check is failing.";
            } else {
              bannerTitle.textContent = "Service disruption";
              bannerText.textContent =
                "One or more core endpoints are not responding.";
            }
          }
          if (updatedAt) {
            updatedAt.textContent = nowUtc();
          }
        }
      );
    }

    refresh();
    setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        refresh();
      }
    });
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
    initStatusPage();
  });
})();
