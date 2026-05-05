# OverlayAI

OverlayAI is a floating overlay for AI chat websites. It opens the real site in a small always-on-top window, keeps you signed in, and can be shown or hidden quickly.

## For Non-Technical Users

### Install OverlayAI

1. Download `OverlayAI-Setup-0.1.0.exe` from the project release page.
2. Open the installer and follow the prompts.
3. Launch OverlayAI from the Start menu or desktop shortcut.

### First Run

1. Choose your AI site in the settings window.
2. Click `Toggle Overlay` or press `Ctrl+Space`.
3. Sign in to the site inside the overlay once.
4. After that, the app should remember you when you reopen it.

### If you want a custom site

1. Paste the website URL.
2. Press `Enter` or click `Save Custom Site`.
3. Click `Toggle Overlay`.
4. If the window is not visible, use `Reset Overlay Position` and try again.

## What it does

- Loads AI chat websites inside a native desktop shell
- Remembers login sessions with separate persistent partitions per site
- Hides common headers, sidebars, and footer chrome with injected CSS
- Shows a transparent always-on-top overlay with fade in/out behavior
- Supports a standard global hotkey plus an optional Windows deep-hook helper
- Lets you switch between presets like ChatGPT, Claude, Perplexity, Gemini, Copilot, DeepSeek, and Ollama WebUI
- Resets the current site session to force a clean re-login
- Optional Selection Assist sends copied text from other apps into the chat

## Development

### Install dependencies

```powershell
npm install
```

### Optional: build the Windows deep-hook helper

```powershell
npm run build:hook
```

This requires the .NET 8 SDK on Windows.

### Run the app

```powershell
npm start
```

### Build the Windows installer

```powershell
npm run dist:installer
```

The installer is created at `dist/OverlayAI-Setup-0.1.0.exe`.

## Packaging

Build an unpacked app:

```powershell
npm run dist:dir
```

Build Windows installer and portable output:

```powershell
npm run dist:win
```

## Supported sites

- ChatGPT
- Claude
- Perplexity
- Gemini
- Copilot
- DeepSeek
- Ollama WebUI
- Custom URLs

## Using OverlayAI while gaming

OverlayAI works best with games set to `Borderless Windowed`, `Windowed Fullscreen`, or `Borderless Fullscreen` mode.

In true exclusive fullscreen mode, Windows may minimize the game or push it to the taskbar when another app window appears. This is normal Windows behavior for many games. OverlayAI tries to stay always-on-top, but it cannot guarantee a smooth overlay over every exclusive fullscreen game.

Recommended setup for gaming:

1. Set the game display mode to `Borderless Windowed` or `Windowed Fullscreen`.
2. Open OverlayAI before launching the game.
3. Use the normal hotkey, default `Ctrl+Space`, to show or hide the overlay.
4. If the overlay does not appear, use `Reset Overlay Position` in settings.

### When to use Deep Hook

Use Deep Hook only if the normal hotkey does not work while a game is focused.

Deep Hook helps OverlayAI detect the shortcut when a game captures keyboard input, especially in exclusive fullscreen. It does not force the overlay to draw over every game, and it may still cause some games to minimize when the overlay appears.

Do not enable Deep Hook unless you need it. Some anti-cheat software may flag low-level keyboard hooks, even when they are only used for shortcuts.

## Deep Hook warning

Deep Hook mode uses a low-level system keyboard hook for exclusive fullscreen games. Some anti-cheat software may flag this kind of behavior. Use it at your own risk.

OverlayAI does not read game memory, inject DLLs, inspect screen content, or persist the hook after a trigger. The helper listens only for the configured shortcut, triggers once, uninstalls the hook, and exits.

## Notes and troubleshooting

- Some AI sites change their DOM frequently, so the chrome-hiding CSS may need occasional updates.
- If login looks blank or incomplete, reload the site from the settings window.
- If an embedded site rejects the desktop user agent, adjust the preset or add a custom site entry.
- Websites with strict anti-embedding behavior may still work because BrowserView is a full browser surface, but individual auth flows can vary.
- macOS currently supports the standard global shortcut path only.
