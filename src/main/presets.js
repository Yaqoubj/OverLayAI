const PRESETS = {
  chatgpt: {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com/",
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
    focusSelector: "textarea, div[contenteditable='true'], #prompt-textarea",
    css: [
      "header",
      "nav",
      "aside",
      "footer",
      "[data-testid='profile-button']",
      "[data-testid='left-sidebar']"
    ]
      .map((selector) => `${selector}{display:none !important;}`)
      .join("\n")
      .concat(
        "\nhtml,body,#__next,main{background:transparent !important;}" +
          "\nmain,[role='main']{max-width:100% !important;margin:0 !important;padding:0 !important;}" +
          "\nsection article{max-width:100% !important;}"
      )
  },
  claude: {
    id: "claude",
    name: "Claude",
    url: "https://claude.ai/",
    focusSelector: "div[contenteditable='true'], textarea",
    css:
      "header, nav, aside, footer{display:none !important;}\nmain{max-width:100% !important;padding:0 !important;}"
  },
  perplexity: {
    id: "perplexity",
    name: "Perplexity",
    url: "https://www.perplexity.ai/",
    focusSelector: "textarea, input[type='text'], div[contenteditable='true']",
    css:
      "header, nav, aside, footer{display:none !important;}\nmain{padding:0 !important;max-width:100% !important;}"
  },
  gemini: {
    id: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com/",
    focusSelector: "textarea, div[contenteditable='true']",
    css:
      "header, nav, footer, .navigation-drawer{display:none !important;}\nmain{max-width:100% !important;margin:0 !important;}"
  },
  copilot: {
    id: "copilot",
    name: "Copilot",
    url: "https://copilot.microsoft.com/",
    focusSelector: "textarea, div[contenteditable='true']",
    css:
      "header, nav, footer, aside{display:none !important;}\nmain{padding:0 !important;max-width:100% !important;}"
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    url: "https://chat.deepseek.com/",
    focusSelector: "textarea, div[contenteditable='true']",
    css:
      "header, nav, aside, footer{display:none !important;}\nmain{max-width:100% !important;padding:0 !important;}"
  },
  ollama: {
    id: "ollama",
    name: "Ollama WebUI",
    url: "http://127.0.0.1:3000/",
    focusSelector: "textarea, input[type='text'], div[contenteditable='true']",
    css:
      "header, nav, aside, footer{display:none !important;}\nmain{max-width:100% !important;padding:0 !important;}"
  }
};

function listPresets() {
  return Object.values(PRESETS);
}

function getPreset(id) {
  return PRESETS[id] || null;
}

module.exports = {
  PRESETS,
  listPresets,
  getPreset
};
