const path = require("node:path");
const {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  globalShortcut,
  nativeTheme,
  screen,
  shell,
  clipboard
} = require("electron");

const { ConfigStore, defaultConfig } = require("./store");
const { getPreset, listPresets } = require("./presets");
const { DeepHookManager } = require("./deepHook");

const store = new ConfigStore();
const deepHook = new DeepHookManager();

let settingsWindow = null;
let overlayWindow = null;
let overlayView = null;
let overlayVisible = false;
let autoDismissTimer = null;
let hotkeyError = "";
let deepHookError = "";

function getSiteConfig(config = store.get()) {
  const preset = getPreset(config.activeSiteId);
  const custom = config.customSites.find((site) => site.id === config.activeSiteId);
  const site = custom || preset || listPresets()[0];
  const partition = config.siteSessions[site.id] || `persist:overlayai:${site.id}`;
  return { ...site, partition };
}

function createSettingsWindow() {
  settingsWindow = new BrowserWindow({
    width: 920,
    height: 720,
    minWidth: 820,
    minHeight: 640,
    title: "OverlayAI Settings",
    backgroundColor: "#0b1020",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, "../renderer/settings.html"));
}

function createOverlayWindow() {
  const config = store.get();
  overlayWindow = new BrowserWindow({
    x: config.windowBounds.x,
    y: config.windowBounds.y,
    width: config.windowBounds.width,
    height: config.windowBounds.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: true,
    movable: true,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    autoHideMenuBar: true,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWindow.setVisibleOnAllWorkspaces(true, {
    visibleOnFullScreen: true
  });
  overlayWindow.setAlwaysOnTop(true, "screen-saver");
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  overlayWindow.setOpacity(0);

  overlayWindow.loadFile(path.join(__dirname, "../renderer/overlay-shell.html"));
  overlayWindow.on("blur", () => {
    const current = store.get();
    if (!current.pinMode && current.dismissOnBlur && overlayVisible) {
      hideOverlay();
    }
  });

  overlayWindow.on("move", persistOverlayBounds);
  overlayWindow.on("resize", () => {
    layoutOverlayView();
    persistOverlayBounds();
  });
  overlayWindow.webContents.on("before-input-event", (_event, input) => {
    if (input.key === "Escape" && overlayVisible) {
      hideOverlay();
    }
  });
}

function destroyOverlayWindow() {
  clearTimeout(autoDismissTimer);
  overlayVisible = false;

  if (overlayWindow && overlayView) {
    overlayWindow.removeBrowserView(overlayView);
    overlayView.webContents.destroy();
    overlayView = null;
  }

  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.destroy();
  }

  overlayWindow = null;
}

function createOverlayView() {
  const site = getSiteConfig();
  overlayView = new BrowserView({
    webPreferences: {
      partition: site.partition,
      contextIsolation: true,
      backgroundThrottling: false,
      sandbox: true
    }
  });

  overlayWindow.setBrowserView(overlayView);
  layoutOverlayView();

  if (site.userAgent) {
    overlayView.webContents.setUserAgent(site.userAgent);
  }

  overlayView.webContents.on("dom-ready", async () => {
    await injectSiteChrome(site);
    overlayWindow.webContents.send("site-status", {
      url: overlayView.webContents.getURL(),
      title: overlayView.webContents.getTitle()
    });
  });

  overlayView.webContents.on("did-navigate", async () => {
    await injectSiteChrome(site);
  });

  overlayView.webContents.on("before-input-event", (_event, input) => {
    if (input.key === "Escape" && overlayVisible) {
      hideOverlay();
    }
  });

  overlayView.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  overlayView.webContents.loadURL(site.url);
}

async function injectSiteChrome(site) {
  if (!overlayView || overlayView.webContents.isDestroyed()) {
    return;
  }

  if (site.css) {
    try {
      await overlayView.webContents.insertCSS(site.css);
    } catch (error) {
      console.error("Failed to inject CSS", error);
    }
  }

  const theme = resolveThemeScript();
  const focusScript = `
    (() => {
      ${theme}
      try {
        const sessionKey = "__overlayai_session_storage__";
        if (!window.__quickaiSessionRestored) {
          const raw = localStorage.getItem(sessionKey);
          if (raw) {
            const entries = JSON.parse(raw);
            for (const [key, value] of Object.entries(entries)) {
              sessionStorage.setItem(key, value);
            }
          }
          window.__quickaiSessionRestored = true;
          window.addEventListener("beforeunload", () => {
            const snapshot = {};
            for (let i = 0; i < sessionStorage.length; i += 1) {
              const key = sessionStorage.key(i);
              snapshot[key] = sessionStorage.getItem(key);
            }
            localStorage.setItem(sessionKey, JSON.stringify(snapshot));
          });
        }
      } catch (error) {
        console.debug("OverlayAI sessionStorage bridge skipped", error);
      }
      const selectors = ${JSON.stringify(
        [site.focusSelector, "textarea", "div[contenteditable='true']", "input[type='text']"].filter(Boolean)
      )};
      const candidates = selectors.flatMap((group) => group.split(",").map((item) => item.trim()));
      for (const selector of candidates) {
        const el = document.querySelector(selector);
        if (el) {
          el.focus();
          if (el.click) el.click();
          break;
        }
      }
    })();
  `;

  try {
    await overlayView.webContents.executeJavaScript(focusScript, true);
  } catch (error) {
    console.error("Failed to inject JS", error);
  }
}

async function insertTextIntoComposer(text) {
  if (!overlayView || overlayView.webContents.isDestroyed() || !text) {
    return false;
  }

  const escapedText = JSON.stringify(text);
  const script = [
    "(function() {",
    `  const text = ${escapedText};`,
    '  const selectors = ["textarea", "input[type=\'text\']", "div[contenteditable=\'true\']"];',
    "  const input = selectors.map((selector) => document.querySelector(selector)).find(Boolean);",
    "  if (!input) return false;",
    "  input.focus();",
    "  if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {",
    "    input.value = input.value ? input.value + '\\n\\n' + text : text;",
    "    input.dispatchEvent(new Event('input', { bubbles: true }));",
    "    return true;",
    "  }",
    "  if (input.isContentEditable) {",
    "    input.textContent = input.textContent ? input.textContent + '\\n\\n' + text : text;",
    "    input.dispatchEvent(new Event('input', { bubbles: true }));",
    "    return true;",
    "  }",
    "  return false;",
    "})();"
  ].join("\n");

  try {
    return Boolean(await overlayView.webContents.executeJavaScript(script, true));
  } catch (error) {
    console.error("Failed to insert clipboard text", error);
    return false;
  }
}

async function askAboutClipboardText() {
  const text = clipboard.readText().trim();
  if (!text) {
    return false;
  }

  showOverlay();
  const prompt = `Ask about this selected text:\n\n${text}`;
  return insertTextIntoComposer(prompt);
}

function resolveThemeScript() {
  const config = store.get();
  const theme = config.matchSystemTheme
    ? nativeTheme.shouldUseDarkColors
      ? "dark"
      : "light"
    : config.forceTheme;
  const background = theme === "dark" ? "#0b1020" : "#f6f7fb";
  return `
    document.documentElement.style.colorScheme = "${theme}";
    document.body && (document.body.style.background = "${background}");
  `;
}

function layoutOverlayView() {
  if (!overlayWindow || !overlayView) {
    return;
  }

  const bounds = overlayWindow.getBounds();
  overlayView.setBounds({
    x: 0,
    y: 28,
    width: bounds.width,
    height: Math.max(bounds.height - 28, 1)
  });
  overlayView.setAutoResize({
    width: true,
    height: true
  });
}

function persistOverlayBounds() {
  if (!overlayWindow) {
    return;
  }

  const bounds = overlayWindow.getBounds();
  store.set({
    windowBounds: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height
    }
  });
  broadcastConfig();
}

