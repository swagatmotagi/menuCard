const GOOGLE_SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTICL7HM3180wTAOnXHB3l2ZS_EYaNYxOq_MSujRsWl-UJ98xSiQDIxFKVWsIgrjJ8KkyTMMVLi4mD1/pub?gid=0&single=true&output=csv";

const statusEl = document.getElementById("status");
const menuListEl = document.getElementById("menuList");
const menuContentEl = document.getElementById("menuContent");
const themeToggleEl = document.getElementById("themeToggle");
const searchToggleEl = document.getElementById("searchToggle");
const searchPanelEl = document.getElementById("searchPanel");
const searchInputEl = document.getElementById("searchInput");
const searchResultsEl = document.getElementById("searchResults");
const menuTypeButtons = document.querySelectorAll(".menu-type-btn");
const foodFilterButtons = document.querySelectorAll(".food-filter-btn");
const drinkFilterButtons = document.querySelectorAll(".drink-filter-btn");
const foodFiltersEl = document.getElementById("foodFilters");
const drinkFiltersEl = document.getElementById("drinkFilters");
const foodSectionPanelEl = document.getElementById("foodSectionPanel");
const foodSectionTabsEl = document.getElementById("foodSectionTabs");
const drinkSectionPanelEl = document.getElementById("drinkSectionPanel");
const drinkSectionTabsEl = document.getElementById("drinkSectionTabs");
const PRICE_SYMBOL = "₹";

const FOOD_SECTION_LABELS = {
  all: "All",
  "starters-snacks": "Starters/Snacks",
  thali: "Thali",
};
const FOOD_PREFERRED_SECTION_KEYS = ["starters-snacks", "thali"];

let menuItems = [];
let activeMenuType = "food";
let activeFoodFilter = getDefaultFilterValue(foodFilterButtons, "foodFilter", "non-veg");
let activeFoodSection = "";
let activeDrinkFilter = getDefaultFilterValue(drinkFilterButtons, "drinkFilter", "alcohol");
let activeDrinkSection = "";
let isSearchOpen = false;
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
    activeFoodFilter = button.dataset.foodFilter || activeFoodFilter;
    activeFoodSection = "";
    applyFilterToggleState(foodFilterButtons, activeFoodFilter, "foodFilter");
    applyFilterVisibility();
    renderMenu();
  });
});

drinkFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeDrinkFilter = button.dataset.drinkFilter || activeDrinkFilter;
    activeDrinkSection = "";
    applyFilterToggleState(drinkFilterButtons, activeDrinkFilter, "drinkFilter");
    applyFilterVisibility();
    renderMenu();
  });
});

themeToggleEl.addEventListener("click", toggleTheme);
searchToggleEl.addEventListener("click", toggleSearch);
searchInputEl.addEventListener("input", renderSearchResults);

applyMenuTypeToggleState();
applyFilterToggleState(foodFilterButtons, activeFoodFilter, "foodFilter");
applyFilterToggleState(drinkFilterButtons, activeDrinkFilter, "drinkFilter");
applyFilterVisibility();
initializeTheme();
init();

async function init() {
  renderMenu();

  try {
    const response = await fetch(GOOGLE_SHEET_CSV_URL);
    if (!response.ok) throw new Error("Could not fetch menu data.");

    const csv = await response.text();
    const parsedItems = parseCsv(csv)
      .map(normalizeItem)
      .filter((item) => item.name)
      .sort((a, b) => {
        // 1. Sort by Category (Veg, Non-Veg, etc.)
        if (a.category !== b.category) {
          return String(a.category).localeCompare(String(b.category));
        }
        // 2. Sort by Section Sequence
        if (a.sectionSequence !== b.sectionSequence) {
          return a.sectionSequence - b.sectionSequence;
        }
        // 3. Sort by Item Sequence
        return a.itemSequence - b.itemSequence;
      });

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
      if (activeFoodFilter && normalizeCategory(item.category) !== activeFoodFilter) return false;
      if (shouldShowFoodSectionPanel() && activeFoodSection) {
        return normalizeFoodSection(item.section) === activeFoodSection;
      }
      return true;
    }

    if (activeDrinkFilter && determineDrinkFamily(item) !== activeDrinkFilter) return false;
    if (shouldShowDrinkSectionPanel() && activeDrinkSection) {
      return normalizeDrinkSection(item.section) === activeDrinkSection;
    }

    return true;
  });

  const itemsToRender = activeMenuType === "drinks" ? groupDrinkItems(filtered) : filtered;

  if (!itemsToRender.length) {
    menuListEl.innerHTML = '<div class="empty">No items found for this filter.</div>';
    return;
  }

  menuListEl.innerHTML = itemsToRender
    .map(
      (item) => `
        <article class="menu-item">
          <div class="menu-item-header">
            <h2 class="menu-item-name">${escapeHtml(getDisplayName(item))}</h2>
            ${renderPrimaryPrice(item)}
          </div>
          ${item.description ? `<p class="menu-item-description">${escapeHtml(item.description)}</p>` : ""}
          ${renderDrinkSizeList(item)}
          <div class="menu-item-meta">
            ${renderCategoryPill(item)}
            ${item.section ? `<span class="pill ${normalizeDrinkSection(item.section)}">${escapeHtml(item.section)}</span>` : ""}
          </div>
        </article>
      `
    )
    .join("");
}

