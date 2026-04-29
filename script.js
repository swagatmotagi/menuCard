const SHEET_URLS = {
  "veg": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTICL7HM3180wTAOnXHB3l2ZS_EYaNYxOq_MSujRsWl-UJ98xSiQDIxFKVWsIgrjJ8KkyTMMVLi4mD1/pub?gid=0&single=true&output=csv",
  "non-veg": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTICL7HM3180wTAOnXHB3l2ZS_EYaNYxOq_MSujRsWl-UJ98xSiQDIxFKVWsIgrjJ8KkyTMMVLi4mD1/pub?gid=596077205&single=true&output=csv",
  "alcohol": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTICL7HM3180wTAOnXHB3l2ZS_EYaNYxOq_MSujRsWl-UJ98xSiQDIxFKVWsIgrjJ8KkyTMMVLi4mD1/pub?gid=2135661285&single=true&output=csv",
  "non-alcoholic": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTICL7HM3180wTAOnXHB3l2ZS_EYaNYxOq_MSujRsWl-UJ98xSiQDIxFKVWsIgrjJ8KkyTMMVLi4mD1/pub?gid=375166322&single=true&output=csv",
  "cigarettes": "https://docs.google.com/spreadsheets/d/e/2PACX-1vTICL7HM3180wTAOnXHB3l2ZS_EYaNYxOq_MSujRsWl-UJ98xSiQDIxFKVWsIgrjJ8KkyTMMVLi4mD1/pub?gid=172598136&single=true&output=csv",
};

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

let menuItems = [];
let activeMenuType = "food";
let activeFoodFilter = getDefaultFilterValue(foodFilterButtons, "foodFilter", "non-veg");
let activeFoodSection = "";
let activeDrinkFilter = getDefaultFilterValue(drinkFilterButtons, "drinkFilter", "alcohol");
let activeDrinkSection = "";
let isSearchOpen = false;
let isInitialLoadInProgress = true;
const THEME_KEY = "menu-theme";
const sheetItemsByKey = {};
const failedSheetKeys = new Set();

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
  statusEl.textContent = "Loading menu...";

  const initialKey = getInitialSheetKey();
  const initialUrl = SHEET_URLS[initialKey];

  if (!initialUrl || initialUrl.includes("REPLACE_WITH")) {
    statusEl.textContent = "Default menu tab is not configured.";
    return;
  }

  try {
    const initialItems = await fetchSheetItems(initialKey, initialUrl);
    mergeSheetItems(initialKey, initialItems);

    if (!menuItems.length) {
      statusEl.textContent = "No menu items found in default tab.";
    } else {
      statusEl.textContent = "";
    }
    applyFilterVisibility();
    renderMenu();
  } catch (error) {
    failedSheetKeys.add(initialKey);
    statusEl.textContent = "Unable to load default menu tab.";
    console.error(error);
  } finally {
    isInitialLoadInProgress = false;
    if (!menuItems.length) renderMenu();
  }

  void loadRemainingSheets(initialKey);
}

function getInitialSheetKey() {
  return getActiveSheetKey();
}

