const state = {
  presets: [],
  config: null,
  activeSite: null,
  platform: "win32",
  deepHookAvailable: false
};

const elements = {
  activeSite: document.getElementById("activeSite"),
  customSiteName: document.getElementById("customSiteName"),
  customSiteUrl: document.getElementById("customSiteUrl"),
  hotkey: document.getElementById("hotkey"),
  hotkeyCapture: document.getElementById("hotkeyCapture"),
  deepHookEnabled: document.getElementById("deepHookEnabled"),
  deepHookStatus: document.getElementById("deepHookStatus"),
  hotkeyStatus: document.getElementById("hotkeyStatus"),
  overlayWidth: document.getElementById("overlayWidth"),
  overlayHeight: document.getElementById("overlayHeight"),
  opacity: document.getElementById("opacity"),
  autoDismiss: document.getElementById("autoDismiss"),
  autoDismissValue: document.getElementById("autoDismissValue"),
  dismissOnBlur: document.getElementById("dismissOnBlur"),
  pinMode: document.getElementById("pinMode"),
  selectionAssistEnabled: document.getElementById("selectionAssistEnabled"),
  selectionAssistHotkey: document.getElementById("selectionAssistHotkey"),
  matchSystemTheme: document.getElementById("matchSystemTheme"),
  forceTheme: document.getElementById("forceTheme"),
  siteStatus: document.getElementById("siteStatus"),
  formStatus: document.getElementById("formStatus"),
  toggleOverlay: document.getElementById("toggleOverlay"),
  reloadSite: document.getElementById("reloadSite"),
  saveCustomSite: document.getElementById("saveCustomSite"),
  resetSession: document.getElementById("resetSession"),
  resetOverlayPosition: document.getElementById("resetOverlayPosition")
};

function render() {
  const { presets, config, activeSite, deepHookAvailable } = state;
  if (!config) {
    return;
  }

  const customOptions = config.customSites.map((site) => ({ id: site.id, name: `${site.name} (Custom)` }));
  const allOptions = [...presets.map((site) => ({ id: site.id, name: site.name })), ...customOptions];
  elements.activeSite.innerHTML = allOptions
    .map((site) => `<option value="${site.id}">${site.name}</option>`)
    .join("");

  elements.activeSite.value = config.activeSiteId;
  if (!hotkeyCaptureActive) {
    elements.hotkey.value = config.hotkey;
  }
  elements.deepHookEnabled.checked = config.deepHookEnabled;
  elements.overlayWidth.value = config.windowBounds.width;
  elements.overlayHeight.value = config.windowBounds.height;
  elements.opacity.value = config.opacity;
  elements.autoDismiss.value = config.autoDismissSeconds;
  elements.autoDismissValue.textContent =
    config.autoDismissSeconds === 0 ? "Disabled" : `${config.autoDismissSeconds}s`;
  elements.dismissOnBlur.checked = config.dismissOnBlur;
  elements.pinMode.checked = config.pinMode;
  elements.selectionAssistEnabled.checked = config.selectionAssistEnabled;
  elements.selectionAssistHotkey.value = config.selectionAssistHotkey;
  elements.matchSystemTheme.checked = config.matchSystemTheme;
  elements.forceTheme.value = config.forceTheme;
  elements.siteStatus.textContent = activeSite ? `Active: ${activeSite.name} - ${activeSite.url}` : "";
  elements.hotkeyStatus.textContent = state.hotkeyError || "";

  if (state.platform !== "win32") {
    elements.deepHookEnabled.disabled = true;
    elements.deepHookStatus.textContent = "Deep Hook mode is only supported on Windows.";
  } else if (!deepHookAvailable) {
    elements.deepHookEnabled.disabled = true;
    elements.deepHookStatus.textContent =
      "Windows helper not built yet. Run `npm run build:hook` to enable the exclusive fullscreen hook.";
  } else {
    elements.deepHookEnabled.disabled = false;
    elements.deepHookStatus.textContent =
      state.deepHookError ||
      "Uses a low-level keyboard hook for exclusive fullscreen games. Some anti-cheat tools may object.";
  }
}