function toggleSearch() {
  isSearchOpen = !isSearchOpen;
  applySearchState();

  if (isSearchOpen) {
    searchInputEl.focus();
    renderSearchResults();
    return;
  }

  searchInputEl.value = "";
  searchResultsEl.innerHTML = "";
}

function applySearchState() {
  searchToggleEl.setAttribute("aria-expanded", String(isSearchOpen));
  searchPanelEl.classList.toggle("hidden", !isSearchOpen);
  searchResultsEl.classList.toggle("hidden", !isSearchOpen);
  menuContentEl.classList.toggle("hidden", isSearchOpen);
  statusEl.classList.toggle("hidden", isSearchOpen);
}

function renderSearchResults() {
  const query = String(searchInputEl.value || "")
    .trim()
    .toLowerCase();

  if (!query) {
    searchResultsEl.innerHTML = '<div class="empty">Type an item or section to search.</div>';
    return;
  }

  const matches = getSearchableItems().filter((item) => {
    const byName = String(item.name || "").toLowerCase().includes(query);
    const byDisplayName = String(item.displayName || "").toLowerCase().includes(query);
    const bySection = getSearchSections(item).some((section) => section.toLowerCase().includes(query));
    return byName || byDisplayName || bySection;
  });

  if (!matches.length) {
    searchResultsEl.innerHTML = '<div class="empty">No matching items found.</div>';
    return;
  }

  searchResultsEl.innerHTML = matches
    .map(
      (item) => `
        <article class="menu-item">
          <div class="menu-item-header">
            <h2 class="menu-item-name">${escapeHtml(getDisplayName(item))}</h2>
            ${renderPrimaryPrice(item)}
          </div>
          ${item.description ? `<p class="menu-item-description">${escapeHtml(item.description)}</p>` : ""}
          ${renderDrinkSizeList(item)}
        </article>
      `
    )
    .join("");
}

function getSearchableItems() {
  const foodItems = menuItems.filter((item) => inferMenuType(item) === "food");
  const drinkItems = groupDrinkItems(menuItems.filter((item) => inferMenuType(item) === "drinks"));
  return [...foodItems, ...drinkItems];
}