function fadeOverlay(targetVisible) {
  if (!overlayWindow) {
    return;
  }

  const start = overlayWindow.getOpacity();
  const end = targetVisible ? store.get().opacity : 0;
  const steps = 8;
  let count = 0;

  const interval = setInterval(() => {
    count += 1;
    const progress = count / steps;
    const next = start + (end - start) * progress;
    overlayWindow.setOpacity(Math.max(0, Math.min(next, 1)));
    if (count >= steps) {
      clearInterval(interval);
      if (!targetVisible) {
        overlayWindow.hide();
        overlayWindow.setIgnoreMouseEvents(true, { forward: true });
      }
    }
  }, 18);
}

function scheduleAutoDismiss() {
  clearTimeout(autoDismissTimer);
  const seconds = store.get().autoDismissSeconds;
  if (seconds > 0 && !store.get().pinMode) {
    autoDismissTimer = setTimeout(() => hideOverlay(), seconds * 1000);
  }
}

function showOverlay() {
  if (!overlayWindow) {
    return;
  }

  overlayVisible = true;
  overlayWindow.setIgnoreMouseEvents(false);
  overlayWindow.showInactive();
  overlayWindow.show();
  overlayWindow.focus();
  fadeOverlay(true);
  if (overlayView) {
    overlayView.webContents.focus();
    injectSiteChrome(getSiteConfig()).catch(() => {});
  }
  scheduleAutoDismiss();
}

