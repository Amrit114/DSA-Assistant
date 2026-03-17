// =====================================================
//  DSA ASSISTANT — script.js
//  Dark Red Theme · SQLite backend · Claude-style history
// =====================================================

const API_KEY = 'my-secret-key';
const HEADERS = {
    'Content-Type': 'application/json',
    'X-API-KEY': API_KEY
};

// ── State ──────────────────────────────────────────
let currentSessionId = null;
let allSessions = [];
let isLoading = false;

// ── DOM refs ───────────────────────────────────────
const chatContainer = document.getElementById('chatContainer');
const emptyState    = document.getElementById('emptyState');
const questionInput = document.getElementById('questionInput');
const sendButton    = document.getElementById('sendButton');
const sessionsList  = document.getElementById('sessionsList');
const toastEl       = document.getElementById('toast');
const chatArea      = document.getElementById('chatArea');

// =====================================================
//  THEME
// =====================================================
//  THEME — handled by /static/theme.js (loaded in index.html)
//  toggleTheme() and applyTheme() come from theme.js
// =====================================================
function loadTheme() {
    applyTheme(getTheme()); // getTheme() from theme.js
}

// =====================================================
//  SIDEBAR MOBILE
// =====================================================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
}

function closeSidebarMobile() {
    if (window.innerWidth <= 800) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('show');
    }
}

// =====================================================
//  SESSIONS — fetch from server
// =====================================================
async function fetchSessions() {
    try {
        const res = await fetch('/api/sessions', { headers: HEADERS });
        const data = await res.json();
        allSessions = data.sessions || [];
        renderSessions(allSessions);
    } catch (e) {
        console.error('Could not load sessions:', e);
    }
}

function renderSessions(sessions) {
    if (!sessions || sessions.length === 0) {
        sessionsList.innerHTML = `
            <div class="sessions-empty">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                <p>No conversations yet</p>
            </div>`;
        return;
    }

    const groups = groupByDate(sessions);
    let html = '';

    for (const [label, items] of Object.entries(groups)) {
        html += `<div class="session-group-label">${label}</div>`;
        for (const s of items) {
            const isActive = s.id === currentSessionId;
            const title = escapeHtml(s.title);
            html += `
                <div class="session-item ${isActive ? 'active' : ''}" id="session-${s.id}" onclick="loadSession('${s.id}')">
                    <div class="session-item-body">
                        <div class="session-title">${title}</div>
                        <div class="session-time">${formatTimeLabel(s.updated_at)}</div>
                    </div>
                    <div class="session-actions">
                        <button class="s-btn" onclick="renameSession(event,'${s.id}')" title="Rename">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="s-btn del" onclick="deleteSession(event,'${s.id}')" title="Delete">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6m4-6v6"/></svg>
                        </button>
                    </div>
                </div>`;
        }
    }

    sessionsList.innerHTML = html;
}

function groupByDate(sessions) {
    const groups = {};
    const now = new Date();

    for (const s of sessions) {
        const d = new Date(s.updated_at);
        const diffDays = Math.floor((now - d) / 86400000);
        let label;
        if (diffDays === 0)      label = 'Today';
        else if (diffDays === 1) label = 'Yesterday';
        else if (diffDays < 7)   label = 'This Week';
        else if (diffDays < 30)  label = 'This Month';
        else                     label = 'Older';

        if (!groups[label]) groups[label] = [];
        groups[label].push(s);
    }

    const order = ['Today', 'Yesterday', 'This Week', 'This Month', 'Older'];
    const ordered = {};
    for (const k of order) if (groups[k]) ordered[k] = groups[k];
    return ordered;
}

function filterSessions(query) {
    if (!query.trim()) { renderSessions(allSessions); return; }
    const q = query.toLowerCase();
    renderSessions(allSessions.filter(s => s.title.toLowerCase().includes(q)));
}

