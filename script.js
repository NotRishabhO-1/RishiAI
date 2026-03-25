const STORAGE_KEY = "rishi_ai_chats_v3";
const ACTIVE_KEY = "rishi_ai_active_chat_v3";
const SETTINGS_KEY = "rishi_ai_settings_v3";
const VOICE_KEY = "rishi_ai_voice_enabled_v3";

const PRESETS = {
  friendly: "Warm, helpful, encouraging, and natural. Keep the tone friendly and easy to understand.",
  professional: "Polished, concise, confident, and structured. Give direct and useful answers.",
  creative: "Imaginative, expressive, stylish, and engaging. Use vivid wording when helpful.",
  tutor: "Patient, clear, step-by-step, and educational. Explain concepts simply and thoroughly.",
  coding: "Technical, precise, practical, and developer-friendly. Prefer clean examples and code."
};

const defaultSettings = {
  profileName: "Guest",
  personalityPreset: "friendly",
  imageProvider: "gemini",
  customInstructions: ""
};

const els = {
  overlay: document.getElementById("overlay"),
  sidebar: document.getElementById("sidebar"),
  sidebarToggle: document.getElementById("sidebarToggle"),
  newChatBtn: document.getElementById("newChatBtn"),
  chatList: document.getElementById("chatList"),
  chatTitle: document.getElementById("chatTitle"),
  messages: document.getElementById("messages"),
  promptInput: document.getElementById("promptInput"),
  sendBtn: document.getElementById("sendBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  imageProviderSelect: document.getElementById("imageProviderSelect"),
  settingsModal: document.getElementById("settingsModal"),
  settingsClose: document.getElementById("settingsClose"),
  settingsForm: document.getElementById("settingsForm"),
  profileNameInput: document.getElementById("profileNameInput"),
  personalityPresetSelect: document.getElementById("personalityPresetSelect"),
  customInstructionsInput: document.getElementById("customInstructionsInput"),
  resetSettingsBtn: document.getElementById("resetSettingsBtn"),
  activeProfileLabel: document.getElementById("activeProfileLabel"),
  micBtn: document.getElementById("micBtn")
};

let chats = loadChats();
let activeChatId = localStorage.getItem(ACTIVE_KEY) || "";
let settings = loadSettings();
let busy = false;
let voiceEnabled = localStorage.getItem(VOICE_KEY) === "true";
let currentUtterance = null;
let availableVoices = [];

function initVoices() {
  if (!("speechSynthesis" in window)) return;
  availableVoices = window.speechSynthesis.getVoices() || [];
}

if ("speechSynthesis" in window) {
  initVoices();
  window.speechSynthesis.onvoiceschanged = initVoices;
}

if (!chats.length) {
  const starter = createChat("New chat");
  chats = [starter];
  activeChatId = starter.id;
  persistChats();
}

if (!activeChatId || !chats.some(c => c.id === activeChatId)) {
  activeChatId = chats[0].id;
  persistChats();
}

syncSettingsForm();
syncVoiceButton();
renderAll();
closeSidebarOnDesktop();

window.addEventListener("resize", () => {
  if (window.innerWidth > 960) closeSidebarOnDesktop();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closePanels();
  }
});

els.sidebarToggle.addEventListener("click", () => {
  els.sidebar.classList.add("open");
  els.overlay.classList.add("show");
});

els.overlay.addEventListener("click", closePanels);

els.newChatBtn.addEventListener("click", () => {
  createAndOpenChat();
  closeSidebarOnMobile();
});

els.chatList.addEventListener("click", (e) => {
  const item = e.target.closest("[data-chat-id]");
  const del = e.target.closest("[data-delete-chat]");

  if (del) {
    const id = del.getAttribute("data-delete-chat");
    deleteChat(id);
    return;
  }

  if (item) {
    const id = item.getAttribute("data-chat-id");
    openChat(id);
    closeSidebarOnMobile();
  }
});

els.promptInput.addEventListener("input", autoResize);
els.promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

els.sendBtn.addEventListener("click", sendMessage);


els.micBtn.addEventListener("click", toggleVoiceReplies);
els.settingsBtn.addEventListener("click", openSettings);
els.settingsClose.addEventListener("click", closeSettings);

