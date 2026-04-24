const GOOGLE_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1zR_fRtYXFJvAKuj3gZyhCxsA5CQTBdS0PczloPZ54GY/gviz/tq?tqx=out:csv";

const statusEl = document.getElementById("status");
const menuListEl = document.getElementById("menuList");
const menuContentEl = document.getElementById("menuContent");
const themeToggleEl = document.getElementById("themeToggle");
const menuTypeButtons = document.querySelectorAll(".menu-type-btn");
const foodFilterButtons = document.querySelectorAll(".food-filter-btn");
const drinkFilterButtons = document.querySelectorAll(".drink-filter-btn");
const foodFiltersEl = document.getElementById("foodFilters");
const drinkFiltersEl = document.getElementById("drinkFilters");
const drinkSectionPanelEl = document.getElementById("drinkSectionPanel");
const drinkSectionTabsEl = document.getElementById("drinkSectionTabs");

const SAMPLE_MENU_ITEMS = [
  { name: "Paneer Tikka", price: "₹220", category: "veg", section: "Starters" },
  { name: "Veg Biryani", price: "₹260", category: "veg", section: "Main Course" },
  { name: "Butter Chicken", price: "₹320", category: "non-veg", section: "Main Course" },
  { name: "Chicken Tikka", price: "₹290", category: "non-veg", section: "Starters" },
  { name: "Jameson", price: "₹280", category: "drinks", section: "Whiskey" },
  { name: "Old Monk", price: "₹220", category: "drinks", section: "Rum" },
  { name: "Kingfisher", price: "₹190", category: "drinks", section: "Beer" },
  { name: "Smirnoff", price: "₹260", category: "drinks", section: "Vodka" },
  { name: "Berry Cooler", price: "₹140", category: "drinks", section: "Fruit Flavoured" },
];

const DRINK_SECTION_LABELS = {
  all: "All",
  whiskey: "Whiskey",
  rum: "Rum",
  beer: "Beer",
  vodka: "Vodka",
  "fruit-flavoured": "Fruit Flavoured",
};

const ALCOHOLIC_SECTION_KEYS = ["whiskey", "rum", "beer", "vodka"];
const NON_ALCOHOLIC_SECTION_KEYS = ["fruit-flavoured"];

const isSheetConfigured = !GOOGLE_SHEET_CSV_URL.includes("REPLACE_WITH_SHEET_ID");
let menuItems = isSheetConfigured ? [] : [...SAMPLE_MENU_ITEMS];
let activeMenuType = "food";
let activeFoodFilter = "all";
let activeDrinkFilter = "all";
let activeDrinkSection = "all";
const THEME_KEY = "menu-theme";

menuTypeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeMenuType = button.dataset.menuType || "food";
    applyMenuTypeToggleState();
    applyFilterVisibility();
    renderMenu();
  });
});

foodFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFoodFilter = button.dataset.foodFilter || "all";
    applyFilterToggleState(foodFilterButtons, activeFoodFilter, "foodFilter");
    renderMenu();
  });
});

drinkFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeDrinkFilter = button.dataset.drinkFilter || "all";
    activeDrinkSection = "all";
    applyFilterToggleState(drinkFilterButtons, activeDrinkFilter, "drinkFilter");
    applyFilterVisibility();
    renderMenu();
  });
});

themeToggleEl.addEventListener("click", toggleTheme);

applyMenuTypeToggleState();
applyFilterToggleState(foodFilterButtons, activeFoodFilter, "foodFilter");
applyFilterToggleState(drinkFilterButtons, activeDrinkFilter, "drinkFilter");
applyFilterVisibility();
initializeTheme();
init();