// =====================================================
//  LOAD SESSION
// =====================================================
async function loadSession(sessionId) {
    if (sessionId === currentSessionId) { closeSidebarMobile(); return; }

    try {
        const res = await fetch(`/api/sessions/${sessionId}`, { headers: HEADERS });
        if (!res.ok) { showToast('❌ Could not load session.', 'error'); return; }
        const data = await res.json();

        currentSessionId = sessionId;
        chatContainer.innerHTML = '';
        emptyState.style.display = 'none';

        for (const msg of data.messages) {
            renderMessage(msg.content, msg.role, false);
        }

        await fetchSessions();
        scrollBottom();
        closeSidebarMobile();
    } catch (e) {
        showToast('❌ Failed to load chat.', 'error');
    }
}

// =====================================================
//  NEW CHAT
// =====================================================
function startNewChat() {
    currentSessionId = null;
    chatContainer.innerHTML = '';
    emptyState.style.display = 'flex';
    questionInput.value = '';
    questionInput.style.height = 'auto';
    document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
    closeSidebarMobile();
    questionInput.focus();
}

// =====================================================
//  DELETE / RENAME
// =====================================================
async function deleteSession(event, sessionId) {
    event.stopPropagation();
    if (!confirm('Delete this conversation?')) return;
    try {
        await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE', headers: HEADERS });
        if (currentSessionId === sessionId) startNewChat();
        await fetchSessions();
        showToast('Conversation deleted.', 'info');
    } catch (e) { showToast('❌ Could not delete.', 'error'); }
}

async function renameSession(event, sessionId) {
    event.stopPropagation();
    const session = allSessions.find(s => s.id === sessionId);
    const newTitle = prompt('Rename conversation:', session?.title || '');
    if (!newTitle?.trim()) return;
    try {
        await fetch(`/api/sessions/${sessionId}/title`, {
            method: 'PATCH', headers: HEADERS,
            body: JSON.stringify({ title: newTitle.trim() })
        });
        await fetchSessions();
    } catch (e) { showToast('❌ Could not rename.', 'error'); }
}

async function clearAllChats() {
    if (!confirm('Delete ALL conversation history? This cannot be undone.')) return;
    try {
        await fetch('/api/sessions', { method: 'DELETE', headers: HEADERS });
        startNewChat();
        await fetchSessions();
        showToast('All conversations cleared.', 'info');
    } catch (e) { showToast('❌ Could not clear.', 'error'); }
}

// =====================================================
//  ASK QUESTION
// =====================================================
async function askQuestion() {
    const question = questionInput.value.trim();
    if (!question || isLoading) return;

    emptyState.style.display = 'none';
    renderMessage(question, 'user');

    questionInput.value = '';
    questionInput.style.height = 'auto';
    isLoading = true;
    sendButton.disabled = true;

    const loadingId = showLoading();

    try {
        const body = { question };
        if (currentSessionId) body.session_id = currentSessionId;

        const res = await fetch('/api/ask', {
            method: 'POST', headers: HEADERS,
            body: JSON.stringify(body)
        });
        const data = await res.json();
        removeLoading(loadingId);

        if (!res.ok) {
            renderMessage('❌ ' + (data.error || 'Server error. Please try again.'), 'assistant');
        } else {
            if (data.session_id) currentSessionId = data.session_id;
            renderMessage(data.answer || 'No answer returned.', 'assistant');
            await fetchSessions();
        }
    } catch (e) {
        removeLoading(loadingId);
        renderMessage('❌ Could not reach the server. Is Flask running?', 'assistant');
        console.error(e);
    }

    isLoading = false;
    sendButton.disabled = false;
    questionInput.focus();
}

function askSuggestion(question) {
    questionInput.value = question;
    askQuestion();
}

