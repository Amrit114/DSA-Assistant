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
const scrollBtn     = document.getElementById('scrollBottomBtn');

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

function toggleSidebarCollapse() {
    const sidebar = document.getElementById('sidebar');
    const wrapper = document.getElementById('mainWrapper');
    const collapsed = sidebar.classList.toggle('collapsed');
    localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0');
}

// Restore sidebar collapse state on load
(function() {
    if (localStorage.getItem('sidebarCollapsed') === '1') {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
    }
})();

function closeSidebarMobile() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('show');
    }
}

// ── Global Keyboard Shortcuts ──────────────────────
document.addEventListener('keydown', function(e) {
    // Ctrl+K or Cmd+K to focus search input
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        const sidebar = document.getElementById('sidebar');
        const searchInput = document.getElementById('searchInput');
        if (sidebar && sidebar.classList.contains('collapsed')) {
            toggleSidebarCollapse();
        }
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }
    // Escape key to close modal
    if (e.key === 'Escape') {
        const modal = document.getElementById('pdfModalOverlay');
        if (modal && modal.classList.contains('open')) {
            closeUploadModal();
        }
    }
});

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
    const now      = new Date();
    const timeStr  = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const bodyHtml = role === 'assistant'
        ? `<div class="msg-sender">${sender}</div><div class="msg-content">${formatMessage(text)}</div><div class="msg-time">${timeStr}</div>`
        : `<div class="msg-sender">${sender}</div><div class="msg-content">${escapeHtml(text)}</div><div class="msg-time">${timeStr}</div>`;

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
                        <div class="loading-label">
                            <div class="loading-dots">
                                <div class="loading-dot"></div>
                                <div class="loading-dot"></div>
                                <div class="loading-dot"></div>
                            </div>
                            <span>Thinking…</span>
                        </div>
                        <div class="loading-skeleton">
                            <div class="skeleton-bar"></div>
                            <div class="skeleton-bar"></div>
                            <div class="skeleton-bar"></div>
                        </div>
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


// ══════════════════════════════════════════════════════════════
//  PDF UPLOAD MODAL
// ══════════════════════════════════════════════════════════════

let _selectedPdfFile = null;

function openUploadModal() {
    document.getElementById('pdfModalOverlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    resetUploadModal();
}

function closeUploadModal() {
    document.getElementById('pdfModalOverlay').classList.remove('open');
    document.body.style.overflow = '';
    setTimeout(resetUploadModal, 300);
}

function closePdfModalOnBackdrop(e) {
    if (e.target === document.getElementById('pdfModalOverlay')) closeUploadModal();
}

function resetUploadModal() {
    _selectedPdfFile = null;
    document.getElementById('pdfFileInput').value = '';
    document.getElementById('pdfFilePreview').style.display  = 'none';
    document.getElementById('pdfProgress').style.display     = 'none';
    document.getElementById('pdfResult').style.display       = 'none';
    document.getElementById('pdfModalFooter').style.display  = 'flex';
    document.getElementById('pdfUploadBtn').disabled         = true;
    document.getElementById('pdfDropZone').style.display     = 'flex';
    document.getElementById('pdfDropZone').classList.remove('drag-over');
    document.getElementById('pdfProgressBar').style.width    = '0%';
    document.getElementById('pdfProgressPct').textContent    = '0%';
}

function clearPdfSelection() {
    _selectedPdfFile = null;
    document.getElementById('pdfFileInput').value = '';
    document.getElementById('pdfFilePreview').style.display = 'none';
    document.getElementById('pdfUploadBtn').disabled = true;
}

function pdfFileSelected(e) {
    const file = e.target.files[0];
    if (file) applyPdfFile(file);
}

function pdfDragOver(e) {
    e.preventDefault();
    document.getElementById('pdfDropZone').classList.add('drag-over');
}

function pdfDragLeave(e) {
    document.getElementById('pdfDropZone').classList.remove('drag-over');
}

function pdfDrop(e) {
    e.preventDefault();
    document.getElementById('pdfDropZone').classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) applyPdfFile(file);
}

