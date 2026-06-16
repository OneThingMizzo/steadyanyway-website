const toggle = document.querySelector(".menu-toggle");
const form = document.querySelector("#contactForm");
const storeKey = "steady-anyway-site-editor-v2";
const pageId = location.pathname.split("/").pop() || "index.html";
const podcastConfig = window.STEADY_PODCAST_CONFIG;
const communityConfig = window.STEADY_COMMUNITY_CONFIG;
const homepageConfig = window.STEADY_HOMEPAGE_CONFIG;

const textSelector = [
  "h1",
  "h2",
  "h3",
  "p",
  "a",
  "span",
  "label",
  ".field-label",
  ".btn-label",
].join(",");

let selectedElement = null;
let editorShell = null;
let controls = {};

const getStore = () => JSON.parse(localStorage.getItem(storeKey) || "{}");
const setStore = (store) => localStorage.setItem(storeKey, JSON.stringify(store));
const pageStoreKey = (id) => `${pageId}:${id}`;

function youtubeEmbed(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  if (/^[A-Za-z0-9_-]{11}$/.test(source)) return `https://www.youtube.com/embed/${source}`;

  const match = source.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match ? `https://www.youtube.com/embed/${match[1]}` : "";
}

function normalizeMediaSource(source) {
  return youtubeEmbed(source) || source;
}

function configureHomepageVideo() {
  const target = document.querySelector('[data-edit-media="homepage-video"]');
  const embedUrl = youtubeEmbed(homepageConfig?.featuredYouTubeVideo);
  if (!target || !embedUrl) return;

  const iframe = document.createElement("iframe");
  iframe.src = embedUrl;
  iframe.title = "Steady Anyway featured YouTube video";
  iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  iframe.referrerPolicy = "strict-origin-when-cross-origin";
  iframe.allowFullscreen = true;
  target.replaceChildren(iframe);
}

function spotifyEmbedUrl(value) {
  const source = String(value || "").trim();
  if (!source) return "";
  const iframeMatch = source.match(/src=["']([^"']+)["']/i);
  const candidate = iframeMatch ? iframeMatch[1] : source;

  try {
    const url = new URL(candidate);
    const isSpotifyEmbed = url.hostname === "open.spotify.com" && url.pathname.startsWith("/embed/");
    return isSpotifyEmbed ? url.href : "";
  } catch {
    return "";
  }
}

function configurePodcastPlayer() {
  const target = document.querySelector("[data-podcast-player]");
  const configuredValue = podcastConfig?.player?.spotifyEmbed;
  if (!target || !configuredValue) return;

  const embedUrl = spotifyEmbedUrl(configuredValue);
  if (!embedUrl) {
    target.innerHTML = `
      <div class="podcast-player-placeholder">
        <h3>Spotify embed needs attention</h3>
        <p>Paste Spotify's complete embed iframe or an open.spotify.com/embed URL into podcast-config.js.</p>
      </div>
    `;
    return;
  }

  const iframe = document.createElement("iframe");
  iframe.src = embedUrl;
  iframe.title = "Steady Anyway podcast on Spotify";
  iframe.loading = "lazy";
  iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
  iframe.allowFullscreen = true;
  target.replaceChildren(iframe);
}

