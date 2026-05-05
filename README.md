# QuickAI

QuickAI is a floating overlay for AI chat websites. It opens the real site in a small always-on-top window, keeps you signed in, and can be shown or hidden quickly.

## For Non-Technical Users

### Install QuickAI

1. Download the Windows installer file named something like `QuickAI-Setup-0.1.0.exe`.
2. Open the installer and follow the prompts.
3. Launch QuickAI from the Start menu or desktop shortcut.

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

## Deep Hook warning

Deep Hook mode uses a low-level system keyboard hook for exclusive fullscreen games. Some anti-cheat software may flag this kind of behavior. Use it at your own risk.

QuickAI does not read game memory, inject DLLs, inspect screen content, or persist the hook after a trigger. The helper listens only for the configured shortcut, triggers once, uninstalls the hook, and exits.

## Notes and troubleshooting

- Some AI sites change their DOM frequently, so the chrome-hiding CSS may need occasional updates.
- If login looks blank or incomplete, reload the site from the settings window.
- If an embedded site rejects the desktop user agent, adjust the preset or add a custom site entry.
- Websites with strict anti-embedding behavior may still work because BrowserView is a full browser surface, but individual auth flows can vary.
- macOS currently supports the standard global shortcut path only.