function applyPdfFile(file) {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
        showToast('⚠️ Only PDF files are accepted', 'error', 3000);
        return;
    }
    _selectedPdfFile = file;
    document.getElementById('pdfFileName').textContent = file.name;
    document.getElementById('pdfFileSize').textContent = formatBytes(file.size);
    document.getElementById('pdfFilePreview').style.display = 'block';
    document.getElementById('pdfUploadBtn').disabled = false;
}

function formatBytes(bytes) {
    if (bytes < 1024)        return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function startPdfUpload() {
    if (!_selectedPdfFile) return;

    // Switch to progress view
    document.getElementById('pdfDropZone').style.display    = 'none';
    document.getElementById('pdfFilePreview').style.display = 'none';
    document.getElementById('pdfProgress').style.display    = 'block';
    document.getElementById('pdfModalFooter').style.display = 'none';
    document.getElementById('pdfResult').style.display      = 'none';

    const bar   = document.getElementById('pdfProgressBar');
    const pct   = document.getElementById('pdfProgressPct');
    const label = document.getElementById('pdfProgressLabel');
    const sub   = document.getElementById('pdfProgressSub');

    // Animate upload progress with XHR
    const formData = new FormData();
    formData.append('file', _selectedPdfFile);

    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const p = Math.round((e.loaded / e.total) * 40); // upload = 0-40%
            bar.style.width = p + '%';
            pct.textContent = p + '%';
        }
    });

    // Simulate indexing progress (40%-95%) with interval
    let fakeP = 40;
    let fakeInterval;

    xhr.upload.addEventListener('load', () => {
        label.textContent = 'Indexing into vector database...';
        sub.textContent   = 'Embedding chunks — this may take a minute...';
        fakeInterval = setInterval(() => {
            fakeP = Math.min(fakeP + Math.random() * 3, 92);
            bar.style.width = fakeP + '%';
            pct.textContent = Math.round(fakeP) + '%';
        }, 600);
    });

    xhr.addEventListener('load', () => {
        clearInterval(fakeInterval);
        bar.style.width = '100%';
        pct.textContent = '100%';

        const resultEl = document.getElementById('pdfResult');
        document.getElementById('pdfProgress').style.display = 'none';
        resultEl.style.display = 'block';

        try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status === 200) {
                const isAlready = data.status === 'already_exists';
                resultEl.innerHTML = `
                    <div class="pdf-result-icon ${isAlready ? 'warn' : 'success'}">
                        ${isAlready
                            ? '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
                            : '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
                        }
                    </div>
                    <p class="pdf-result-title">${isAlready ? 'Already Indexed' : 'Successfully Indexed!'}</p>
                    <p class="pdf-result-msg">${data.message}</p>
                    ${data.chunks ? `<div class="pdf-result-stats">
                        <span>📄 ${data.chunks} chunks stored</span>
                        <span>⏱ ${data.total_time}s total</span>
                        <span>🔗 ${data.embed_time}s embedding</span>
                    </div>` : ''}
                `;
                showToast(isAlready ? `ℹ️ Already indexed` : `✅ ${data.filename} indexed!`, isAlready ? 'info' : 'success', 4000);
            } else {
                resultEl.innerHTML = `
                    <div class="pdf-result-icon error">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    </div>
                    <p class="pdf-result-title">Upload Failed</p>
                    <p class="pdf-result-msg">${data.error || 'Unknown error occurred.'}</p>
                `;
                showToast('❌ Upload failed: ' + (data.error || 'Unknown'), 'error', 4000);
            }
        } catch {
            resultEl.innerHTML = '<p class="pdf-result-msg">Unexpected server response.</p>';
        }

        // Show a close button
        document.getElementById('pdfModalFooter').innerHTML =
            '<button class="pdf-btn-primary" onclick="closeUploadModal()">Done</button>';
        document.getElementById('pdfModalFooter').style.display = 'flex';
    });

    xhr.addEventListener('error', () => {
        clearInterval(fakeInterval);
        document.getElementById('pdfProgress').style.display = 'none';
        const resultEl = document.getElementById('pdfResult');
        resultEl.style.display = 'block';
        resultEl.innerHTML = `
            <div class="pdf-result-icon error"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
            <p class="pdf-result-title">Network Error</p>
            <p class="pdf-result-msg">Could not reach the server. Check your connection.</p>
        `;
        document.getElementById('pdfModalFooter').innerHTML =
            '<button class="pdf-btn-primary" onclick="closeUploadModal()">Close</button>';
        document.getElementById('pdfModalFooter').style.display = 'flex';
        showToast('❌ Network error during upload', 'error', 4000);
    });

    xhr.open('POST', '/api/upload-pdf');
    xhr.send(formData);
}