function configurePodcastPage() {
  if (!podcastConfig) return;

  const latestTarget = document.querySelector(".latest-podcast-video");
  const latestUrl = podcastConfig.latestVideoUrl || podcastConfig.videosUrl || podcastConfig.channelUrl;

  if (latestTarget && latestUrl) latestTarget.href = latestUrl;

  const library = document.querySelector("[data-episode-library]");
  if (!library) return;

  const episodes = Array.isArray(podcastConfig.episodes) ? podcastConfig.episodes : [];

  if (!episodes.length) {
    library.innerHTML = `
      <article class="episode empty-episode">
        <span>Coming Soon</span>
        <h2>Episodes will appear here.</h2>
        <p>Add podcast videos to podcast-config.js when they are live on YouTube.</p>
        <a class="text-link" href="${podcastConfig.channelUrl}" target="_blank" rel="noreferrer">Open podcast channel</a>
      </article>
    `;
    return;
  }

  library.innerHTML = episodes
    .map((episode) => {
      const videoUrl = episode.videoUrl || podcastConfig.channelUrl;
      const linkText = episode.videoUrl ? "Watch episode" : "Channel placeholder";
      return `
        <article class="episode">
          <span>${episode.number || "Episode"}</span>
          <h2>${episode.title || "Untitled episode"}</h2>
          <p>${episode.description || "Episode details can be added later."}</p>
          <a class="text-link" href="${videoUrl}" target="_blank" rel="noreferrer">${linkText}</a>
        </article>
      `;
    })
    .join("");
}

function saveLocalCommunitySignup(payload) {
  const store = getStore();
  const signups = Array.isArray(store.__communitySignups) ? store.__communitySignups : [];
  signups.push({
    ...payload,
    capturedAt: new Date().toISOString(),
  });
  store.__communitySignups = signups;
  setStore(store);
}

function setupCommunitySignup() {
  const signupForm = document.querySelector("#communitySignupForm");
  if (!signupForm) return;

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const note = signupForm.querySelector(".form-note");
    const data = new FormData(signupForm);
    const email = String(data.get("email") || "").trim();
    const name = String(data.get("name") || "").trim();

    if (!email) {
      note.textContent = "Enter an email address to join the community.";
      return;
    }

    const payload = {
      name,
      email,
      source: "steady-anyway-community-page",
      newsletterSchedule: communityConfig?.newsletterSchedule || "weekly-sunday",
      discordInviteRequested: communityConfig?.discordInviteEnabled !== false,
      welcomeEmail: communityConfig?.welcomeEmail || null,
    };

    const endpoint = communityConfig?.signupEndpoint;
    note.textContent = "Adding you to the community...";

    if (!endpoint) {
      saveLocalCommunitySignup(payload);
      note.textContent = "Signup saved locally. Add a signup endpoint in community-config.js to send the Sunday newsletter and Discord invite email.";
      signupForm.reset();
      return;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error(`Signup failed with status ${response.status}`);

      note.textContent = "You are on the list. Check your email for the Discord invitation and Sunday newsletter.";
      signupForm.reset();
    } catch (error) {
      note.textContent = "The signup connection is not responding yet. Check community-config.js or try again later.";
      console.error(error);
    }
  });
}

function assignEditorIds() {
  const editableElements = [
    ...document.querySelectorAll(
      "header a, nav a, main section, main article, main aside, main div, main h1, main h2, main h3, main p, main a, main span, main img, main video, main iframe, main form, main label, main input, main textarea, main button"
    ),
  ].filter((node) => !node.closest(".site-editor-panel"));

  editableElements.forEach((node, index) => {
    if (!node.dataset.editorId) node.dataset.editorId = `el-${index}`;
  });
}

function applyStoredEdits() {
  const store = getStore();
  const pageData = store[pageId] || {};

  Object.entries(pageData.elements || {}).forEach(([id, data]) => {
    const node = document.querySelector(`[data-editor-id="${id}"]`);
    if (!node) return;

    if (data.html && isTextEditable(node)) node.innerHTML = data.html;
    if (data.href && node.matches("a")) node.href = data.href;
    if (data.media) applyMedia(node, data.media, false);

    Object.entries(data.styles || {}).forEach(([property, value]) => {
      if (value) node.style[property] = value;
    });
  });

  Object.entries(pageData.theme || {}).forEach(([property, value]) => {
    if (value) document.documentElement.style.setProperty(property, value);
  });
}

function saveElementData(node, updater) {
  if (!node || !node.dataset.editorId) return;
  const store = getStore();
  const pageData = store[pageId] || {};
  pageData.elements = pageData.elements || {};
  const data = pageData.elements[node.dataset.editorId] || {};
  updater(data);
  pageData.elements[node.dataset.editorId] = data;
  store[pageId] = pageData;
  setStore(store);
}

