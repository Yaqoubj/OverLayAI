const fs = require("node:fs");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { app, dialog } = require("electron");
const { spawn } = require("node:child_process");

class DeepHookManager extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.enabled = false;
    this.currentHotkey = null;
  }

  get helperPath() {
    if (app.isPackaged) {
      return path.join(process.resourcesPath, "native", "hook", "QuickAI.Hook.exe");
    }
    return path.join(app.getAppPath(), "dist", "native", "hook", "QuickAI.Hook.exe");
  }

  isAvailable() {
    return process.platform === "win32" && fs.existsSync(this.helperPath);
  }

  async enable(hotkey) {
    if (process.platform !== "win32") {
      throw new Error("Deep Hook mode is only available on Windows.");
    }

    if (!this.isAvailable()) {
      throw new Error(
        "Deep Hook helper not found. Build it with `npm run build:hook` before using Deep Hook mode."
      );
    }

    this.currentHotkey = hotkey;
    this.enabled = true;
    this.launch();
  }

  disable() {
    this.enabled = false;
    this.currentHotkey = null;
    this.stopProcess();
  }

  relaunchIfNeeded() {
    if (this.enabled && !this.proc && this.currentHotkey) {
      this.launch();
    }
  }

  launch() {
    this.stopProcess();
    const args = ["--hotkey", this.currentHotkey];
    this.proc = spawn(this.helperPath, args, {
      windowsHide: true
    });

    this.proc.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      if (text.includes("TRIGGERED")) {
        this.emit("trigger");
      }
    });

    this.proc.stderr.on("data", (chunk) => {
      console.error("[DeepHook]", chunk.toString());
    });

    this.proc.on("exit", () => {
      this.proc = null;
      if (this.enabled) {
        setTimeout(() => this.relaunchIfNeeded(), 750);
      }
    });
  }

  stopProcess() {
    if (this.proc) {
      this.proc.kill();
      this.proc = null;
    }
  }

  static async confirmEnable(browserWindow) {
    const result = await dialog.showMessageBox(browserWindow, {
      type: "warning",
      buttons: ["Enable Deep Hook", "Cancel"],
      defaultId: 0,
      cancelId: 1,
      title: "Enable Deep Hook Mode",
      message:
        "Deep Hook mode uses a low-level system keyboard hook for exclusive fullscreen games.",
      detail:
        "Some anti-cheat software may flag this behavior. Use at your own risk. The hook only listens for the configured shortcut and uninstalls immediately after triggering."
    });

    return result.response === 0;
  }
}

module.exports = {
  DeepHookManager
};
