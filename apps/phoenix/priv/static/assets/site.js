/* =========================================================================
   Adventure Time TCG — public web behavior
   Theme persistence + switcher and the live status page poller.
   ========================================================================= */
(function () {
  "use strict";

  var THEMES = ["candy", "ice", "nightosphere"];
  var STORAGE_KEY = "attcg-web-theme";
  var root = document.documentElement;

  function readStoredTheme() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (err) {
      /* ignore private-mode storage failures */
    }
  }

  function applyTheme(theme) {
    if (THEMES.indexOf(theme) === -1) {
      theme = "candy";
    }
    root.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var color =
        getComputedStyle(root).getPropertyValue("--bg").trim() || "#fff0f5";
      meta.setAttribute("content", color);
    }
    document.querySelectorAll("[data-theme-name]").forEach(function (btn) {
      btn.setAttribute(
        "aria-pressed",
        btn.getAttribute("data-theme-name") === theme ? "true" : "false"
      );
    });
  }

  function initialTheme() {
    var stored = readStoredTheme();
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
    document.querySelectorAll("[data-theme-name]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var theme = btn.getAttribute("data-theme-name");
        applyTheme(theme);
        storeTheme(theme);
      });
    });
  }

  /* ---------------------------------------------------------------------
     Live status polling for the /status page.
     --------------------------------------------------------------------- */
  var STATE_LABELS = {
    operational: "Operational",
    degraded: "Degraded",
    down: "Down",
    checking: "Checking…"
  };

  function setBadge(el, state) {
    if (!el) return;
    el.setAttribute("data-state", state);
    var label = el.querySelector("[data-badge-label]");
    if (label) {
      label.textContent = STATE_LABELS[state] || state;
    }
  }

  function relativeTime(date) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }

  function checkEndpoint(url) {
    var started = performance.now();
    return fetch(url, { cache: "no-store", headers: { accept: "application/json" } })
      .then(function (res) {
        var latency = Math.round(performance.now() - started);
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (body) {
            return { ok: res.ok, status: res.status, latency: latency, body: body };
          });
      })
      .catch(function () {
        return { ok: false, status: 0, latency: null, body: {} };
      });
  }

  function initStatusPage() {
    var page = document.querySelector("[data-status-page]");
    if (!page) return;

    var banner = page.querySelector("[data-status-banner]");
    var bannerTitle = page.querySelector("[data-banner-title]");
    var bannerText = page.querySelector("[data-banner-text]");
    var updatedAt = page.querySelector("[data-updated-at]");
    var latencyMetric = page.querySelector("[data-latency-value]");

    var edgeBadge = page.querySelector('[data-component="edge"] [data-badge]');
    var apiBadge = page.querySelector('[data-component="api"] [data-badge]');
    var dbBadge = page.querySelector('[data-component="database"] [data-badge]');
    var dbHint = page.querySelector('[data-component="database"] [data-hint]');

    function setBanner(state) {
      if (banner) banner.setAttribute("data-state", state);
      if (bannerTitle) {
        bannerTitle.textContent =
          state === "operational"
            ? "All systems operational"
            : state === "degraded"
            ? "Partial service disruption"
            : "Service disruption";
      }
      if (bannerText) {
        bannerText.textContent =
          state === "operational"
            ? "The public edge, API, and database are responding normally."
            : state === "degraded"
            ? "Some components are responding, but at least one check is unhealthy."
            : "One or more core components are not responding right now.";
      }
    }

    function poll() {
      [edgeBadge, apiBadge, dbBadge].forEach(function (b) {
        setBadge(b, "checking");
      });

      Promise.all([checkEndpoint("/health"), checkEndpoint("/ready")]).then(
        function (results) {
          var health = results[0];
          var ready = results[1];

          // Edge is up if either request completed with an HTTP response.
          var edgeUp = health.status !== 0 || ready.status !== 0;
          setBadge(edgeBadge, edgeUp ? "operational" : "down");

          // API service = /health returning ok.
          var apiUp = health.ok && health.body && health.body.status === "ok";
          setBadge(apiBadge, apiUp ? "operational" : edgeUp ? "degraded" : "down");

          // Database = /ready is the DB readiness probe.
          var dbUp = ready.ok && ready.body && ready.body.status === "ready";
          setBadge(dbBadge, dbUp ? "operational" : edgeUp ? "down" : "down");
          if (dbHint) {
            dbHint.textContent = dbUp
              ? "Readiness probe passed (SELECT 1)."
              : "Readiness probe failed or unreachable.";
          }

          if (latencyMetric) {
            var latency = ready.latency != null ? ready.latency : health.latency;
            latencyMetric.textContent = latency != null ? latency + " ms" : "—";
          }

          var overall = edgeUp && apiUp && dbUp
            ? "operational"
            : edgeUp
            ? "degraded"
            : "down";
          setBanner(overall);

          if (updatedAt) {
            updatedAt.textContent = relativeTime(new Date());
          }
        }
      );
    }

    poll();
    window.setInterval(poll, 15000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        poll();
      }
    });
  }

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
