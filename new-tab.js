// ── i18n ──────────────────────────────────────────────────────
function t(key) {
  return chrome?.i18n?.getMessage(key) || key;
}

function applyI18n() {
  document.title = t("appTitle");
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const msg = t(el.dataset.i18n);
    if (msg) el.textContent = msg;
  });
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const msg = t(el.dataset.i18nTitle);
    if (msg) el.title = msg;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const msg = t(el.dataset.i18nPlaceholder);
    if (msg) el.placeholder = msg;
  });
}

const GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)",
];

const DEFAULT_STATE = {
  bookmarks: [],
  background: { type: "color", value: "#3c3c3c" },
  cardStyle: { bgColor: "#ffffff", bgOpacity: 10, fgColor: "#ffffff" },
  showRecent: true,
};

let state;
let dragSrcIndex = null;

// ── Persistence ──────────────────────────────────────────────
function loadState() {
  try {
    return (
      JSON.parse(localStorage.getItem("ntp_state")) ??
      structuredClone(DEFAULT_STATE)
    );
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem("ntp_state", JSON.stringify(state));
}

// ── Background ───────────────────────────────────────────────
const bgLayer = document.getElementById("bg-layer");

function applyBackground(bg) {
  if (bg.type === "color") {
    bgLayer.style.backgroundImage = "none";
    bgLayer.style.backgroundColor = bg.value;
  } else {
    bgLayer.style.backgroundColor = "transparent";
    bgLayer.style.backgroundImage = bg.value;
  }
}

function buildGradientSwatches() {
  const wrap = document.getElementById("gradients-wrap");
  GRADIENTS.forEach((g) => {
    const sw = document.createElement("div");
    sw.className = "gradient-swatch";
    sw.style.backgroundImage = g;
    if (state.background.type === "gradient" && state.background.value === g) {
      sw.classList.add("active");
    }
    sw.addEventListener("click", () => {
      setBgActive("gradient");
      document
        .querySelectorAll(".gradient-swatch")
        .forEach((s) => s.classList.remove("active"));
      sw.classList.add("active");
      state.background = { type: "gradient", value: g };
      applyBackground(state.background);
      saveState();
    });
    wrap.appendChild(sw);
  });
}

function setBgActive(type) {
  document.querySelectorAll(".bg-label").forEach((el) => {
    el.classList.toggle("active", el.dataset.type === type);
  });
}

function syncBgControls() {
  const { type, value } = state.background;
  setBgActive(type);
  if (type === "color") {
    document.getElementById("bg-color").value = value;
  }
}

document.getElementById("bg-color").addEventListener("input", (e) => {
  setBgActive("color");
  state.background = { type: "color", value: e.target.value };
  applyBackground(state.background);
  saveState();
});

document.getElementById("bg-image").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    setBgActive("image");
    document.getElementById("image-name").textContent = file.name;
    state.background = { type: "image", value: `url("${ev.target.result}")` };
    applyBackground(state.background);
    saveState();
  };
  reader.readAsDataURL(file);
});

// ── Card style ───────────────────────────────────────────────
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function applyCardStyle(style) {
  const [r, g, b] = hexToRgb(style.bgColor);
  const op = style.bgOpacity / 100;
  const root = document.documentElement;
  root.style.setProperty("--card-bg", `rgba(${r},${g},${b},${op})`);
  root.style.setProperty(
    "--card-bg-hover",
    `rgba(${r},${g},${b},${Math.min(1, op + 0.1)})`,
  );
  root.style.setProperty("--card-color", style.fgColor);
}

function syncCardControls() {
  const s = state.cardStyle;
  document.getElementById("card-bg-color").value = s.bgColor;
  document.getElementById("card-bg-opacity").value = s.bgOpacity;
  document.getElementById("card-bg-opacity-val").textContent =
    s.bgOpacity + "%";
  document.getElementById("card-fg-color").value = s.fgColor;
}

document.getElementById("card-bg-color").addEventListener("input", (e) => {
  state.cardStyle.bgColor = e.target.value;
  applyCardStyle(state.cardStyle);
  saveState();
});

document.getElementById("card-bg-opacity").addEventListener("input", (e) => {
  state.cardStyle.bgOpacity = Number(e.target.value);
  document.getElementById("card-bg-opacity-val").textContent =
    e.target.value + "%";
  applyCardStyle(state.cardStyle);
  saveState();
});

document.getElementById("card-fg-color").addEventListener("input", (e) => {
  state.cardStyle.fgColor = e.target.value;
  applyCardStyle(state.cardStyle);
  saveState();
});

// ── Bookmarks ─────────────────────────────────────────────────
const grid = document.getElementById("bookmarks-grid");