function normalizeItem(row) {
  return {
    name: row.item || row.name || "",
    displayName: row.display_name || row.displayname || "",
    description: row.description || "",
    price: row.price || "",
    size: row.size || "",
    category: row.category || "",
    section: row.section || "",
    menuType: row.type || row.menu || "",
    sectionSequence: parseInt(row.section_sequence || row.sectionsequence || 999),
    itemSequence: parseInt(row.item_sequence || row.itemsequence || 999),
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
  if (!raw) return "other";
  return slugify(raw);
}

function normalizeFoodSection(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "other";
  if (["starters", "starter", "snacks", "snack", "starters/snacks", "starters / snacks"].includes(raw)) {
    return "starters-snacks";
  }
  if (raw === "thali") return "thali";
  return slugify(raw);
}

function determineDrinkFamily(item) {
  const raw = String(item.category || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-");
  if (raw === "alcoholic-drink") return "alcohol";
  if (
    raw === "non-alcoholic-drink" ||
    raw === "nonalcoholic-drink" ||
    raw === "non-alcholic-drink" ||
    raw === "nonalcholic-drink"
  ) {
    return "non-alcoholic";
  }
  if (["drink", "drinks", "beverage", "beverages"].includes(raw)) return "alcohol";
  return "other";
}

function inferMenuType(item) {
  const explicitType = String(item.menuType || "").trim().toLowerCase();
  if (["drink", "drinks", "beverage", "beverages"].includes(explicitType)) return "drinks";
  if (["food", "foods"].includes(explicitType)) return "food";
  if (determineDrinkFamily(item) !== "other" || normalizeCategory(item.category) === "drinks") return "drinks";
  return "food";
}

function renderCategoryPill(item) {
  if (inferMenuType(item) === "drinks") {
    return '<span class="pill">Drinks</span>';
  }

  const normalized = normalizeCategory(item.category);
  return `<span class="pill ${normalized}">${escapeHtml(item.category || "N/A")}</span>`;
}

function getFoodSectionOptions() {
  const items = menuItems.filter(
    (item) =>
      inferMenuType(item) === "food" &&
      (!activeFoodFilter || normalizeCategory(item.category) === activeFoodFilter)
  );
  
  const sectionMap = new Map();
  items.forEach((item) => {
    const key = normalizeFoodSection(item.section);
    if (!key || key === "other") return;
    if (!sectionMap.has(key) || item.sectionSequence < sectionMap.get(key).sequence) {
      sectionMap.set(key, { sequence: item.sectionSequence });
    }
  });

  return Array.from(sectionMap.keys()).sort((a, b) => {
    return sectionMap.get(a).sequence - sectionMap.get(b).sequence;
  });
}

function renderFoodSectionTabs() {
  const options = getFoodSectionOptions();

  if (!options.includes(activeFoodSection)) {
    activeFoodSection = options[0] || "";
  }

  if (!options.length) {
    foodSectionTabsEl.innerHTML = "";
    return;
  }

  foodSectionTabsEl.innerHTML = options
    .map((key) => {
      const isActive = key === activeFoodSection;
      const label = FOOD_SECTION_LABELS[key] || formatSectionLabel(key);
      return `<button type="button" class="vertical-tab-btn ${isActive ? "is-active" : ""}" data-food-section="${key}" aria-pressed="${isActive}">${escapeHtml(label)}</button>`;
    })
    .join("");

  foodSectionTabsEl.querySelectorAll(".vertical-tab-btn").forEach((button) => {
    button.addEventListener("click", () => {
      activeFoodSection = button.dataset.foodSection || options[0] || "";
      renderFoodSectionTabs();
      renderMenu();
    });
  });
}

function getDrinkSectionOptions() {
  const items = menuItems.filter(
    (item) =>
      inferMenuType(item) === "drinks" &&
      (!activeDrinkFilter || determineDrinkFamily(item) === activeDrinkFilter)
  );
  
  const sectionMap = new Map();
  items.forEach((item) => {
    const key = normalizeDrinkSection(item.section);
    if (!key) return;
    if (!sectionMap.has(key) || item.sectionSequence < sectionMap.get(key).sequence) {
      sectionMap.set(key, { sequence: item.sectionSequence });
    }
  });

  return Array.from(sectionMap.keys()).sort((a, b) => {
    return sectionMap.get(a).sequence - sectionMap.get(b).sequence;
  });
}

function renderDrinkSectionTabs() {
  const options = getDrinkSectionOptions();

  if (!options.includes(activeDrinkSection)) {
    activeDrinkSection = options[0] || "";
  }

  if (!options.length) {
    drinkSectionTabsEl.innerHTML = "";
    return;
  }

  drinkSectionTabsEl.innerHTML = options
    .map((key) => {
      const isActive = key === activeDrinkSection;
      const label = formatSectionLabel(key);
      return `<button type="button" class="vertical-tab-btn ${isActive ? "is-active" : ""}" data-drink-section="${key}" aria-pressed="${isActive}">${escapeHtml(label)}</button>`;
    })
    .join("");

  drinkSectionTabsEl.querySelectorAll(".vertical-tab-btn").forEach((button) => {
    button.addEventListener("click", () => {
      activeDrinkSection = button.dataset.drinkSection || options[0] || "";
      renderDrinkSectionTabs();
      renderMenu();
    });
  });
}

function shouldShowDrinkSectionPanel() {
  if (activeMenuType !== "drinks") return false;
  return getDrinkSectionOptions().length > 0;
}

function shouldShowFoodSectionPanel() {
  if (activeMenuType !== "food") return false;
  return getFoodSectionOptions().length > 0;
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

function formatPrice(value) {
  const raw = String(value || "").trim();
  if (!raw) return PRICE_SYMBOL;
  const normalized = raw.replace(/^(₹|rs\.?|inr)\s*/i, "").trim();
  return normalized ? `${PRICE_SYMBOL} ${normalized}` : PRICE_SYMBOL;
}

function groupDrinkItems(items) {
  const grouped = new Map();

  items.forEach((item) => {
    const key = String(item.name || "")
      .trim()
      .toLowerCase();

    if (!key) return;

    if (!grouped.has(key)) {
      grouped.set(key, {
        ...item,
        sizePrices: [],
        searchSections: [],
      });
    }

    const group = grouped.get(key);
    if (!group.displayName && item.displayName) {
      group.displayName = item.displayName;
    }
    if (!group.description && item.description) {
      group.description = item.description;
    }
    if (!group.section && item.section) {
      group.section = item.section;
    }

    const sectionName = String(item.section || "").trim();
    if (sectionName && !group.searchSections.some((value) => value.toLowerCase() === sectionName.toLowerCase())) {
      group.searchSections.push(sectionName);
    }

    const sizeLabel = String(item.size || "").trim();
    const priceValue = String(item.price || "").trim();
    const existing = group.sizePrices.some((entry) => entry.size === sizeLabel && entry.price === priceValue);
    if (!existing) {
      group.sizePrices.push({ size: sizeLabel, price: priceValue });
    }
  });

  return [...grouped.values()];
}

function renderPrimaryPrice(item) {
  if (inferMenuType(item) === "drinks") {
    const hasSizes = getDrinkSizeEntries(item).some((entry) => String(entry.size || "").trim());
    if (hasSizes) return "";
  }
  return `<span class="menu-item-price">${escapeHtml(formatPrice(item.price))}</span>`;
}

function renderDrinkSizeList(item) {
  if (inferMenuType(item) !== "drinks") return "";

  const entries = getDrinkSizeEntries(item);
  const validEntries = entries.filter((entry) => String(entry.size || "").trim());
  if (!validEntries.length) return "";

  const rows = validEntries
    .map((entry) => {
      const sizeLabel = escapeHtml(entry.size);
      const priceLabel = escapeHtml(formatPrice(entry.price));
      return `<div class="drink-size-row"><span class="drink-size-label">${sizeLabel}</span><span class="drink-size-price">${priceLabel}</span></div>`;
    })
    .join("");

  return `<div class="drink-size-list">${rows}</div>`;
}

function getDrinkSizeEntries(item) {
  return item.sizePrices?.length ? item.sizePrices : [{ size: item.size || "", price: item.price || "" }];
}

function getDisplayName(item) {
  const preferred = String(item.displayName || "").trim();
  return preferred || String(item.name || "").trim();
}

function getSearchSections(item) {
  const sections = [];
  const primary = String(item.section || "").trim();
  if (primary) sections.push(primary);

  if (Array.isArray(item.searchSections)) {
    item.searchSections.forEach((section) => {
      const value = String(section || "").trim();
      if (!value) return;
      if (sections.some((existing) => existing.toLowerCase() === value.toLowerCase())) return;
      sections.push(value);
    });
  }

  return sections;
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

  const showFoodSections = shouldShowFoodSectionPanel();
  const showDrinkSections = shouldShowDrinkSectionPanel();
  menuContentEl.classList.toggle("has-section-panel", showFoodSections || showDrinkSections);
  foodSectionPanelEl.classList.toggle("hidden", !showFoodSections);
  drinkSectionPanelEl.classList.toggle("hidden", !showDrinkSections);

  if (showFoodSections) {
    renderFoodSectionTabs();
  } else {
    activeFoodSection = "";
  }

  if (showDrinkSections) {
    renderDrinkSectionTabs();
  } else {
    activeDrinkSection = "";
  }
}

function getDefaultFilterValue(buttons, datasetKey, fallback) {
  const active = [...buttons].find((button) => button.classList.contains("is-active") && button.dataset[datasetKey]);
  if (active) return active.dataset[datasetKey];
  
  const first = [...buttons].find((button) => button.dataset[datasetKey]);
  return first ? first.dataset[datasetKey] : fallback;
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatSectionLabel(key) {
  return key
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