function hideOverlay() {
  overlayVisible = false;
  clearTimeout(autoDismissTimer);
  fadeOverlay(false);
  deepHook.relaunchIfNeeded();
}

function toggleOverlay() {
  if (overlayVisible) {
    hideOverlay();
  } else {
    showOverlay();
  }
}

function registerGlobalHotkey() {
  globalShortcut.unregisterAll();
  const config = store.get();
  let hotkey = config.hotkey;
  if (typeof hotkey !== "string" || !hotkey.trim()) {
    hotkey = defaultConfig.hotkey;
    store.set({ hotkey });
  }

  function bind(accelerator, callback = toggleOverlay) {
    return globalShortcut.register(accelerator, () => {
      callback();
    });
  }

  let registered = false;
  try {
    registered = bind(hotkey);
    hotkeyError = registered ? "" : `Unable to register hotkey: ${hotkey}`;
  } catch (err) {
    const fallback = defaultConfig.hotkey;
    hotkeyError = `Invalid hotkey (${String(err.message)}). Reset to default.`;
    store.set({ hotkey: fallback });
    try {
      registered = bind(fallback);
      hotkeyError = registered ? "" : `Unable to register hotkey: ${fallback}`;
    } catch (err2) {
      hotkeyError = `Hotkey registration failed: ${String(err2.message)}`;
    }
  }

  if (store.get().selectionAssistEnabled) {
    const selectionHotkey = store.get().selectionAssistHotkey || defaultConfig.selectionAssistHotkey;
    try {
      bind(selectionHotkey, () => {
        askAboutClipboardText().catch((error) => console.error("Selection Assist failed", error));
      });
    } catch (error) {
      hotkeyError = `Selection Assist hotkey failed: ${String(error.message)}`;
    }
  }

  return registered;
}

function ensureOverlayOnScreen() {
  if (!overlayWindow) {
    return;
  }
  const display = screen.getDisplayMatching(store.get().windowBounds);
  if (!display) {
    return;
  }
  const area = display.workArea;
  const bounds = overlayWindow.getBounds();
  const x = Math.min(Math.max(bounds.x, area.x), area.x + area.width - bounds.width);
  const y = Math.min(Math.max(bounds.y, area.y), area.y + area.height - bounds.height);
  overlayWindow.setBounds({ ...bounds, x, y });
  store.set({
    windowBounds: {
      x,
      y,
      width: bounds.width,
      height: bounds.height
    }
  });
}

function broadcastConfig() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send("config", buildSettingsPayload());
  }
}