function getDomain(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function getFaviconUrl(u) {
  if (!u) return "";
  const url = new URL(chrome.runtime.getURL("/_favicon/"));
  url.searchParams.set("pageUrl", u);
  url.searchParams.set("size", "32");
  return url.toString();
}

function createFaviconImg(url, title) {
  const img = document.createElement("img");
  img.className = "favicon";
  img.src = getFaviconUrl(url);
  img.alt = "";
  let usedFallback = false;
  img.addEventListener("error", () => {
    if (!usedFallback) {
      usedFallback = true;
      const domain = getDomain(url);
      if (domain) {
        img.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        return;
      }
    }
    const letter = document.createElement("div");
    letter.className = "favicon-letter";
    letter.textContent = (title && title[0]) || "?";
    img.replaceWith(letter);
  });
  return img;
}

function createCard(bm, index) {
  const card = document.createElement("a");
  card.className = "bookmark-card";
  card.href = bm.url;
  card.draggable = true;
  card.dataset.index = index;

  const titleEl = document.createElement("span");
  titleEl.className = "bm-title";
  titleEl.textContent = bm.title;
  titleEl.title = bm.title;

  card.append(createFaviconImg(bm.url, bm.title), titleEl);

  card.addEventListener("contextmenu", (e) => showCtxMenu(e, index));

  card.addEventListener("dragstart", () => {
    dragSrcIndex = index;
    card.classList.add("dragging");
  });
  card.addEventListener("dragend", () => card.classList.remove("dragging"));
  card.addEventListener("dragover", (e) => {
    e.preventDefault();
    card.classList.add("drag-over");
  });
  card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
  card.addEventListener("drop", (e) => {
    e.preventDefault();
    card.classList.remove("drag-over");
    if (dragSrcIndex === null || dragSrcIndex === index) return;
    const [moved] = state.bookmarks.splice(dragSrcIndex, 1);
    state.bookmarks.splice(index, 0, moved);
    dragSrcIndex = null;
    saveState();
    renderBookmarks();
  });

  return card;
}

function renderBookmarks() {
  const addBtn = document.getElementById("add-btn");
  grid.innerHTML = "";
  state.bookmarks.forEach((bm, i) => grid.appendChild(createCard(bm, i)));
  grid.appendChild(addBtn);
}

// ── Context menu ──────────────────────────────────────────────
const ctxMenu = document.getElementById("ctx-menu");
let ctxTargetIndex = null;

function showCtxMenu(e, index) {
  e.preventDefault();
  ctxTargetIndex = index;
  ctxMenu.classList.remove("hidden");
  const x = Math.min(e.clientX, window.innerWidth - ctxMenu.offsetWidth - 8);
  const y = Math.min(e.clientY, window.innerHeight - ctxMenu.offsetHeight - 8);
  ctxMenu.style.left = x + "px";
  ctxMenu.style.top = y + "px";
}

function hideCtxMenu() {
  ctxMenu.classList.add("hidden");
  ctxTargetIndex = null;
}

document.getElementById("ctx-edit").addEventListener("click", () => {
  if (ctxTargetIndex === null) return;
  openModal(ctxTargetIndex);
  hideCtxMenu();
});

document.getElementById("ctx-remove").addEventListener("click", () => {
  if (ctxTargetIndex === null) return;
  state.bookmarks.splice(ctxTargetIndex, 1);
  saveState();
  renderBookmarks();
  hideCtxMenu();
});

document.addEventListener("click", (e) => {
  if (!ctxMenu.contains(e.target)) hideCtxMenu();
});

// ── Modal ─────────────────────────────────────────────────────
const modalOverlay = document.getElementById("modal-overlay");
const bmUrlInput = document.getElementById("bm-url");
const bmTitleInput = document.getElementById("bm-title");
const modalTitle = document.getElementById("modal-title");
let editingIndex = null;

function openModal(index = null) {
  editingIndex = index;
  const bm = index !== null ? state.bookmarks[index] : null;
  bmUrlInput.value = bm?.url ?? "";
  bmTitleInput.value = bm?.title ?? "";
  modalTitle.textContent = t(bm ? "editBookmarkTitle" : "addBookmarkTitle");
  modalOverlay.classList.remove("hidden");
  (bm ? bmTitleInput : bmUrlInput).focus();
}

function closeModal() {
  modalOverlay.classList.add("hidden");
  editingIndex = null;
}

function saveBookmark() {
  let url = bmUrlInput.value.trim();
  if (!url) {
    bmUrlInput.focus();
    return;
  }
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  const title =
    bmTitleInput.value.trim() || getDomain(url).replace(/^www\./, "") || url;

  if (editingIndex !== null) {
    state.bookmarks[editingIndex] = {
      ...state.bookmarks[editingIndex],
      title,
      url,
    };
  } else {
    state.bookmarks.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      title,
      url,
    });
  }
  saveState();
  renderBookmarks();
  closeModal();
}