async function init() {
  renderMenu();

  if (!isSheetConfigured) {
    statusEl.textContent = "Showing demo menu. Add your Google Sheet ID in script.js to load real items.";
    return;
  }

  try {
    const response = await fetch(GOOGLE_SHEET_CSV_URL);
    if (!response.ok) throw new Error("Could not fetch menu data.");

    const csv = await response.text();
    const parsedItems = parseCsv(csv)
      .map(normalizeItem)
      .filter((item) => item.name);

    if (!parsedItems.length) {
      statusEl.textContent = "Sheet loaded, but no valid rows were found. Check headers: item, price, category, section.";
      return;
    }

    menuItems = parsedItems;
    statusEl.textContent = "";
    applyFilterVisibility();
    renderMenu();
  } catch (error) {
    const isLocalFile = window.location.protocol === "file:";
    statusEl.textContent = isLocalFile
      ? "Failed to load sheet from file://. Run a local server (python3 -m http.server) or use GitHub Pages."
      : "Unable to load Google Sheet. Make sheet public and verify the URL.";
    console.error(error);
  }
}

function renderMenu() {
  const filtered = menuItems.filter((item) => {
    const itemType = inferMenuType(item);
    if (itemType !== activeMenuType) return false;

    if (activeMenuType === "food") {
      return activeFoodFilter === "all" || normalizeCategory(item.category) === activeFoodFilter;
    }

    if (activeDrinkFilter !== "all" && determineDrinkFamily(item) !== activeDrinkFilter) return false;
    if (shouldShowDrinkSectionPanel() && activeDrinkSection !== "all") {
      return normalizeDrinkSection(item.section) === activeDrinkSection;
    }

    return true;
  });

  if (!filtered.length) {
    menuListEl.innerHTML = '<div class="empty">No items found for this filter.</div>';
    return;
  }

  menuListEl.innerHTML = filtered
    .map(
      (item) => `
        <article class="menu-item">
          <div class="menu-item-header">
            <h2 class="menu-item-name">${escapeHtml(item.name)}</h2>
            <span class="menu-item-price">${escapeHtml(item.price)}</span>
          </div>
          <div class="menu-item-meta">
            ${renderCategoryPill(item)}
            ${item.section ? `<span class="pill ${normalizeDrinkSection(item.section)}">${escapeHtml(item.section)}</span>` : ""}
          </div>
        </article>
      `
    )
    .join("");
}

function normalizeItem(row) {
  return {
    name: row.item || row.name || "",
    price: row.price || "Ask staff",
    category: row.category || "",
    section: row.section || "",
    menuType: row.type || row.menu || "",
  };
}

function normalizeCategory(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["veg", "vegetarian", "v"].includes(raw)) return "veg";
  if (["non-veg", "non veg", "nonvegetarian", "nv"].includes(raw)) return "non-veg";
  if (["drink", "drinks", "beverage", "beverages"].includes(raw)) return "drinks";
  return "other";
}

function normalizeDrinkSection(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["whiskey", "whisky"].includes(raw)) return "whiskey";
  if (raw === "rum") return "rum";
  if (raw === "beer") return "beer";
  if (raw === "vodka") return "vodka";
  if (["fruit flavoured", "fruit-flavoured", "fruit flavored", "fruit-flavored"].includes(raw)) return "fruit-flavoured";
  if (["alcohol", "alcoholic"].includes(raw)) return "alcohol";
  if (["non-alcoholic", "non alcoholic", "mocktail", "soft drink", "juice"].includes(raw)) return "non-alcoholic";
  return "other";
}

function determineDrinkFamily(item) {
  const sectionKey = normalizeDrinkSection(item.section);
  if (ALCOHOLIC_SECTION_KEYS.includes(sectionKey) || sectionKey === "alcohol") return "alcohol";
  if (NON_ALCOHOLIC_SECTION_KEYS.includes(sectionKey) || sectionKey === "non-alcoholic") return "non-alcoholic";
  return "alcohol";
}