function saveThemeValue(property, value) {
  const store = getStore();
  const pageData = store[pageId] || {};
  pageData.theme = pageData.theme || {};
  pageData.theme[property] = value;
  store[pageId] = pageData;
  setStore(store);
}

function isTextEditable(node) {
  if (!node) return false;
  if (node.matches("img, video, iframe, input, textarea, svg, path")) return false;
  return node.matches(textSelector) || [...node.childNodes].some((child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim());
}

function textEditTarget(node) {
  if (!node) return null;
  return node.querySelector(".btn-label") || node;
}

function getTargetElement(rawTarget) {
  if (!rawTarget || rawTarget.closest(".site-editor-panel")) return null;
  const target = rawTarget.closest("[data-editor-id]");
  if (!target || target.matches("svg, path")) return null;
  return target;
}

function setEditing(isEditing) {
  document.body.classList.toggle("editing", isEditing);
  document.querySelectorAll("[contenteditable]").forEach((node) => {
    node.removeAttribute("contenteditable");
    node.removeAttribute("spellcheck");
  });

  if (!isEditing) {
    selectElement(null);
    return;
  }

  document.querySelectorAll("[data-editor-id]").forEach((node) => {
    if (isTextEditable(node)) {
      node.setAttribute("contenteditable", "true");
      node.setAttribute("spellcheck", "true");
    }
  });
}

function selectElement(node) {
  if (selectedElement) selectedElement.classList.remove("editor-selected");
  selectedElement = node;
  if (selectedElement) selectedElement.classList.add("editor-selected");
  syncControls();
}

function selectedLink() {
  if (!selectedElement) return null;
  return selectedElement.matches("a") ? selectedElement : selectedElement.closest("a");
}

function selectedMedia() {
  if (!selectedElement) return null;
  if (selectedElement.matches("img, video, iframe")) return selectedElement;
  return selectedElement.querySelector("img, video, iframe");
}

function mediaKind(source) {
  if (youtubeEmbed(source)) return "iframe";
  if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(source) || source.startsWith("data:video/")) return "video";
  return "img";
}

function applyMedia(node, source, persist = true) {
  if (!node || !source) return;
  const existing = selectedMediaForNode(node);
  const kind = mediaKind(source);
  let target = existing;

  if (!target || !target.matches(kind)) {
    target = document.createElement(kind);
    if (kind === "iframe") {
      target.title = "Embedded video";
      target.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      target.allowFullscreen = true;
    }
    if (kind === "video") {
      target.controls = true;
      target.playsInline = true;
    }
    if (kind === "img") {
      target.alt = "";
      target.setAttribute("aria-hidden", "true");
    }
    if (node.matches("img, video, iframe")) node.replaceWith(target);
    else node.replaceChildren(target);
    target.dataset.editorId = node.dataset.editorId;
  }

  target.src = normalizeMediaSource(source);

  if (persist) {
    saveElementData(node, (data) => {
      data.media = source;
    });
  }
}

function selectedMediaForNode(node) {
  if (!node) return null;
  if (node.matches("img, video, iframe")) return node;
  return node.querySelector("img, video, iframe");
}

function controlValue(name, fallback = "") {
  return controls[name] ? controls[name].value : fallback;
}

function setControl(name, value) {
  if (controls[name]) controls[name].value = value || "";
}

function computedNumber(node, property) {
  const value = getComputedStyle(node)[property];
  return value && value !== "auto" ? parseFloat(value).toString() : "";
}

