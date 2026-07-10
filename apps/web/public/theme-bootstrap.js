(() => {
  const allowedThemes = ["candy", "ice", "nightosphere"];
  let themeName = "candy";

  try {
    const storedTheme = window.localStorage.getItem("themeName");
    if (allowedThemes.includes(storedTheme)) {
      themeName = storedTheme;
    }
  } catch {
    // Storage can be unavailable in private browsing; Candy is the safe default.
  }

  document.documentElement.dataset.theme = themeName;
})();