function scrollBottom() {
    chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
    if (scrollBtn) scrollBtn.classList.remove('visible');
}

/* Show/hide scroll-to-bottom button based on scroll position */
chatArea.addEventListener('scroll', () => {
    if (!scrollBtn) return;
    const distFromBottom = chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight;
    if (distFromBottom > 120) {
        scrollBtn.classList.add('visible');
    } else {
        scrollBtn.classList.remove('visible');
    }
});


function formatMessage(text) {

    // ═══════════════════════════════════════════════════════════
    //  STEP 1 — Extract ALL fenced code blocks into placeholders
    //           so nothing inside them gets processed as markdown.
    // ═══════════════════════════════════════════════════════════
    const codeBlocks = [];
    const idPrefix   = 'cb-' + Date.now() + '-';   // unique across sessions
    let   ci         = 0;

    // Strip stray ```markdown and lone ``` lines first
    text = text.replace(/^```markdown\s*\n?/gim, '');

    // Extract every fenced block (greedy-safe with [^`] trick)
    text = text.replace(/```([\w+-]*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        lang = (lang || '').trim();
        code = code
            .replace(/\r\n/g, '\n')       // CRLF → LF
            .replace(/\t/g,   '    ')     // tabs  → 4 spaces
            .trimEnd();                   // remove trailing blank lines only

        const id      = idPrefix + ci;
        const lbl     = (lang || 'code').toLowerCase();
        const lblShow = (lang || 'CODE').toUpperCase();
        codeBlocks.push({ id, lbl, lblShow, code });
        ci++;
        // Surround placeholder with newlines so paragraph-split never joins it
        return '\n\n%%CB' + (ci - 1) + '%%\n\n';
    });

    // ═══════════════════════════════════════════════════════════
    //  STEP 2 — Process markdown on the REMAINING (non-code) text
    // ═══════════════════════════════════════════════════════════

    // Blockquotes
    text = text.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    text = text.replace(/^> (.+)$/gm,    '<blockquote>$1</blockquote>');

    // Headings
    text = text.replace(/^#### (.+)$/gm, '<h4 class="md-h4">$1</h4>');
    text = text.replace(/^### (.+)$/gm,  '<h3 class="md-h3">$1</h3>');
    text = text.replace(/^## (.+)$/gm,   '<h2 class="md-h2">$1</h2>');
    text = text.replace(/^# (.+)$/gm,    '<h1 class="md-h1">$1</h1>');

    // Horizontal rule
    text = text.replace(/^---+$/gm, '<hr class="md-hr">');

    // Bold / Italic
    text = text.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*([^*\n]+)\*\*/g,     '<strong>$1</strong>');
    text = text.replace(/__([^_\n]+)__/g,          '<strong>$1</strong>');
    text = text.replace(/\*([^*\n]+)\*/g,          '<em>$1</em>');

    // Inline code  (only single-line, no accidental multi-line capture)
    text = text.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

    // Ordered list  (must start at beginning of line)
    text = text.replace(/((?:^\d+[.)]\s.+(?:\n|$))+)/gm, match => {
        const lis = match.trim()
            .split(/\n(?=\d+[.)]\s)/)
            .map(i => `<li>${i.replace(/^\d+[.)]\s+/, '')}</li>`)
            .join('');
        return `<ol>${lis}</ol>`;
    });

    // Unordered list
    text = text.replace(/((?:^[ \t]*[-*+]\s.+(?:\n|$))+)/gm, match => {
        const lis = match.trim()
            .split(/\n(?=[ \t]*[-*+]\s)/)
            .map(i => `<li>${i.replace(/^[ \t]*[-*+]\s+/, '')}</li>`)
            .join('');
        return `<ul>${lis}</ul>`;
    });

    // ═══════════════════════════════════════════════════════════
    //  STEP 3 — Paragraph-wrap plain text blocks
    //           Skip HTML blocks and code placeholders
    // ═══════════════════════════════════════════════════════════
    text = text
        .split(/\n{2,}/)
        .map(block => {
            block = block.trim();
            if (!block) return '';
            // Already HTML
            if (/^<(h[1-6]|ul|ol|blockquote|hr|div|p)/.test(block)) return block;
            // Code block placeholder — never wrap
            if (/^%%CB\d+%%$/.test(block)) return block;
            // Block that contains a placeholder (mixed line) — emit as-is
            if (/%%CB\d+%%/.test(block)) return block;
            return `<p>${block.replace(/\n/g, '<br>')}</p>`;
        })
        .join('\n');

    // ═══════════════════════════════════════════════════════════
    //  STEP 4 — Build and inject rendered code blocks
    // ═══════════════════════════════════════════════════════════
    const langColors = {
        python: '#3572A5', javascript: '#f1e05a', js:   '#f1e05a',
        ts:     '#2b7489', typescript:  '#2b7489', java: '#b07219',
        cpp:    '#f34b7d', c:           '#555555', cs:   '#178600',
        go:     '#00ADD8', rust:        '#dea584', ruby: '#701516',
        html:   '#e34c26', css:         '#563d7c', sql:  '#336791',
        bash:   '#89e051', sh:          '#89e051', json: '#c9510c',
        xml:    '#0060ac', php:         '#4F5D95', swift:'#ffac45',
        kotlin: '#A97BFF', dart:        '#00B4AB', yaml: '#cb171e',
        r:      '#198ce7', scala:       '#c22d40', pseudocode:'#9e9e9e',
        algo:   '#9e9e9e', text:        '#888888', code: '#e53935',
    };

    codeBlocks.forEach((cb, idx) => {
        const escaped   = escapeHtml(cb.code);
        const lineCount = cb.code.split('\n').length;
        const langColor = langColors[cb.lbl] || '#e53935';

        // Line-numbered rows
        const rows = escaped.split('\n').map((line, i) =>
            `<span class="code-row">` +
            `<span class="line-num">${i + 1}</span>` +
            `<span class="line-code">${line || ' '}</span>` +
            `</span>`
        ).join('\n');

        const html =
            `<div class="code-block">` +
              `<div class="code-block-header">` +
                `<div class="code-traffic-lights">` +
                  `<span class="traffic-dot red"></span>` +
                  `<span class="traffic-dot yellow"></span>` +
                  `<span class="traffic-dot green"></span>` +
                `</div>` +
                `<span class="code-lang">` +
                  `<span class="lang-dot" style="background:${langColor};box-shadow:0 0 6px ${langColor}55;"></span>` +
                  `${cb.lblShow}` +
                `</span>` +
                `<div class="code-header-right">` +
                  `<span class="code-line-count">${lineCount} line${lineCount !== 1 ? 's' : ''}</span>` +
                  `<button class="copy-btn" onclick="copyCode('${cb.id}')" id="copybtn-${cb.id}">` +
                    `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">` +
                      `<rect x="9" y="9" width="13" height="13" rx="2"/>` +
                      `<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>` +
                    `</svg>Copy` +
                  `</button>` +
                `</div>` +
              `</div>` +
              `<div class="code-body">` +
                `<pre class="code-pre"><code id="${cb.id}" class="code-content lang-${cb.lbl}">${rows}</code></pre>` +
              `</div>` +
            `</div>`;

        text = text.replace(`%%CB${idx}%%`, html);
    });

    return text;
}

function copyCode(codeId) {
    const el = document.getElementById(codeId);
    // Extract just the code lines (not line numbers)
    const lineEls = el.querySelectorAll('.line-code');
    const text = lineEls.length
        ? Array.from(lineEls).map(s => s.textContent).join('\n')
        : el.textContent;

    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('copybtn-' + codeId);
        if (!btn) return;
        const original = btn.innerHTML;
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied!`;
        btn.style.color = '#22c55e';
        btn.style.borderColor = '#22c55e';
        setTimeout(() => {
            btn.innerHTML = original;
            btn.style.color = '';
            btn.style.borderColor = '';
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