function syncControls() {
  if (!editorShell) return;
  const hasSelection = Boolean(selectedElement);
  editorShell.classList.toggle("has-selection", hasSelection);
  const title = editorShell.querySelector("[data-selected-title]");
  title.textContent = hasSelection
    ? `${selectedElement.tagName.toLowerCase()}${selectedElement.className ? `.${String(selectedElement.className).split(" ")[0]}` : ""}`
    : "Nothing selected";

  if (!hasSelection) return;

  const styles = getComputedStyle(selectedElement);
  const link = selectedLink();
  const media = selectedMedia();

  const textNode = textEditTarget(selectedElement);
  setControl("text", isTextEditable(textNode) ? textNode.innerText : "");
  setControl("link", link ? link.getAttribute("href") || "" : "");
  setControl("mediaUrl", media ? media.getAttribute("src") || "" : "");
  setControl("fontFamily", styles.fontFamily.split(",")[0].replaceAll('"', ""));
  setControl("fontSize", computedNumber(selectedElement, "fontSize"));
  setControl("width", selectedElement.style.width || "");
  setControl("height", selectedElement.style.height || "");
  setControl("padding", selectedElement.style.padding || "");
  setControl("margin", selectedElement.style.margin || "");
  setControl("radius", computedNumber(selectedElement, "borderRadius"));
  setControl("borderWidth", computedNumber(selectedElement, "borderWidth"));
  setControl("textColor", rgbToHex(styles.color));
  setControl("bgColor", rgbToHex(styles.backgroundColor));
  setControl("borderColor", rgbToHex(styles.borderColor));
}

function rgbToHex(rgb) {
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return "#000000";
  return `#${match.slice(0, 3).map((part) => Number(part).toString(16).padStart(2, "0")).join("")}`;
}

function setStyle(property, value, unit = "") {
  if (!selectedElement) return;
  const finalValue = value ? `${value}${unit}` : "";
  selectedElement.style[property] = finalValue;
  saveElementData(selectedElement, (data) => {
    data.styles = data.styles || {};
    data.styles[property] = finalValue;
  });
}

function editorUiStore() {
  const store = getStore();
  store.__editorUi = store.__editorUi || {};
  return store;
}

function saveEditorUi(updater) {
  const store = editorUiStore();
  updater(store.__editorUi);
  setStore(store);
}

function setEditorCollapsed(panel, collapsed) {
  panel.classList.toggle("collapsed", collapsed);
  saveEditorUi((ui) => {
    ui.collapsed = collapsed;
  });
}

function clampEditorPosition(panel, left, top) {
  const rect = panel.getBoundingClientRect();
  const padding = 12;
  const maxLeft = Math.max(padding, window.innerWidth - rect.width - padding);
  const maxTop = Math.max(padding, window.innerHeight - rect.height - padding);
  return {
    left: Math.min(Math.max(padding, left), maxLeft),
    top: Math.min(Math.max(padding, top), maxTop),
  };
}

function placeEditor(panel, left, top) {
  const next = clampEditorPosition(panel, left, top);
  panel.style.left = `${next.left}px`;
  panel.style.top = `${next.top}px`;
  panel.style.right = "auto";
  panel.style.bottom = "auto";
  saveEditorUi((ui) => {
    ui.left = next.left;
    ui.top = next.top;
  });
}

function setupEditorWindow(panel) {
  const ui = getStore().__editorUi || {};
  const collapseButton = panel.querySelector("[data-collapse-editor]");
  const header = panel.querySelector(".editor-head");
  let drag = null;

  if (Number.isFinite(ui.left) && Number.isFinite(ui.top)) {
    requestAnimationFrame(() => placeEditor(panel, ui.left, ui.top));
  }

  if (ui.collapsed) {
    panel.classList.add("collapsed");
    collapseButton.textContent = "Expand";
  }

  header.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, input, select, textarea, a")) return;
    const rect = panel.getBoundingClientRect();
    drag = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
    panel.classList.add("dragging");
    header.setPointerCapture(event.pointerId);
  });

  header.addEventListener("pointermove", (event) => {
    if (!drag) return;
    placeEditor(panel, event.clientX - drag.offsetX, event.clientY - drag.offsetY);
  });

  header.addEventListener("pointerup", (event) => {
    if (!drag) return;
    drag = null;
    panel.classList.remove("dragging");
    header.releasePointerCapture(event.pointerId);
  });

  window.addEventListener("resize", () => {
    const rect = panel.getBoundingClientRect();
    placeEditor(panel, rect.left, rect.top);
  });
}