document.getElementById("add-btn").addEventListener("click", () => openModal());
document.getElementById("modal-cancel").addEventListener("click", closeModal);
document.getElementById("modal-save").addEventListener("click", saveBookmark);

modalOverlay.addEventListener("click", (e) => {
  if (e.target === modalOverlay) closeModal();
});

bmUrlInput.addEventListener("blur", () => {
  if (bmUrlInput.value && !bmTitleInput.value) {
    try {
      const u = new URL(
        /^https?:\/\//i.test(bmUrlInput.value)
          ? bmUrlInput.value
          : "https://" + bmUrlInput.value,
      );
      bmTitleInput.value = u.hostname.replace(/^www\./, "");
    } catch {}
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeModal();
    hideCtxMenu();
  }
  if (e.key === "Enter" && !modalOverlay.classList.contains("hidden")) {
    saveBookmark();
  }
});

// ── Settings panel ────────────────────────────────────────────
const panel = document.getElementById("settings-panel");

document.getElementById("settings-btn").addEventListener("click", () => {
  panel.classList.toggle("open");
});
document.getElementById("close-settings").addEventListener("click", () => {
  panel.classList.remove("open");
});

document.addEventListener("click", (e) => {
  if (
    panel.classList.contains("open") &&
    !panel.contains(e.target) &&
    e.target !== document.getElementById("settings-btn")
  ) {
    panel.classList.remove("open");
  }
});

// ── Recent history ────────────────────────────────────────────
const recentGrid = document.getElementById("recent-grid");
const recentSection = document.getElementById("recent-section");
let topSiteItems = [];

function renderTopSites() {
  recentGrid.innerHTML = "";
  if (!state.showRecent) {
    recentSection.style.display = "none";
    return;
  }
  const bookmarkedDomains = new Set(
    state.bookmarks.map((bm) => getDomain(bm.url)).filter(Boolean),
  );
  const visible = topSiteItems
    .filter((item) => !bookmarkedDomains.has(getDomain(item.url)))
    .slice(0, 8);
  if (!visible.length) {
    recentSection.style.display = "none";
    return;
  }
  recentSection.style.display = "";
  visible.forEach((item) => recentGrid.appendChild(createRecentCard(item)));
}

function createRecentCard(item) {
  const label =
    item.title || getDomain(item.url).replace(/^www\./, "") || item.url;

  const card = document.createElement("a");
  card.className = "recent-card";
  card.href = item.url;

  const titleEl = document.createElement("span");
  titleEl.className = "bm-title";
  titleEl.textContent = label;
  titleEl.title = label;

  const pinBtn = document.createElement("button");
  pinBtn.className = "pin-btn";
  pinBtn.textContent = "+";
  pinBtn.title = t("addToBookmarks");
  pinBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    state.bookmarks.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      title: label,
      url: item.url,
    });
    saveState();
    renderBookmarks();
    renderTopSites();
  });

  const dismissBtn = document.createElement("button");
  dismissBtn.className = "dismiss-btn";
  dismissBtn.textContent = "×";
  dismissBtn.title = t("removeTopSite");
  dismissBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    chrome.history
      .deleteUrl({ url: item.url })
      .then(() => setTimeout(() => loadTopSites(), 100));
  });

  card.append(createFaviconImg(item.url, label), titleEl, pinBtn, dismissBtn);
  return card;
}

function loadTopSites() {
  if (!chrome?.topSites) {
    recentSection.style.display = "none";
    return;
  }
  chrome.topSites.get((sites) => {
    topSiteItems = sites || [];
    renderTopSites();
  });
}

// ── Init ──────────────────────────────────────────────────────
applyI18n();
state = loadState();
if (!state.cardStyle) state.cardStyle = DEFAULT_STATE.cardStyle;
if (state.showRecent === undefined) state.showRecent = true;

document.getElementById("toggle-recent").addEventListener("change", (e) => {
  state.showRecent = e.target.checked;
  saveState();
  renderTopSites();
});

document.getElementById("reset-btn").addEventListener("click", () => {
  const { background, cardStyle, showRecent } = DEFAULT_STATE;
  state.background = structuredClone(background);
  state.cardStyle = structuredClone(cardStyle);
  state.showRecent = showRecent;
  saveState();
  applyBackground(state.background);
  applyCardStyle(state.cardStyle);
  syncBgControls();
  syncCardControls();
  document.getElementById("toggle-recent").checked = state.showRecent;
  renderTopSites();
});

buildGradientSwatches();
syncBgControls();
syncCardControls();
document.getElementById("toggle-recent").checked = state.showRecent;
applyBackground(state.background);
applyCardStyle(state.cardStyle);
renderBookmarks();
loadTopSites();