async function fetchSheetItems(key, url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch ${key} data.`);

  const csv = await response.text();
  return parseCsv(csv).map((row) => {
    const item = normalizeItem(row);
    // Force the category based on which tab it came from
    if (key === "veg") item.category = "veg";
    if (key === "non-veg") item.category = "non-veg";
    if (key === "alcohol") item.category = "alcoholic-drink";
    if (key === "non-alcoholic") item.category = "non-alcoholic-drink";
    if (key === "cigarettes") item.category = "cigarettes";
    return item;
  });
}

function mergeSheetItems(key, items) {
  sheetItemsByKey[key] = items;
  menuItems = Object.values(sheetItemsByKey)
    .flat()
    .filter((item) => item.name && item.inStock !== "NO");
}

async function loadRemainingSheets(initialKey) {
  const remaining = Object.entries(SHEET_URLS).filter(
    ([key, url]) => key !== initialKey && !url.includes("REPLACE_WITH")
  );

  if (!remaining.length) {
    if (!menuItems.length) statusEl.textContent = "No menu items found across tabs.";
    return;
  }

  let failedCount = 0;
  let completedCount = 0;

  const finalizeStatus = () => {
    if (failedCount) {
      statusEl.textContent = menuItems.length
        ? "Some menu tabs could not be loaded."
        : "Unable to load menu tabs. Verify the URLs.";
      return;
    }
    statusEl.textContent = menuItems.length ? "" : "No menu items found across tabs.";
  };

  await Promise.all(
    remaining.map(async ([key, url]) => {
      try {
        const items = await fetchSheetItems(key, url);
        mergeSheetItems(key, items);
        applyFilterVisibility();
        renderMenu();
      } catch (error) {
        failedSheetKeys.add(key);
        failedCount += 1;
        console.error(error);
      } finally {
        completedCount += 1;
        if (completedCount === remaining.length) {
          finalizeStatus();
        }
      }
    })
  );
}

function renderMenu() {
  const shouldFilterFoodBySection = activeMenuType === "food" && Boolean(activeFoodSection);
  const shouldFilterDrinkBySection = activeMenuType === "drinks" && Boolean(activeDrinkSection);

  const filtered = menuItems.filter((item) => {
    const itemType = inferMenuType(item);
    if (itemType !== activeMenuType) return false;

    if (activeMenuType === "food") {
      if (activeFoodFilter && normalizeCategory(item.category) !== activeFoodFilter) return false;
      if (shouldFilterFoodBySection) {
        return normalizeFoodSection(item.section) === activeFoodSection;
      }
      return true;
    }

    if (activeDrinkFilter && determineDrinkFamily(item) !== activeDrinkFilter) return false;
    if (shouldFilterDrinkBySection) {
      return normalizeDrinkSection(item.section) === activeDrinkSection;
    }

    return true;
  });

  const itemsToRender = activeMenuType === "drinks" ? groupDrinkItems(filtered) : filtered;
  const activeSheetLoading = isActiveSheetPending();

  if (activeSheetLoading || (isInitialLoadInProgress && !itemsToRender.length)) {
    statusEl.textContent = "Loading menu...";
    menuListEl.innerHTML = "";
    return;
  }

  if (statusEl.textContent === "Loading menu...") {
    statusEl.textContent = "";
  }

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
        </article>
      `
    )
    .join("");
}

function getActiveSheetKey() {
  if (activeMenuType === "drinks") {
    if (activeDrinkFilter === "non-alcoholic") return "non-alcoholic";
    if (activeDrinkFilter === "cigarettes") return "cigarettes";
    return "alcohol";
  }
  return activeFoodFilter === "veg" ? "veg" : "non-veg";
}

function isActiveSheetPending() {
  const key = getActiveSheetKey();
  const url = SHEET_URLS[key];
  if (!url || url.includes("REPLACE_WITH")) return false;
  if (failedSheetKeys.has(key)) return false;
  return !Object.prototype.hasOwnProperty.call(sheetItemsByKey, key);
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
  const query = String(searchInputEl.value || "").trim().toLowerCase();

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
    inStock: (
      row.in_stock ||
      row["in stock"] ||
      row["in-stock"] ||
      row.instock ||
      row.instockstatus ||
      "YES"
    ).trim().toUpperCase(),
  };
}

function normalizeCategory(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["veg", "vegetarian", "v"].includes(raw)) return "veg";
  if (["non-veg", "non veg", "nonvegetarian", "nv"].includes(raw)) return "non-veg";
  if (["drink", "drinks", "beverage", "beverages", "alcoholic-drink", "non-alcoholic-drink"].includes(raw)) return "drinks";
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
  if (raw === "cigarettes") return "cigarettes";
  return "other";
}

function inferMenuType(item) {
  const explicitType = String(item.menuType || "").trim().toLowerCase();
  if (["drink", "drinks", "beverage", "beverages"].includes(explicitType)) return "drinks";
  if (["food", "foods"].includes(explicitType)) return "food";
  if (determineDrinkFamily(item) !== "other" || normalizeCategory(item.category) === "drinks") return "drinks";
  return "food";
}