// =====================================================
//  RENDER MESSAGE
// =====================================================
function renderMessage(text, role, scroll = true) {
    const div = document.createElement('div');
    div.className = `message ${role}`;

    const avatar   = role === 'user' ? 'U' : '⚡';
    const sender   = role === 'user' ? 'You' : 'DSA Assistant';
    const bodyHtml = role === 'assistant'
        ? `<div class="msg-sender">${sender}</div><div class="msg-content">${formatMessage(text)}</div>`
        : `<div class="msg-sender">${sender}</div><div class="msg-content">${escapeHtml(text)}</div>`;

    div.innerHTML = `
        <div class="message-inner">
            <div class="msg-avatar">${avatar}</div>
            <div class="msg-body">${bodyHtml}</div>
        </div>`;

    chatContainer.appendChild(div);
    if (scroll) scrollBottom();
}

// =====================================================
//  LOADING
// =====================================================
function showLoading() {
    const id = 'loading-' + Date.now();
    const div = document.createElement('div');
    div.className = 'message assistant';
    div.id = id;
    div.innerHTML = `
        <div class="message-inner">
            <div class="msg-avatar">⚡</div>
            <div class="msg-body">
                <div class="msg-sender">DSA Assistant</div>
                <div class="msg-content">
                    <div class="loading">
                        <div class="loading-dot"></div>
                        <div class="loading-dot"></div>
                        <div class="loading-dot"></div>
                    </div>
                </div>
            </div>
        </div>`;
    chatContainer.appendChild(div);
    scrollBottom();
    return id;
}

function removeLoading(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}


async function ingestPDFs() {
    const btn   = document.getElementById('ingestBtn');
    const icon  = document.getElementById('ingestIcon');
    const label = document.getElementById('ingestLabel');

    btn.disabled = true;
    icon.classList.add('spinning');
    label.textContent = 'Indexing...';
    showToast('⚙️ Indexing PDF documents...', 'info', 3500);

    try {
        const res  = await fetch('/api/ingest', { method: 'POST', headers: HEADERS });
        const data = await res.json();
        if (res.ok) showToast('✅ PDFs indexed! Ready to answer.', 'success', 4000);
        else        showToast('❌ ' + (data.error || 'Indexing failed.'), 'error', 4000);
    } catch (e) {
        showToast('❌ Server unreachable. Is Flask running?', 'error', 4000);
    }

    btn.disabled = false;
    icon.classList.remove('spinning');
    label.textContent = 'Index PDFs';
}


let toastTimer = null;
function showToast(message, type = 'info', duration = 3000) {
    toastEl.textContent = message;
    toastEl.className = `toast ${type} show`;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}


questionInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 140) + 'px';
});

function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        askQuestion();
    }
}

function scrollBottom() {
    chatArea.scrollTop = chatArea.scrollHeight;
}