function buildEditor() {
  const panel = document.createElement("aside");
  panel.className = "site-editor-panel";
  panel.innerHTML = `
    <div class="editor-head">
      <strong>Site Editor</strong>
      <div class="editor-window-actions">
        <button type="button" data-collapse-editor>Collapse</button>
        <button type="button" data-edit-toggle>Edit site</button>
      </div>
    </div>
    <div class="editor-body">
      <div class="editor-actions">
        <button type="button" data-save>Save text</button>
        <button type="button" data-reset>Reset page</button>
      </div>

      <section class="editor-section">
        <h4>Theme</h4>
        <label>Gold <input type="color" data-theme-var="--yellow" value="#b99043" /></label>
        <label>Background <input type="color" data-theme-var="--bg" value="#050909" /></label>
        <label>Text <input type="color" data-theme-var="--text" value="#f2eee7" /></label>
        <label>Muted <input type="color" data-theme-var="--muted" value="#b9b3aa" /></label>
      </section>

      <section class="editor-section">
        <h4>Selected: <span data-selected-title>Nothing selected</span></h4>
        <label>Text <textarea data-control="text" rows="3"></textarea></label>
        <label>Destination URL <input type="url" data-control="link" placeholder="https://..." /></label>
        <label>Media URL <input type="url" data-control="mediaUrl" placeholder="YouTube, image, or video URL" /></label>
        <label>Replace Media <input type="file" data-control="mediaFile" accept="image/*,video/mp4,video/webm,video/ogg" /></label>
      </section>

      <section class="editor-section">
        <h4>Type & Size</h4>
        <label>Font
          <select data-control="fontFamily">
            <option value="">Keep current</option>
            <option value="'Cormorant Garamond', Georgia, serif">Cormorant Garamond</option>
            <option value="'Montserrat', Arial, sans-serif">Montserrat</option>
            <option value="Arial, Helvetica, sans-serif">Arial</option>
            <option value="Georgia, serif">Georgia</option>
          </select>
        </label>
        <label>Font size <input type="number" data-control="fontSize" min="8" max="180" /></label>
        <label>Width <input type="text" data-control="width" placeholder="auto, 320px, 60%" /></label>
        <label>Height <input type="text" data-control="height" placeholder="auto, 240px, 50vh" /></label>
      </section>

      <section class="editor-section">
        <h4>Color & Box</h4>
        <label>Text color <input type="color" data-control="textColor" /></label>
        <label>Background <input type="color" data-control="bgColor" /></label>
        <label>Border color <input type="color" data-control="borderColor" /></label>
        <label>Padding <input type="text" data-control="padding" placeholder="1rem or 12px 16px" /></label>
        <label>Margin <input type="text" data-control="margin" placeholder="1rem or 12px 16px" /></label>
        <label>Radius <input type="number" data-control="radius" min="0" max="80" /></label>
        <label>Border width <input type="number" data-control="borderWidth" min="0" max="20" /></label>
      </section>

      <p class="editor-help">Turn on Edit site, then click anything on the page. Changes save in this browser.</p>
    </div>
  `;
  document.body.append(panel);
  editorShell = panel;
  setupEditorWindow(panel);

  panel.querySelectorAll("[data-control]").forEach((control) => {
    controls[control.dataset.control] = control;
  });

  panel.querySelector("[data-edit-toggle]").addEventListener("click", (event) => {
    const isEditing = !document.body.classList.contains("editing");
    setEditing(isEditing);
    event.currentTarget.classList.toggle("active", isEditing);
    event.currentTarget.textContent = isEditing ? "Done" : "Edit site";
  });

  panel.querySelector("[data-collapse-editor]").addEventListener("click", (event) => {
    const collapsed = !panel.classList.contains("collapsed");
    setEditorCollapsed(panel, collapsed);
    event.currentTarget.textContent = collapsed ? "Expand" : "Collapse";
  });

  panel.querySelector("[data-save]").addEventListener("click", saveAllText);
  panel.querySelector("[data-reset]").addEventListener("click", resetPage);

  panel.querySelectorAll("[data-theme-var]").forEach((input) => {
    const saved = (getStore()[pageId]?.theme || {})[input.dataset.themeVar];
    if (saved) input.value = saved;
    input.addEventListener("input", () => {
      document.documentElement.style.setProperty(input.dataset.themeVar, input.value);
      saveThemeValue(input.dataset.themeVar, input.value);
    });
  });

  controls.text.addEventListener("input", () => {
    const textNode = textEditTarget(selectedElement);
    if (!textNode || !isTextEditable(textNode)) return;
    textNode.innerText = controls.text.value;
    saveElementData(textNode, (data) => {
      data.html = textNode.innerHTML;
    });
  });

  controls.link.addEventListener("input", () => {
    const link = selectedLink();
    if (!link) return;
    link.href = controls.link.value;
    saveElementData(link, (data) => {
      data.href = controls.link.value;
    });
  });

  controls.mediaUrl.addEventListener("change", () => {
    if (!selectedElement) return;
    applyMedia(selectedElement, controls.mediaUrl.value);
  });

  controls.mediaFile.addEventListener("change", () => {
    const file = controls.mediaFile.files && controls.mediaFile.files[0];
    if (!file || !selectedElement) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      applyMedia(selectedElement, reader.result);
      controls.mediaFile.value = "";
    });
    reader.readAsDataURL(file);
  });

  controls.fontFamily.addEventListener("change", () => setStyle("fontFamily", controls.fontFamily.value));
  controls.fontSize.addEventListener("input", () => setStyle("fontSize", controls.fontSize.value, "px"));
  controls.width.addEventListener("input", () => setStyle("width", controls.width.value));
  controls.height.addEventListener("input", () => setStyle("height", controls.height.value));
  controls.padding.addEventListener("input", () => setStyle("padding", controls.padding.value));
  controls.margin.addEventListener("input", () => setStyle("margin", controls.margin.value));
  controls.radius.addEventListener("input", () => setStyle("borderRadius", controls.radius.value, "px"));
  controls.borderWidth.addEventListener("input", () => setStyle("borderWidth", controls.borderWidth.value, "px"));
  controls.textColor.addEventListener("input", () => setStyle("color", controls.textColor.value));
  controls.bgColor.addEventListener("input", () => setStyle("backgroundColor", controls.bgColor.value));
  controls.borderColor.addEventListener("input", () => setStyle("borderColor", controls.borderColor.value));
}