function getFoodSectionOptions() {
  const items = menuItems.filter(
    (item) =>
      inferMenuType(item) === "food" &&
      (!activeFoodFilter || normalizeCategory(item.category) === activeFoodFilter)
  );
  const available = [];
  const seen = new Set();
  items.forEach((item) => {
    const sectionKey = normalizeFoodSection(item.section);
    if (!sectionKey || sectionKey === "other") return;
    if (!seen.has(sectionKey)) {
      seen.add(sectionKey);
      available.push(sectionKey);
    }
  });
  return available;
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

  const labelsBySectionKey = {};
  menuItems.forEach((item) => {
    const key = normalizeFoodSection(item.section);
    if (!labelsBySectionKey[key] && item.section) {
      labelsBySectionKey[key] = item.section;
    }
  });

  foodSectionTabsEl.innerHTML = options
    .map((key) => {
      const isActive = key === activeFoodSection;
      const label = labelsBySectionKey[key] || formatSectionLabel(key);
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
  const available = [];
  const seen = new Set();
  items.forEach((item) => {
    const sectionKey = normalizeDrinkSection(item.section);
    if (!sectionKey) return;
    if (!seen.has(sectionKey)) {
      seen.add(sectionKey);
      available.push(sectionKey);
    }
  });
  return available;
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

  const labelsBySectionKey = {};
  menuItems.forEach((item) => {
    const key = normalizeDrinkSection(item.section);
    if (!labelsBySectionKey[key] && item.section) {
      labelsBySectionKey[key] = item.section;
    }
  });

  drinkSectionTabsEl.innerHTML = options
    .map((key) => {
      const isActive = key === activeDrinkSection;
      const label = labelsBySectionKey[key] || formatSectionLabel(key);
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
  if (activeMenuType !== "drinks" || activeDrinkFilter === "cigarettes") return false;
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
    const key = String(item.name || "").trim().toLowerCase();
    if (!key) return;
    if (!grouped.has(key)) {
      grouped.set(key, { ...item, sizePrices: [], searchSections: [] });
    }
    const group = grouped.get(key);
    if (!group.displayName && item.displayName) group.displayName = item.displayName;
    if (!group.description && item.description) group.description = item.description;
    if (!group.section && item.section) group.section = item.section;
    const sectionName = String(item.section || "").trim();
    if (sectionName && !group.searchSections.some((v) => v.toLowerCase() === sectionName.toLowerCase())) {
      group.searchSections.push(sectionName);
    }
    const sizeLabel = String(item.size || "").trim();
    const priceValue = String(item.price || "").trim();
    const existing = group.sizePrices.some((e) => e.size === sizeLabel && e.price === priceValue);
    if (!existing) group.sizePrices.push({ size: sizeLabel, price: priceValue });
  });
  return [...grouped.values()];
}

function renderPrimaryPrice(item) {
  if (inferMenuType(item) === "drinks") {
    const hasSizes = getDrinkSizeEntries(item).some((e) => String(e.size || "").trim());
    if (hasSizes) return "";
  }
  return `<span class="menu-item-price">${escapeHtml(formatPrice(item.price))}</span>`;
}

function renderDrinkSizeList(item) {
  if (inferMenuType(item) !== "drinks") return "";
  const entries = getDrinkSizeEntries(item);
  const validEntries = entries.filter((e) => String(e.size || "").trim());
  if (!validEntries.length) return "";
  const rows = validEntries
    .map((e) => {
      const s = escapeHtml(e.size);
      const p = escapeHtml(formatPrice(e.price));
      return `<div class="drink-size-row"><span class="drink-size-label">${s}</span><span class="drink-size-price">${p}</span></div>`;
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
    item.searchSections.forEach((s) => {
      const v = String(s || "").trim();
      if (!v) return;
      if (sections.some((ex) => ex.toLowerCase() === v.toLowerCase())) return;
      sections.push(v);
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
  if (showFoodSections) renderFoodSectionTabs(); else activeFoodSection = "";
  if (showDrinkSections) renderDrinkSectionTabs(); else activeDrinkSection = "";
}

function getDefaultFilterValue(buttons, datasetKey, fallback) {
  const active = [...buttons].find((b) => b.classList.contains("is-active") && b.dataset[datasetKey]);
  if (active) return active.dataset[datasetKey];
  const first = [...buttons].find((b) => b.dataset[datasetKey]);
  return first ? first.dataset[datasetKey] : fallback;
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-") // Replace spaces and underscores with dashes
    .replace(/-+/g, "-")     // Remove duplicate dashes
    .replace(/^-+|-+$/g, ""); // Remove leading/trailing dashes
}

function formatSectionLabel(key) {
  return key.split("-").filter(Boolean).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}
