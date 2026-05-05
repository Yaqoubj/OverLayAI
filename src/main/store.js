const fs = require("node:fs");
const path = require("node:path");
const { app } = require("electron");

const defaultConfig = {
  activeSiteId: "chatgpt",
  customSites: [],
  siteSessions: {},
  hotkey: "CommandOrControl+Space",
  selectionAssistHotkey: "CommandOrControl+Shift+Space",
  deepHookEnabled: false,
  windowBounds: {
    width: 450,
    height: 550,
    x: 120,
    y: 120
  },
  opacity: 1,
  autoDismissSeconds: 0,
  dismissOnBlur: true,
  dismissOnOutsideClick: true,
  pinMode: false,
  selectionAssistEnabled: false,
  matchSystemTheme: true,
  forceTheme: "dark",
  backgroundTint: "#0b1020"
};

class ConfigStore {
  constructor() {
    this.filePath = path.join(app.getPath("userData"), "quickai.config.json");
    this.config = this.load();
  }

  load() {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { ...defaultConfig };
      }

      const parsed = JSON.parse(fs.readFileSync(this.filePath, "utf8"));
      return {
        ...defaultConfig,
        ...parsed,
        windowBounds: {
          ...defaultConfig.windowBounds,
          ...(parsed.windowBounds || {})
        }
      };
    } catch (error) {
      console.error("Failed to load config, falling back to defaults", error);
      return { ...defaultConfig };
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(this.config, null, 2));
  }

  get() {
    return this.config;
  }

  set(patch) {
    this.config = {
      ...this.config,
      ...patch,
      windowBounds: {
        ...this.config.windowBounds,
        ...(patch.windowBounds || {})
      }
    };
    this.save();
    return this.config;
  }
}

module.exports = {
  ConfigStore,
  defaultConfig
};