function inferMenuType(item) {
  const explicitType = String(item.menuType || "").trim().toLowerCase();
  if (["drink", "drinks", "beverage", "beverages"].includes(explicitType)) return "drinks";
  if (["food", "foods"].includes(explicitType)) return "food";
  if (normalizeCategory(item.category) === "drinks") return "drinks";

  const sectionType = normalizeDrinkSection(item.section);
  return sectionType === "other" ? "food" : "drinks";
}

function renderCategoryPill(item) {
  if (inferMenuType(item) === "drinks") {
    return '<span class="pill">Drinks</span>';
  }

  const normalized = normalizeCategory(item.category);
  return `<span class="pill ${normalized}">${escapeHtml(item.category || "N/A")}</span>`;
}

function getDrinkSectionOptions() {
  const preferred = activeDrinkFilter === "alcohol" ? ALCOHOLIC_SECTION_KEYS : NON_ALCOHOLIC_SECTION_KEYS;
  const items = menuItems.filter((item) => inferMenuType(item) === "drinks");
  const extras = new Set();

  items.forEach((item) => {
    if (determineDrinkFamily(item) !== activeDrinkFilter) return;
    const sectionKey = normalizeDrinkSection(item.section);
    if (!sectionKey || sectionKey === "other") return;
    if (preferred.includes(sectionKey)) return;
    if (sectionKey === "alcohol" || sectionKey === "non-alcoholic") return;
    extras.add(sectionKey);
  });

  return ["all", ...preferred, ...[...extras].sort()];
}

function renderDrinkSectionTabs() {
  const options = getDrinkSectionOptions();

  if (!options.includes(activeDrinkSection)) {
    activeDrinkSection = "all";
  }

  drinkSectionTabsEl.innerHTML = options
    .map((key) => {
      const isActive = key === activeDrinkSection;
      const label = DRINK_SECTION_LABELS[key] || key;
      return `<button type="button" class="vertical-tab-btn ${isActive ? "is-active" : ""}" data-drink-section="${key}" aria-pressed="${isActive}">${escapeHtml(label)}</button>`;
    })
    .join("");

  drinkSectionTabsEl.querySelectorAll(".vertical-tab-btn").forEach((button) => {
    button.addEventListener("click", () => {
      activeDrinkSection = button.dataset.drinkSection || "all";
      renderDrinkSectionTabs();
      renderMenu();
    });
  });
}

function shouldShowDrinkSectionPanel() {
  return activeMenuType === "drinks" && activeDrinkFilter !== "all";
}

function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = (cols[idx] || "").trim();
    });
    return obj;
  });
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initializeTheme() {
  const storedTheme = localStorage.getItem(THEME_KEY);
  if (storedTheme === "dark" || storedTheme === "light") {
    applyTheme(storedTheme);
    return;
  }

  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const nextTheme = currentTheme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  localStorage.setItem(THEME_KEY, nextTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const isDark = theme === "dark";
  themeToggleEl.setAttribute("aria-pressed", String(isDark));
  themeToggleEl.textContent = isDark ? "🌙" : "☀️";
  themeToggleEl.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
}

function applyFilterToggleState(buttons, activeValue, key) {
  buttons.forEach((button) => {
    const dataKey = key === "foodFilter" ? button.dataset.foodFilter : button.dataset.drinkFilter;
    const isActive = dataKey === activeValue;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function applyMenuTypeToggleState() {
  menuTypeButtons.forEach((button) => {
    const isActive = button.dataset.menuType === activeMenuType;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function applyFilterVisibility() {
  const isFood = activeMenuType === "food";
  foodFiltersEl.classList.toggle("hidden", !isFood);
  drinkFiltersEl.classList.toggle("hidden", isFood);

  const showDrinkSections = shouldShowDrinkSectionPanel();
  menuContentEl.classList.toggle("has-drink-panel", showDrinkSections);
  drinkSectionPanelEl.classList.toggle("hidden", !showDrinkSections);

  if (showDrinkSections) {
    renderDrinkSectionTabs();
  } else {
    activeDrinkSection = "all";
  }
}