function formatMessage(text) {

    
    text = text.replace(/^```markdown\n?/gm, '');
    text = text.replace(/^```\s*$/gm, '');

    
    const codeBlocks = [];
    let ci = 0;

    text = text.replace(/```(\w+)?\s*\n?([\s\S]*?)```[^\n]*/g, (_, lang, code) => {
        
        code = code
            .replace(/\} /g,    '}\n')      
            .replace(/\{ /g,    '{\n')      
            .replace(/; /g,     ';\n')      
            .replace(/\/\/ /g,  '\n// ')    
            .replace(/\n{3,}/g, '\n\n')     
            .trim();
        
        const id      = 'code-' + ci;
        const lbl     = lang ? lang.toLowerCase() : 'code';
        const lblShow = lang ? lang.toUpperCase()  : 'CODE';
        codeBlocks.push({ id, lbl, lblShow, code });
        ci++;
        return `%%CODEBLOCK_${ci - 1}%%`;
    });

    
    text = text.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    text = text.replace(/^> (.+)$/gm,    '<blockquote>$1</blockquote>');

    
    text = text.replace(/^# (.+)$/gm,   '<h1 class="md-h1">$1</h1>');
    text = text.replace(/^## (.+)$/gm,  '<h2 class="md-h2">$1</h2>');
    text = text.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');

    
    text = text.replace(/^---+$/gm, '<hr class="md-hr">');

    
    text = text.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*([^*]+)\*\*/g,     '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g,           '<strong>$1</strong>');
    text = text.replace(/\*([^*\n]+)\*/g,        '<em>$1</em>');

    
    text = text.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

    
    text = text.replace(/((?:^\d+\.[ \t].+$\n?)+)/gm, match => {
        const items = match.trim().split(/\n(?=\d+\.)/);
        const lis   = items.map(i => {
            const content = i.replace(/^\d+\.[ \t]+/, '');
            return `<li>${content}</li>`;
        }).join('');
        return `<ol>${lis}</ol>`;
    });

    
    text = text.replace(/((?:^[ \t]*[\*\-][ \t].+$\n?)+)/gm, match => {
        const items = match.trim().split(/\n(?=[ \t]*[\*\-])/);
        const lis   = items.map(i => {
            const content = i.replace(/^[ \t]*[\*\-][ \t]+/, '');
            return `<li>${content}</li>`;
        }).join('');
        return `<ul>${lis}</ul>`;
    });

    
    const lines = text.split(/\n\n+/);
    text = lines.map(block => {
        block = block.trim();
        if (!block) return '';
        // already HTML — don't wrap
        if (/^<(h[1-6]|ul|ol|blockquote|hr|div|%%CO)/.test(block)) return block;
        // single line with no HTML — wrap in <p>
        return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');

    
    codeBlocks.forEach((cb, idx) => {
        const escaped = escapeHtml(cb.code);
        const html =
            `<div class="code-block">` +
            `<div class="code-block-header">` +
            `<span class="code-lang">${cb.lblShow}</span>` +
            `<button class="copy-btn" onclick="copyCode('${cb.id}')">` +
            `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">` +
            `<rect x="9" y="9" width="13" height="13" rx="2"/>` +
            `<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>` +
            `</svg>Copy</button>` +
            `</div>` +
            `<pre style="margin:0;padding:16px;overflow-x:auto;">` +
            `<code id="${cb.id}" class="code-content lang-${cb.lbl}" ` +
            `style="background:transparent;color:#f8f8f2;font-family:'JetBrains Mono',monospace;` +
            `font-size:13px;line-height:1.75;white-space:pre;display:block;">${escaped}</code>` +
            `</pre>` +
            `</div>`;
        text = text.replace(`%%CODEBLOCK_${idx}%%`, html);
    });

    return text;
}

function copyCode(codeId) {
    const el = document.getElementById(codeId);
    navigator.clipboard.writeText(el.textContent).then(() => {
        const btn = event.target.closest('button');
        const original = btn.innerHTML;
        btn.textContent = '✓ Copied!';
        btn.style.color = '#22c55e';
        setTimeout(() => {
            btn.innerHTML = original;
            btn.style.color = '';
        }, 2000);
    });
}

function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}

function formatTimeLabel(iso) {
    const d    = new Date(iso);
    const diff = Date.now() - d;
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return 'just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'yesterday';
    return d.toLocaleDateString();
}


async function loadCurrentUser() {
    try {
        const res  = await fetch('/api/me', { headers: HEADERS });
        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }
        const user = await res.json();

        const nameEl   = document.getElementById('sidebarUsername');
        const emailEl  = document.getElementById('sidebarEmail');
        const avatarEl = document.getElementById('userAvatar');

        if (nameEl)   nameEl.textContent   = user.username || 'User';
        if (emailEl)  emailEl.textContent  = user.email    || '';
        if (avatarEl) avatarEl.textContent = (user.username || 'U')[0].toUpperCase();

    } catch (e) {
        console.error('Failed to load user:', e);
    }
}


loadCurrentUser();
fetchSessions();
questionInput.focus();