function saveAllText() {
  document.querySelectorAll("[data-editor-id]").forEach((node) => {
    if (!isTextEditable(node)) return;
    saveElementData(node, (data) => {
      data.html = node.innerHTML;
    });
  });
}

function resetPage() {
  const store = getStore();
  delete store[pageId];
  setStore(store);
  location.reload();
}

document.addEventListener("click", (event) => {
  if (!document.body.classList.contains("editing")) return;
  if (event.target.closest(".site-editor-panel")) return;
  event.preventDefault();
  event.stopPropagation();
  const target = getTargetElement(event.target);
  if (target) selectElement(target);
}, true);

document.addEventListener("input", (event) => {
  const node = event.target.closest("[data-editor-id]");
  if (!node || !document.body.classList.contains("editing")) return;
  if (isTextEditable(node)) {
    saveElementData(node, (data) => {
      data.html = node.innerHTML;
    });
  }
});

if (toggle) {
  toggle.addEventListener("click", () => {
    const isOpen = document.body.classList.toggle("nav-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const note = form.querySelector(".form-note");
    note.textContent = "Thanks. Your message is ready for the next connection step.";
    form.reset();
  });
}

configureHomepageVideo();
configurePodcastPage();
configurePodcastPlayer();
setupCommunitySignup();
assignEditorIds();
applyStoredEdits();
buildEditor();