els.settingsModal.addEventListener("click", (e) => {
  if (e.target === els.settingsModal) closeSettings();
});

els.resetSettingsBtn.addEventListener("click", () => {
  settings = { ...defaultSettings };
  persistSettings();
  syncSettingsForm();
  renderAll();
});

els.settingsForm.addEventListener("submit", (e) => {
  e.preventDefault();
  settings = {
    profileName: els.profileNameInput.value.trim() || "Guest",
    personalityPreset: els.personalityPresetSelect.value,
    imageProvider: els.imageProviderSelect.value,
    customInstructions: els.customInstructionsInput.value.trim()
  };
  persistSettings();
  syncProfileLabel();
  closeSettings();
});

function loadChats() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function loadSettings() {
  try {
    const data = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    return { ...defaultSettings, ...(data || {}) };
  } catch {
    return { ...defaultSettings };
  }
}

function persistChats() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats));
  localStorage.setItem(ACTIVE_KEY, activeChatId);
}

function persistSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function createChat(title) {
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: []
  };
}

function currentChat() {
  return chats.find(c => c.id === activeChatId) || null;
}

function createAndOpenChat() {
  const chat = createChat("New chat");
  chats.unshift(chat);
  activeChatId = chat.id;
  persistChats();
  renderAll();
  els.promptInput.focus();
}

function openChat(id) {
  if (!chats.some(c => c.id === id)) return;
  activeChatId = id;
  persistChats();
  renderAll();
}

function deleteChat(id) {
  const index = chats.findIndex(c => c.id === id);
  if (index === -1) return;

  chats.splice(index, 1);

  if (!chats.length) {
    const chat = createChat("New chat");
    chats.push(chat);
    activeChatId = chat.id;
  } else if (activeChatId === id) {
    activeChatId = chats[0].id;
  }

  persistChats();
  renderAll();
}

function renderAll() {
  renderSidebar();
  renderMessages();
  updateHeader();
  updatePlaceholder();
  syncProfileLabel();
  syncVoiceButton();
}

function renderSidebar() {
  const sorted = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);
  els.chatList.innerHTML = "";

  sorted.forEach(chat => {
    const item = document.createElement("div");
    item.className = `chat-item ${chat.id === activeChatId ? "active" : ""}`;
    item.setAttribute("data-chat-id", chat.id);

    const left = document.createElement("div");
    left.className = "chat-item-left";

    const title = document.createElement("div");
    title.className = "chat-item-title";
    title.textContent = chat.title || "New chat";

    const meta = document.createElement("div");
    meta.className = "chat-item-sub";
    meta.textContent = `${chat.messages.length} message${chat.messages.length === 1 ? "" : "s"}`;

    const del = document.createElement("button");
    del.className = "chat-item-delete";
    del.type = "button";
    del.setAttribute("data-delete-chat", chat.id);
    del.setAttribute("aria-label", "Delete chat");
    del.textContent = "×";

    left.appendChild(title);
    left.appendChild(meta);

    item.appendChild(left);
    item.appendChild(del);
    els.chatList.appendChild(item);
  });
}

function updateHeader() {
  const chat = currentChat();
  els.chatTitle.textContent = chat ? chat.title || "New chat" : "New chat";
}

function updatePlaceholder() {
  els.promptInput.placeholder = "Message Rishi AI...";
}

function renderMessages() {
  const chat = currentChat();
  els.messages.innerHTML = "";

  if (!chat || !chat.messages.length) {
    const empty = document.createElement("div");
    empty.className = "message assistant intro";
    empty.innerHTML = `
      <div class="avatar">R</div>
      <div class="bubble">
        <h2>Welcome to Rishi AI</h2>
        <p>Start a chat, generate an image, or open settings to change the personality.</p>
      </div>
    `;
    els.messages.appendChild(empty);
    return;
  }

  chat.messages.forEach(msg => {
    els.messages.appendChild(renderMessage(msg));
  });

  els.messages.scrollTop = els.messages.scrollHeight;
}