function setFormStatus(text) {
  elements.formStatus.textContent = text || "";
}

function normalizeUrl(input) {
  const raw = input.trim();
  if (!raw) {
    return "";
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }
  return `https://${raw}`;
}

function deriveNameFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return "Custom AI";
  }
}

async function saveCustomSiteFromInputs() {
  const rawName = elements.customSiteName.value.trim();
  const normalizedUrl = normalizeUrl(elements.customSiteUrl.value);
  if (!normalizedUrl) {
    setFormStatus("Paste a website URL first.");
    return;
  }

  let parsed;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    setFormStatus("URL looks invalid. Example: https://example.com/chat");
    return;
  }

  if (!/^https?:$/i.test(parsed.protocol)) {
    setFormStatus("Only http/https URLs are supported.");
    return;
  }

  const name = rawName || deriveNameFromUrl(parsed.href);
  const id = `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const existing = state.config.customSites.filter((site) => site.id !== id);
  existing.push({
    id,
    name,
    url: parsed.href,
    focusSelector: "textarea, input[type='text'], div[contenteditable='true']",
    css: "header, nav, aside, footer{display:none !important;} main{max-width:100% !important;}"
  });

  await update({
    customSites: existing,
    activeSiteId: id
  });
  setFormStatus(`Saved and activated: ${name}`);
  elements.customSiteName.value = "";
  elements.customSiteUrl.value = "";
}

let hotkeyCaptureActive = false;

function resolveMainKeyFromKeyboardEvent(event) {
  const { code, key } = event;
  if (/^Key([A-Z])$/.test(code)) {
    return code.slice(3);
  }
  if (/^Digit(\d)$/.test(code)) {
    return code.slice(5);
  }
  if (/^F([1-9]|1[0-9]|2[0-4])$/i.test(code)) {
    return code;
  }

  const byCode = {
    Space: "Space",
    Tab: "Tab",
    Minus: "Minus",
    Equal: "Equal",
    BracketLeft: "BracketLeft",
    BracketRight: "BracketRight",
    Backslash: "Backslash",
    Semicolon: "Semicolon",
    Quote: "Quote",
    Backquote: "Backquote",
    Comma: "Comma",
    Period: "Period",
    Slash: "Slash",
    IntlBackslash: "Backslash",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    ArrowUp: "Up",
    ArrowDown: "Down",
    Enter: "Enter",
    NumpadEnter: "Enter",
    Escape: "Escape",
    Backspace: "Backspace",
    Delete: "Delete",
    Insert: "Insert",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown"
  };
  if (byCode[code]) {
    return byCode[code];
  }

  if (key === "+") {
    return "Plus";
  }
  if (key && key.length === 1) {
    const upper = key.toUpperCase();
    if (/[A-Z0-9]/.test(upper)) {
      return upper;
    }
  }
  return null;
}

function buildAcceleratorFromKeyboardEvent(event) {
  if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
    return null;
  }

  const main = resolveMainKeyFromKeyboardEvent(event);
  if (!main) {
    return null;
  }

  const parts = [];
  if (event.ctrlKey || event.metaKey) {
    parts.push("CommandOrControl");
  }
  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey) {
    parts.push("Shift");
  }

  return [...parts, main].join("+");
}

function acceleratorLooksReasonable(accelerator) {
  const segments = accelerator.split("+").map((s) => s.trim()).filter(Boolean);
  if (segments.length < 1) {
    return false;
  }
  const main = segments[segments.length - 1];
  const hasModifier = segments.some((p) =>
    /^(CommandOrControl|Command|Cmd|Control|Ctrl|Alt|Option|Shift|Super)$/i.test(p)
  );
  const isFKey = /^F([1-9]|1[0-9]|2[0-4])$/i.test(main);
  return isFKey || hasModifier;
}

function stopHotkeyCapture() {
  if (!hotkeyCaptureActive) {
    return;
  }
  hotkeyCaptureActive = false;
  elements.hotkeyCapture.textContent = "Press keys...";
  elements.hotkeyCapture.classList.remove("active");
  window.removeEventListener("keydown", onHotkeyCaptureKeydown, true);
  elements.hotkeyStatus.textContent = state.hotkeyError || "";
}

function onHotkeyCaptureKeydown(event) {
  event.preventDefault();
  event.stopPropagation();

  if (event.repeat) {
    return;
  }

  if (event.key === "Escape") {
    stopHotkeyCapture();
    return;
  }

  const accelerator = buildAcceleratorFromKeyboardEvent(event);
  if (!accelerator) {
    return;
  }

  if (!acceleratorLooksReasonable(accelerator)) {
    elements.hotkeyStatus.textContent = "Use Ctrl, Alt, and/or Shift (or an F-key alone).";
    return;
  }

  elements.hotkeyStatus.textContent = "";
  elements.hotkey.value = accelerator;
  stopHotkeyCapture();
  update({ hotkey: accelerator });
}

function startHotkeyCapture() {
  if (hotkeyCaptureActive) {
    stopHotkeyCapture();
    return;
  }
  hotkeyCaptureActive = true;
  elements.hotkeyCapture.textContent = "Listening...";
  elements.hotkeyCapture.classList.add("active");
  elements.hotkeyStatus.textContent = "";
  window.addEventListener("keydown", onHotkeyCaptureKeydown, true);
}

async function refresh() {
  const payload = await window.quickAI.loadSettings();
  Object.assign(state, payload);
  render();
}

async function update(patch) {
  const payload = await window.quickAI.updateSettings(patch);
  Object.assign(state, payload);
  render();
}

elements.toggleOverlay.addEventListener("click", () => window.quickAI.toggleOverlay());
elements.reloadSite.addEventListener("click", () => window.quickAI.reloadSite());
elements.resetSession.addEventListener("click", () => window.quickAI.resetSession());
elements.resetOverlayPosition.addEventListener("click", async () => {
  await update({
    windowBounds: {
      x: 120,
      y: 120,
      width: 450,
      height: 550
    }
  });
  setFormStatus("Overlay position reset. Click Toggle Overlay.");
});

elements.activeSite.addEventListener("change", (event) => update({ activeSiteId: event.target.value }));
elements.hotkey.addEventListener("change", (event) => update({ hotkey: event.target.value.trim() }));
elements.hotkeyCapture.addEventListener("click", () => startHotkeyCapture());
elements.deepHookEnabled.addEventListener("change", (event) => update({ deepHookEnabled: event.target.checked }));
elements.overlayWidth.addEventListener("change", (event) =>
  update({ windowBounds: { width: Number(event.target.value) || 450 } })
);
elements.overlayHeight.addEventListener("change", (event) =>
  update({ windowBounds: { height: Number(event.target.value) || 550 } })
);
elements.opacity.addEventListener("input", (event) => update({ opacity: Number(event.target.value) || 1 }));
elements.autoDismiss.addEventListener("input", (event) =>
  update({ autoDismissSeconds: Number(event.target.value) || 0 })
);
elements.dismissOnBlur.addEventListener("change", (event) => update({ dismissOnBlur: event.target.checked }));
elements.pinMode.addEventListener("change", (event) => update({ pinMode: event.target.checked }));
elements.selectionAssistEnabled.addEventListener("change", (event) =>
  update({ selectionAssistEnabled: event.target.checked })
);
elements.selectionAssistHotkey.addEventListener("change", (event) =>
  update({ selectionAssistHotkey: event.target.value.trim() })
);
elements.matchSystemTheme.addEventListener("change", (event) =>
  update({ matchSystemTheme: event.target.checked })
);
elements.forceTheme.addEventListener("change", (event) => update({ forceTheme: event.target.value }));

elements.saveCustomSite.addEventListener("click", () => saveCustomSiteFromInputs());
elements.customSiteUrl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveCustomSiteFromInputs();
  }
});
elements.customSiteName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    saveCustomSiteFromInputs();
  }
});

window.quickAI.onConfig((payload) => {
  Object.assign(state, payload);
  render();
});

window.quickAI.onSiteStatus((payload) => {
  elements.siteStatus.textContent = `${payload.title || "Current site"} - ${payload.url}`;
});

refresh();
