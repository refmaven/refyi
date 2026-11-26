const root = document.documentElement;
const toggle = document.querySelector(".theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');

if (toggle) {
  let theme = "dark";
  try {
    theme = localStorage.getItem("refmaven-theme") === "light" ? "light" : "dark";
  } catch {
    theme = "dark";
  }

  const applyTheme = () => {
    const isLight = theme === "light";
    root.dataset.theme = theme;
    toggle.textContent = isLight ? "Dark mode" : "Light mode";
    toggle.setAttribute("aria-label", `Switch to ${isLight ? "dark" : "light"} mode`);
    toggle.setAttribute("aria-pressed", String(isLight));
    if (themeColor) themeColor.content = isLight ? "#ffffff" : "#000000";
  };

  applyTheme();
  toggle.hidden = false;
  toggle.addEventListener("click", () => {
    theme = theme === "dark" ? "light" : "dark";
    applyTheme();
    try {
      localStorage.setItem("refmaven-theme", theme);
    } catch {
      // The current page still changes theme when storage is unavailable.
    }
  });
}