function renderMessage(msg) {
  const row = document.createElement("div");
  row.className = `message ${msg.role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = msg.role === "user" ? "You" : "R";

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  if (msg.type === "image") {
    if (msg.text) {
      const note = document.createElement("div");
      note.className = "image-note";
      note.textContent = msg.text;
      bubble.appendChild(note);
    }

    const img = document.createElement("img");
    img.src = msg.dataUrl;
    img.alt = msg.prompt || "Generated image";
    bubble.appendChild(img);

    if (msg.prompt) {
      const cap = document.createElement("div");
      cap.className = "caption";
      cap.textContent = msg.prompt;
      bubble.appendChild(cap);
    }
  } else if (msg.role === "assistant") {
    bubble.innerHTML = renderMarkdown(msg.content || "");
  } else {
    bubble.textContent = msg.content || "";
  }

  row.appendChild(avatar);
  row.appendChild(bubble);
  return row;
}

function renderMarkdown(input) {
  const text = String(input || "");
  const codeMap = {};
  let codeIndex = 0;

  const working = text.replace(/```([\w-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const key = `__CODE_BLOCK_${codeIndex}__`;
    codeMap[key] = { lang: lang || "", code: code || "" };
    codeIndex += 1;
    return `\n${key}\n`;
  });

  const escaped = escapeHtml(working);
  const lines = escaped.split("\n");
  const out = [];
  let paragraph = [];
  let listOpen = false;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    out.push(`<p>${formatInline(paragraph.join(" ").trim())}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!listOpen) return;
    out.push("</ul>");
    listOpen = false;
  };

  const appendCode = (key) => {
    const block = codeMap[key];
    if (!block) return;
    const lang = block.lang ? escapeHtml(block.lang) : "code";
    const code = escapeHtml(block.code.replace(/\n$/, ""));
    out.push(
      `<pre class="code-block"><div class="code-head">${lang}</div><code>${code}</code></pre>`
    );
  };

  lines.forEach(line => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      closeList();
      return;
    }

    if (codeMap[trimmed]) {
      flushParagraph();
      closeList();
      appendCode(trimmed);
      return;
    }

    const heading = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${formatInline(heading[2])}</h${level}>`);
      return;
    }

    const listItem = trimmed.match(/^[-*]\s+(.*)$/);
    if (listItem) {
      flushParagraph();
      if (!listOpen) {
        out.push("<ul>");
        listOpen = true;
      }
      out.push(`<li>${formatInline(listItem[1])}</li>`);
      return;
    }

    const quote = trimmed.match(/^>\s+(.*)$/);
    if (quote) {
      flushParagraph();
      closeList();
      out.push(`<blockquote>${formatInline(quote[1])}</blockquote>`);
      return;
    }

    paragraph.push(trimmed);
  });

  flushParagraph();
  closeList();

  return out.join("");
}

