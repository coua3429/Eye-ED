/* Eye Emergency DST - single-page launcher + algorithm wizard */

const LS_FAV = "eyeDST:favourites";
const LS_RECENT = "eyeDST:recent";

const els = {
  homeScreen: document.getElementById("homeScreen"),
  wizardScreen: document.getElementById("wizardScreen"),
  algorithmsList: document.getElementById("algorithmsList"),
  favouritesList: document.getElementById("favouritesList"),
  recentList: document.getElementById("recentList"),
  favouritesSection: document.getElementById("favouritesSection"),
  recentSection: document.getElementById("recentSection"),
  searchToggle: document.getElementById("searchToggle"),
  searchContainer: document.getElementById("searchContainer"),
  searchInput: document.getElementById("searchInput"),
  searchBtn: document.getElementById("searchBtn"),

  backToHome: document.getElementById("backToHome"),
  wizardTitle: document.getElementById("wizardTitle"),
  toggleRedFlags: document.getElementById("toggleRedFlags"),
  toggleFavourite: document.getElementById("toggleFavourite"),
  redFlagsSection: document.getElementById("redFlagsSection"),
  redFlagsContent: document.getElementById("redFlagsContent"),
  collapseRedFlags: document.getElementById("collapseRedFlags"),

  progressFill: document.getElementById("progressFill"),
  progressText: document.getElementById("progressText"),
  questionText: document.getElementById("questionText"),
  answersContainer: document.getElementById("answersContainer"),
  undoBtn: document.getElementById("undoBtn"),
  restartBtn: document.getElementById("restartBtn"),

  outcomeContainer: document.getElementById("outcomeContainer"),
  outcomeContent: document.getElementById("outcomeContent"),
  copyESRBtn: document.getElementById("copyESRBtn"),
  restartFromOutcome: document.getElementById("restartFromOutcome"),

  toastContainer: document.getElementById("toastContainer"),
  loadingOverlay: document.getElementById("loadingOverlay"),
};

let catalogue = [];
let currentAlgMeta = null;
let currentAlg = null;
let currentNodeId = null;
let historyStack = [];
let redFlagState = {};

function safeJSONParse(raw, fallback) {
  try { return JSON.parse(raw); } catch { return fallback; }
}

function getFavourites() {
  const fav = safeJSONParse(localStorage.getItem(LS_FAV) || "[]", []);
  return new Set(Array.isArray(fav) ? fav : []);
}
function setFavourites(set) {
  localStorage.setItem(LS_FAV, JSON.stringify(Array.from(set)));
}
function getRecents() {
  const rec = safeJSONParse(localStorage.getItem(LS_RECENT) || "[]", []);
  return Array.isArray(rec) ? rec : [];
}
function pushRecent(id) {
  const rec = getRecents().filter(x => x !== id);
  rec.unshift(id);
  localStorage.setItem(LS_RECENT, JSON.stringify(rec.slice(0, 8)));
}

function showToast(msg) {
  const div = document.createElement("div");
  div.className = "toast";
  div.textContent = msg;
  els.toastContainer.appendChild(div);
  setTimeout(() => div.remove(), 2200);
}

function showLoading(on) {
  els.loadingOverlay.classList.toggle("active", !!on);
}

function setScreen(which) {
  const isHome = which === "home";
  els.homeScreen.classList.toggle("active", isHome);
  els.wizardScreen.classList.toggle("active", !isHome);
  window.scrollTo({top:0, behavior:"instant"});
}

function toggleFavourite(id) {
  const fav = getFavourites();
  if (fav.has(id)) {
    fav.delete(id);
    showToast("Removed from favourites");
  } else {
    fav.add(id);
    showToast("Added to favourites");
  }
  setFavourites(fav);
  updateFavIcon();
}

function updateFavIcon() {
  if (!currentAlgMeta) return;
  const fav = getFavourites();
  const icon = els.toggleFavourite.querySelector(".star-icon");
  if (icon) icon.textContent = fav.has(currentAlgMeta.id) ? "⭐" : "☆";
}

function makeCard(meta, favSet) {
  const card = document.createElement("div");
  card.className = "card";
  card.setAttribute("role", "button");
  card.tabIndex = 0;

  const h = document.createElement("h3");
  h.className = "card-title";
  h.textContent = meta.title;
  card.appendChild(h);

  const p = document.createElement("p");
  p.className = "card-meta";
  p.textContent = `Algorithm ${meta.order}`;
  card.appendChild(p);

  const star = document.createElement("button");
  star.className = "star";
  star.type = "button";
  star.textContent = favSet.has(meta.id) ? "⭐" : "☆";
  star.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleFavourite(meta.id);
    renderHome(els.searchInput.value || "");
  });
  card.appendChild(star);

  card.addEventListener("click", () => openAlgorithm(meta));
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") openAlgorithm(meta);
  });

  return card;
}