function buildSettingsPayload() {
  return {
    config: store.get(),
    presets: listPresets(),
    activeSite: getSiteConfig(),
    platform: process.platform,
    deepHookAvailable: deepHook.isAvailable(),
    hotkeyError,
    deepHookError
  };
}

async function rebuildOverlayView() {
  const currentSite = getSiteConfig();
  if (overlayWindow && overlayView) {
    overlayWindow.removeBrowserView(overlayView);
    overlayView.webContents.destroy();
    overlayView = null;
  }
  createOverlayView(currentSite);
  broadcastConfig();
}

async function resetCurrentSession() {
  const site = getSiteConfig();
  const partitionSession = require("electron").session.fromPartition(site.partition);
  await partitionSession.clearStorageData();
  await rebuildOverlayView();
}

async function resetOverlayPosition() {
  store.set({
    windowBounds: { ...defaultConfig.windowBounds },
    opacity: defaultConfig.opacity
  });

  destroyOverlayWindow();
  createOverlayWindow();
  createOverlayView();
  ensureOverlayOnScreen();
  broadcastConfig();
  return buildSettingsPayload();
}

function endAllOperations() {
  clearTimeout(autoDismissTimer);
  globalShortcut.unregisterAll();
  deepHook.disable();
  destroyOverlayWindow();

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }

  app.quit();
}

function wireIpc() {
  ipcMain.handle("settings:load", () => buildSettingsPayload());
  ipcMain.handle("overlay:toggle", () => {
    toggleOverlay();
    return { visible: overlayVisible };
  });
  ipcMain.handle("overlay:show", () => showOverlay());
  ipcMain.handle("overlay:hide", () => hideOverlay());
  ipcMain.handle("overlay:reset-position", () => resetOverlayPosition());
  ipcMain.handle("overlay:pin", (_event, pinned) => {
    store.set({ pinMode: Boolean(pinned) });
    broadcastConfig();
  });
  ipcMain.handle("app:end-all", () => endAllOperations());
  ipcMain.handle("site:reset-session", () => resetCurrentSession());
  ipcMain.handle("site:reload", () => overlayView?.webContents.reload());
  ipcMain.handle("settings:update", async (_event, patch) => {
    if (patch.deepHookEnabled !== undefined && patch.deepHookEnabled && !store.get().deepHookEnabled) {
      const allowed = await DeepHookManager.confirmEnable(settingsWindow);
      if (!allowed) {
        return buildSettingsPayload();
      }
    }

    const next = store.set(patch);
    registerGlobalHotkey();

    if (patch.activeSiteId || patch.customSites || patch.siteSessions) {
      await rebuildOverlayView();
    }

    if (patch.opacity !== undefined && overlayVisible) {
      overlayWindow.setOpacity(next.opacity);
    }

    if (patch.selectionAssistEnabled !== undefined || patch.selectionAssistHotkey !== undefined) {
      registerGlobalHotkey();
    }

    if (patch.deepHookEnabled !== undefined) {
      if (next.deepHookEnabled) {
        try {
          await deepHook.enable(next.hotkey);
          deepHookError = "";
        } catch (error) {
          deepHookError = error.message;
          store.set({ deepHookEnabled: false });
        }
      } else {
        deepHook.disable();
        deepHookError = "";
      }
    } else if (patch.hotkey && store.get().deepHookEnabled) {
      try {
        await deepHook.enable(next.hotkey);
        deepHookError = "";
      } catch (error) {
        deepHookError = error.message;
      }
    }

    if (patch.windowBounds && overlayWindow) {
      overlayWindow.setBounds({
        ...overlayWindow.getBounds(),
        ...patch.windowBounds
      });
      ensureOverlayOnScreen();
    }

    broadcastConfig();
    return buildSettingsPayload();
  });
}

app.whenReady().then(async () => {
  wireIpc();
  createSettingsWindow();
  createOverlayWindow();
  createOverlayView();
  registerGlobalHotkey();
  ensureOverlayOnScreen();

  deepHook.on("trigger", () => {
    showOverlay();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  deepHook.disable();
});