function formatInline(text) {
  return String(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function autoResize() {
  els.promptInput.style.height = "auto";
  els.promptInput.style.height = `${Math.min(els.promptInput.scrollHeight, 180)}px`;
}

function shouldGenerateImage(text) {
  const t = String(text || "").trim().toLowerCase();
  if (!t) return false;

  if (t.startsWith("/image ") || t === "/image" || t.startsWith("/img ") || t === "/img") {
    return true;
  }

  const imageWords = /(image|picture|photo|illustration|art|logo|poster|wallpaper|thumbnail|banner)/i;
  const actionWords = /(generate|create|make|draw|design|paint|render|show|illustrate)/i;

  return imageWords.test(t) && actionWords.test(t);
}

function setBusy(state) {
  busy = state;
  els.sendBtn.disabled = state;
  els.promptInput.disabled = state;
  els.micBtn.disabled = state;
}

async function sendMessage() {
  if (busy) return;

  const text = els.promptInput.value.trim();
  if (!text) return;

  const chat = currentChat();
  if (!chat) return;

  els.promptInput.value = "";
  autoResize();

  if (shouldGenerateImage(text)) {
    await sendImage(chat, text);
  } else {
    await sendChat(chat, text);
  }
}

async function sendChat(chat, text) {
  addMessage(chat, { role: "user", content: text });
  persistChats();
  renderAll();

  const typingId = showTyping();
  setBusy(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: chat.messages
          .filter(m => m.role === "user" || m.role === "assistant")
          .map(m => ({ role: m.role, content: m.content })),
        systemPrompt: buildSystemPrompt()
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Chat request failed");
    }

    const replyText = data.text || "No response returned.";
    addMessage(chat, { role: "assistant", content: replyText });
    persistChats();
    speakIfEnabled(replyText);
  } catch (error) {
    addMessage(chat, { role: "assistant", content: `Error: ${error.message}` });
    persistChats();
  } finally {
    hideTyping(typingId);
    setBusy(false);
    renderAll();
  }
}

async function sendImage(chat, prompt) {
  addMessage(chat, { role: "user", content: prompt });
  persistChats();
  renderAll();

  const typingId = showTyping();
  setBusy(true);

  try {
    const response = await fetch("/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        provider: settings.imageProvider || "gemini"
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Image request failed");
    }

    if (data.imageBase64) {
      addMessage(chat, {
        role: "assistant",
        type: "image",
        text: data.text || "Here is your image.",
        prompt,
        dataUrl: `data:${data.mimeType || "image/png"};base64,${data.imageBase64}`
      });
    } else {
      const replyText = data.text || "No image returned.";
      addMessage(chat, {
        role: "assistant",
        content: replyText
      });
      speakIfEnabled(replyText);
    }

    persistChats();
  } catch (error) {
    addMessage(chat, { role: "assistant", content: `Error: ${error.message}` });
    persistChats();
  } finally {
    hideTyping(typingId);
    setBusy(false);
    renderAll();
  }
}

function buildSystemPrompt() {
  const presetText = PRESETS[settings.personalityPreset] || PRESETS.friendly;
  return [
    "You are Rishi AI, a polished, elegant assistant.",
    `User profile name: ${settings.profileName || "Guest"}.`,
    `Personality preset: ${settings.personalityPreset || "friendly"}.`,
    `Personality guidance: ${presetText}`,
    settings.customInstructions ? `Custom instructions: ${settings.customInstructions}` : "",
    "Keep responses clean, useful, and well-formatted.",
    "Use markdown for headings, bold text, lists, and code blocks when helpful.",
    "When giving code, format it clearly with fenced code blocks.",
    "Match the user's language automatically unless they ask for a different language."
  ].filter(Boolean).join(" ");
}

function addMessage(chat, message) {
  chat.messages.push({
    id: crypto.randomUUID(),
    ...message
  });
  chat.updatedAt = Date.now();

  if (chat.title === "New chat" && message.role === "user") {
    chat.title = makeTitle(message.content || message.prompt || "New chat");
  }
}

function makeTitle(text) {
  const clean = String(text || "").trim().replace(/\s+/g, " ");
  return clean.length > 34 ? `${clean.slice(0, 34)}…` : clean || "New chat";
}

function showTyping() {
  const node = document.createElement("div");
  node.className = "message assistant typing-row";
  node.id = "typingRow";
  node.innerHTML = `
    <div class="avatar">R</div>
    <div class="bubble">
      <div class="typing">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  els.messages.appendChild(node);
  els.messages.scrollTop = els.messages.scrollHeight;
  return node.id;
}

function hideTyping(id) {
  const node = document.getElementById(id);
  if (node) node.remove();
}

function syncSettingsForm() {
  els.profileNameInput.value = settings.profileName || "Guest";
  els.personalityPresetSelect.value = settings.personalityPreset || "friendly";
  els.imageProviderSelect.value = settings.imageProvider || "gemini";
  els.customInstructionsInput.value = settings.customInstructions || "";
  syncProfileLabel();
}

function syncProfileLabel() {
  els.activeProfileLabel.textContent = settings.profileName || "Guest";
}

function openSettings() {
  syncSettingsForm();
  els.settingsModal.classList.add("show");
  els.overlay.classList.add("show");
  els.settingsModal.setAttribute("aria-hidden", "false");
}

function closeSettings() {
  els.settingsModal.classList.remove("show");
  els.settingsModal.setAttribute("aria-hidden", "true");
  if (!els.sidebar.classList.contains("open")) {
    els.overlay.classList.remove("show");
  }
}

function closeSidebarOnMobile() {
  if (window.innerWidth <= 960) {
    els.sidebar.classList.remove("open");
    if (!els.settingsModal.classList.contains("show")) {
      els.overlay.classList.remove("show");
    }
  }
}

function closeSidebarOnDesktop() {
  els.sidebar.classList.remove("open");
  if (!els.settingsModal.classList.contains("show")) {
    els.overlay.classList.remove("show");
  }
}

function closePanels() {
  els.sidebar.classList.remove("open");
  els.settingsModal.classList.remove("show");
  els.settingsModal.setAttribute("aria-hidden", "true");
  els.overlay.classList.remove("show");
}

function toggleVoiceReplies() {
  voiceEnabled = !voiceEnabled;
  localStorage.setItem(VOICE_KEY, String(voiceEnabled));
  syncVoiceButton();

  if (!voiceEnabled) {
    stopSpeaking();
  }
}

function syncVoiceButton() {
  els.micBtn.classList.toggle("active", voiceEnabled);
  els.micBtn.title = voiceEnabled ? "Voice replies on" : "Voice replies off";
  els.micBtn.setAttribute("aria-pressed", String(voiceEnabled));
}

function stopSpeaking() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
}

function speakIfEnabled(text) {
  if (!voiceEnabled) return;
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;

  const cleanText = stripMarkdown(text);
  if (!cleanText) return;

  stopSpeaking();

  const utterance = new SpeechSynthesisUtterance(cleanText);
  const lang = detectLanguage(cleanText);
  const voice = pickBestVoice(lang);

  utterance.lang = voice?.lang || lang || navigator.language || "en-US";
  if (voice) utterance.voice = voice;

  utterance.rate = 0.95;
  utterance.pitch = 1.02;
  utterance.volume = 1;

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

function pickBestVoice(lang) {
  if (!availableVoices.length) initVoices();
  if (!availableVoices.length) return null;

  const target = normalizeLang(lang);
  const base = target.split("-")[0];

  let match = availableVoices.find(v => normalizeLang(v.lang) === target);
  if (!match) {
    match = availableVoices.find(v => normalizeLang(v.lang).startsWith(base));
  }

  const matchingVoices = availableVoices.filter(v => {
    const vl = normalizeLang(v.lang);
    return vl === target || vl.startsWith(base);
  });

  const localVoice = matchingVoices.find(v => v.localService);
  if (localVoice) return localVoice;

  const defaultMatch = matchingVoices.find(v => v.default);
  if (defaultMatch) return defaultMatch;

  return match || availableVoices.find(v => v.default) || availableVoices[0] || null;
}

function normalizeLang(lang) {
  return String(lang || "en-US").replace("_", "-").toLowerCase();
}

function detectLanguage(text) {
  const t = String(text || "").trim();

  if (/[ぁ-んァ-ン一-龯]/.test(t)) return "ja-JP";
  if (/[가-힣]/.test(t)) return "ko-KR";
  if (/[一-龯]/.test(t)) return "zh-CN";

  if (/[ऀ-ॿ]/.test(t)) return "hi-IN";
  if (/[০-৿]/.test(t)) return "bn-IN";
  if (/[੦-੿]/.test(t)) return "pa-IN";
  if (/[଀-୿]/.test(t)) return "or-IN";
  if (/[஀-௿]/.test(t)) return "ta-IN";
  if (/[అ-౿]/.test(t)) return "te-IN";
  if (/[ಀ-೿]/.test(t)) return "kn-IN";
  if (/[ഀ-ൿ]/.test(t)) return "ml-IN";
  if (/[અ-૿]/.test(t)) return "gu-IN";

  if (/[؀-ۿ]/.test(t)) return "ar-SA";
  if (/[א-ת]/.test(t)) return "he-IL";
  if (/[а-яА-ЯЁё]/.test(t)) return "ru-RU";

  return navigator.language || "en-US";
}

function stripMarkdown(text) {
  return String(text || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[.*?\]\(.*?\)/g, " ")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#+\s/g, "")
    .replace(/>\s/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