function renderList(container, list, emptyText) {
  container.innerHTML = "";
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<p>${emptyText}</p>`;
    container.appendChild(empty);
    return;
  }
  const favSet = getFavourites();
  list.forEach(meta => container.appendChild(makeCard(meta, favSet)));
}

function renderHome(filterText = "") {
  const favSet = getFavourites();
  const recents = getRecents();

  const filtered = filterText
    ? catalogue.filter(m =>
        (m.title + " " + (m.tags||[]).join(" ")).toLowerCase().includes(filterText.toLowerCase())
      )
    : catalogue.slice();

  const favList = catalogue.filter(m => favSet.has(m.id));
  els.favouritesSection.style.display = favList.length ? "block" : "none";
  renderList(els.favouritesList, favList, "No favourites yet. Star algorithms to add them here.");

  const recentList = recents.map(id => catalogue.find(m => m.id === id)).filter(Boolean);
  els.recentSection.style.display = recentList.length ? "block" : "none";
  renderList(els.recentList, recentList, "No recent algorithms yet.");

  renderList(els.algorithmsList, filtered, "No algorithms match your search.");
}

function setProgress() {
  const step = Math.max(1, historyStack.length + 1);
  const denom = 6;
  const pct = Math.min(100, Math.round((step / denom) * 100));
  els.progressFill.style.width = `${pct}%`;
  els.progressText.textContent = `Step ${step}`;
}

function renderRedFlagsPanel() {
  if (!currentAlg) return;
  const kp = Array.isArray(currentAlg.keyPoints) ? currentAlg.keyPoints : [];
  const rf = Array.isArray(currentAlg.redFlags) ? currentAlg.redFlags : [];

  const stateKey = `eyeDST:redflags:${currentAlg.id}`;
  const saved = safeJSONParse(localStorage.getItem(stateKey) || "[]", []);
  const ticked = new Set(Array.isArray(saved) ? saved : []);
  redFlagState[currentAlg.id] = ticked;

  const wrap = document.createElement("div");
  if (kp.length) {
    const h = document.createElement("div");
    h.innerHTML = `<div class="pill">Key points</div>`;
    wrap.appendChild(h);

    const ul = document.createElement("ul");
    ul.className = "kp-list";
    kp.forEach(x => { const li = document.createElement("li"); li.textContent = x; ul.appendChild(li); });
    wrap.appendChild(ul);
  }

  if (rf.length) {
    const h2 = document.createElement("div");
    h2.style.marginTop = "10px";
    h2.innerHTML = `<div class="pill">Red flags (tick as you go)</div>`;
    wrap.appendChild(h2);

    rf.forEach(item => {
      const row = document.createElement("div");
      row.className = "checkbox";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = ticked.has(item);
      cb.addEventListener("change", () => {
        if (cb.checked) ticked.add(item); else ticked.delete(item);
        localStorage.setItem(stateKey, JSON.stringify(Array.from(ticked)));
      });
      const label = document.createElement("label");
      label.textContent = item;
      row.appendChild(cb);
      row.appendChild(label);
      wrap.appendChild(row);
    });
  }

  els.redFlagsContent.innerHTML = "";
  els.redFlagsContent.appendChild(wrap);
}

function renderNode() {
  if (!currentAlg || !currentNodeId) return;
  setProgress();

  els.outcomeContainer.style.display = "none";
  document.getElementById("questionContainer").style.display = "block";

  const nodes = currentAlg.algorithm?.nodes || {};
  const node = nodes[currentNodeId];

  if (!node) {
    els.questionText.textContent = "Algorithm error: missing node.";
    els.answersContainer.innerHTML = "";
    return;
  }

  if (node.type === "outcome") {
    showOutcome(node.text || "");
    return;
  }

  els.questionText.textContent = node.text || "Question";
  els.answersContainer.innerHTML = "";

  const answers = Array.isArray(node.answers) ? node.answers : [];
  answers.forEach(ans => {
    const btn = document.createElement("button");
    btn.className = "answer-btn";
    btn.type = "button";
    btn.textContent = ans.text || "Select";
    btn.addEventListener("click", () => {
      historyStack.push({ nodeId: currentNodeId, answerText: ans.text || "" });
      els.undoBtn.disabled = historyStack.length === 0;
      currentNodeId = ans.next;
      renderNode();
    });
    els.answersContainer.appendChild(btn);
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

function showOutcome(outcomeText) {
  document.getElementById("questionContainer").style.display = "none";
  els.outcomeContainer.style.display = "block";

  const html = document.createElement("div");
  html.innerHTML = `
    <p style="margin:0 0 10px 0;"><strong>Outcome / next action:</strong><br>${escapeHtml(outcomeText)}</p>

    <div class="field">
      <label>Working differential</label>
      <textarea id="fieldDx" placeholder="Short list"></textarea>
    </div>
    <div class="field">
      <label>Key positives / negatives</label>
      <textarea id="fieldHP" placeholder="Key features"></textarea>
    </div>
    <div class="field">
      <label>Examination summary</label>
      <textarea id="fieldExam" placeholder="Focused exam summary"></textarea>
    </div>
    <div class="field">
      <label>Plan / advice</label>
      <textarea id="fieldPlan" placeholder="Investigations, treatment, follow-up, safety-net"></textarea>
    </div>
  `;
  els.outcomeContent.innerHTML = "";
  els.outcomeContent.appendChild(html);

  els.copyESRBtn.onclick = () => copySummary(outcomeText);
  els.restartFromOutcome.onclick = () => restartWizard();
}

function copySummary(outcomeText) {
  const title = currentAlg?.title || currentAlgMeta?.title || "Algorithm";
  const stamp = new Date().toISOString().replace("T"," ").slice(0,16);

  const rfTicked = redFlagState[currentAlg.id] ? Array.from(redFlagState[currentAlg.id]) : [];
  const pathway = historyStack.map((h, i) => `${i+1}. ${h.answerText}`).filter(Boolean);

  const dx = document.getElementById("fieldDx")?.value?.trim() || "";
  const hp = document.getElementById("fieldHP")?.value?.trim() || "";
  const exam = document.getElementById("fieldExam")?.value?.trim() || "";
  const plan = document.getElementById("fieldPlan")?.value?.trim() || "";

  const text = [
    `Eye ED Algorithm: ${title}`,
    `Time: ${stamp}`,
    ``,
    `Red flags identified:`,
    rfTicked.length ? rfTicked.map(x => `- ${x}`).join("\n") : `- None ticked`,
    ``,
    `Pathway selections:`,
    pathway.length ? pathway.map(x => `- ${x}`).join("\n") : `- (none)`,
    ``,
    `Working differential:`,
    dx ? dx : "(not recorded)",
    ``,
    `Key positives / negatives:`,
    hp ? hp : "(not recorded)",
    ``,
    `Examination summary:`,
    exam ? exam : "(not recorded)",
    ``,
    `Plan / advice:`,
    plan ? plan : "(not recorded)",
    ``,
    `Outcome / next action:`,
    outcomeText || "(none)",
    ``,
    `Disclaimer: Reference aid only. Follow local guidance and escalate red flags.`
  ].join("\n");

  navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard"))
    .catch(() => {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove();
      showToast("Copied to clipboard");
    });
}

function restartWizard() {
  if (!currentAlg) return;
  historyStack = [];
  els.undoBtn.disabled = true;
  currentNodeId = currentAlg.algorithm?.start || "q1";
  renderNode();
}

async function openAlgorithm(meta) {
  currentAlgMeta = meta;
  showLoading(true);

  try {
    const resp = await fetch(meta.path, {cache:"no-cache"});
    if (!resp.ok) throw new Error("Failed to load JSON");
    const alg = await resp.json();

    if (!alg.algorithm || !alg.algorithm.nodes) throw new Error("Invalid JSON schema");
    currentAlg = alg;

    els.wizardTitle.textContent = meta.title;
    updateFavIcon();
    pushRecent(meta.id);
    renderHome(els.searchInput.value || "");

    renderRedFlagsPanel();
    historyStack = [];
    els.undoBtn.disabled = true;
    currentNodeId = alg.algorithm.start || "q1";

    setScreen("wizard");
    renderNode();
  } catch (e) {
    console.error(e);
    showToast("Could not load algorithm. Check JSON file.");
  } finally {
    showLoading(false);
  }
}

function wireEvents() {
  els.backToHome.addEventListener("click", () => setScreen("home"));

  els.searchToggle.addEventListener("click", () => {
    els.searchContainer.classList.toggle("active");
    if (els.searchContainer.classList.contains("active")) els.searchInput.focus();
  });

  const doSearch = () => renderHome(els.searchInput.value || "");
  els.searchBtn.addEventListener("click", doSearch);
  els.searchInput.addEventListener("input", doSearch);

  els.toggleRedFlags.addEventListener("click", () => els.redFlagsSection.classList.toggle("active"));
  els.collapseRedFlags.addEventListener("click", () => els.redFlagsSection.classList.remove("active"));

  els.toggleFavourite.addEventListener("click", () => { if (currentAlgMeta) toggleFavourite(currentAlgMeta.id); });

  els.undoBtn.addEventListener("click", () => {
    if (!historyStack.length) return;
    const prev = historyStack.pop();
    els.undoBtn.disabled = historyStack.length === 0;
    currentNodeId = prev.nodeId;
    renderNode();
  });

  els.restartBtn.addEventListener("click", restartWizard);
}

async function init() {
  wireEvents();
  showLoading(true);
  try {
    const resp = await fetch("./data/index.json", {cache:"no-cache"});
    const data = await resp.json();
    catalogue = (data.algorithms || []).sort((a,b) => (a.order||0)-(b.order||0));
    renderHome();
  } catch (e) {
    console.error(e);
    els.algorithmsList.innerHTML = `<div class="empty-state"><p>Could not load catalogue (data/index.json).</p></div>`;
  } finally {
    showLoading(false);
  }
}

init();
