// =====================================================
//  DSA ASSISTANT — script.js
//  Chat UI · session history · answer rendering · PDF upload
// =====================================================

// Auth is the Flask session cookie, sent automatically with same-origin fetches.
const HEADERS = {
    'Content-Type': 'application/json'
};

// ── State ──────────────────────────────────────────
let currentSessionId = null;
let allSessions = [];
// A question keeps running when the user switches chats. Each open question is a "job"
// keyed by its chat: the session id, or a draft key for a brand-new chat with no id yet.
let draftSeq = 1;
let draftKey = 'draft-1';
let viewToken = 0;                 // bumps on every chat switch so late fetches can tell
const jobs = new Map();            // viewKey -> { question, sessionId, title, loadingId }
const viewKey = () => currentSessionId || draftKey;

// ── DOM refs ───────────────────────────────────────
const chatContainer = document.getElementById('chatContainer');
const emptyState    = document.getElementById('emptyState');
const questionInput = document.getElementById('questionInput');
const sendButton    = document.getElementById('sendButton');
const sessionsList  = document.getElementById('sessionsList');
const toastEl       = document.getElementById('toast');
const chatArea      = document.getElementById('chatArea');
const scrollBtn     = document.getElementById('scrollBottomBtn');
const composer      = document.getElementById('inputShell');
const topbarTitle   = document.getElementById('topbarTitle');

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const LOGO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="5.5" r="2.2"/><circle cx="6.5" cy="18" r="2.2"/><circle cx="17.5" cy="18" r="2.2"/><path d="M11 7.6 7.5 15.9M13 7.6l3.5 8.3"/></svg>';
const COPY_SVG  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';
const BOOK_SVG  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>';

// =====================================================
//  THEME — handled by /static/theme.js
// =====================================================
function loadTheme() {
    applyTheme(getTheme(), false);
}

// =====================================================
//  SIDEBAR
// =====================================================
function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
    document.getElementById('sidebarOverlay').classList.toggle('show');
}

function toggleSidebarCollapse() {
    const collapsed = document.getElementById('sidebar').classList.toggle('collapsed');
    try { localStorage.setItem('sidebarCollapsed', collapsed ? '1' : '0'); } catch (e) { /* storage blocked */ }
}

// Restore sidebar collapse state on load
(function () {
    try {
        if (localStorage.getItem('sidebarCollapsed') === '1') document.getElementById('sidebar').classList.add('collapsed');
    } catch (e) { /* storage blocked */ }
})();

function closeSidebarMobile() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('show');
    }
}

// Expands the rail (if collapsed) and focuses chat search.
function openSearch() {
    const sidebar = document.getElementById('sidebar');
    const wasCollapsed = sidebar.classList.contains('collapsed');
    if (wasCollapsed) toggleSidebarCollapse();
    const input = document.getElementById('searchInput');
    setTimeout(() => { input.focus(); input.select(); }, wasCollapsed ? 250 : 0);
}

// ── Global Keyboard Shortcuts ──────────────────────
document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        openSearch();
    }
    if (e.key === 'Escape') {
        const modal = document.getElementById('pdfModalOverlay');
        if (modal && modal.classList.contains('open')) closeUploadModal();
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
    const active = allSessions.find(s => s.id === currentSessionId);
    const draftJob = !currentSessionId && jobs.get(draftKey);
    setTopbarTitle(active ? active.title : draftJob ? draftJob.title : 'New chat');

    // New chats still waiting for their first answer have no session yet; list them on top.
    const drafts = [...jobs.entries()].filter(([, job]) => !job.sessionId);
    const draftHtml = drafts.length ? '<div class="session-group-label">In progress</div>' + drafts.map(([key, job]) => `
        <div class="session-item pending ${key === viewKey() ? 'active' : ''}" onclick="openDraft('${key}')" tabindex="0" role="button" onkeydown="if(event.key==='Enter')openDraft('${key}')">
            <div class="session-item-body">
                <div class="session-title">${escapeHtml(job.title)}</div>
                <div class="session-time">Thinking…</div>
            </div>
        </div>`).join('') : '';

    if (!sessions || sessions.length === 0) {
        if (draftHtml) { sessionsList.innerHTML = draftHtml; return; }
        const searching = document.getElementById('searchInput').value.trim();
        sessionsList.innerHTML = `
            <div class="sessions-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <p>${searching ? 'No matching chats' : 'No conversations yet'}</p>
                <span>${searching ? 'Try a different search' : 'Your chats will appear here'}</span>
            </div>`;
        return;
    }

    const groups = groupByDate(sessions);
    let html = draftHtml;
    let i = 0;

    for (const [label, items] of Object.entries(groups)) {
        html += `<div class="session-group-label">${label}</div>`;
        for (const s of items) {
            const isActive = s.id === currentSessionId;
            const pending = jobs.has(s.id);
            const title = escapeHtml(s.title);
            html += `
                <div class="session-item ${isActive ? 'active' : ''} ${pending ? 'pending' : ''}" id="session-${s.id}" style="--i:${i++}" onclick="loadSession('${s.id}')" tabindex="0" role="button" onkeydown="if(event.key==='Enter')loadSession('${s.id}')">
                    <div class="session-item-body">
                        <div class="session-title">${title}</div>
                        <div class="session-time">${pending ? 'Thinking…' : formatTimeLabel(s.updated_at)}</div>
                    </div>
                    <div class="session-actions">
                        <button class="s-btn" onclick="renameSession(event,'${s.id}')" title="Rename" aria-label="Rename chat">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="s-btn del" onclick="deleteSession(event,'${s.id}')" title="Delete" aria-label="Delete chat">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6m4-6v6"/></svg>
                        </button>
                    </div>
                </div>`;
        }
    }

    sessionsList.innerHTML = html;
}

function setTopbarTitle(title) {
    if (!topbarTitle || topbarTitle.textContent === title) return;
    topbarTitle.textContent = title;
    topbarTitle.style.animation = 'none';
    void topbarTitle.offsetWidth;          // restart the fade-in
    topbarTitle.style.animation = '';
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
    const token = ++viewToken;

    try {
        const res = await fetch(`/api/sessions/${sessionId}`, { headers: HEADERS });
        if (token !== viewToken) return;             // user moved on while this loaded
        if (!res.ok) { showToast('Could not load this chat.', 'error'); return; }
        const data = await res.json();
        if (token !== viewToken) return;

        currentSessionId = sessionId;
        clearView();
        emptyState.style.display = 'none';

        for (const msg of data.messages) {
            renderMessage(msg.content, msg.role, false);
        }
        resumeJob(sessionId);
        syncBusyState();

        renderSessions(allSessions);
        chatArea.scrollTo({ top: chatArea.scrollHeight });
        closeSidebarMobile();
    } catch (e) {
        showToast('Failed to load chat.', 'error');
    }
}

// Re-opens a brand-new chat whose first answer is still being generated.
function openDraft(key) {
    viewToken++;
    currentSessionId = null;
    draftKey = key;
    clearView();
    emptyState.style.display = 'none';
    resumeJob(key);
    syncBusyState();
    renderSessions(allSessions);
    closeSidebarMobile();
}

// If this chat has a question in flight, show it again with its thinking indicator.
function resumeJob(key) {
    const job = jobs.get(key);
    if (!job) return;
    renderMessage(job.question, 'user', false);
    job.loadingId = showLoading();
}

function clearView() {
    Object.keys(loadingTimers).forEach(id => { clearInterval(loadingTimers[id]); delete loadingTimers[id]; });
    chatContainer.innerHTML = '';
}

// Busy = the chat on screen is waiting for an answer.
function syncBusyState() {
    const busy = jobs.has(viewKey());
    sendButton.disabled = busy;
    document.body.classList.toggle('ai-busy', busy);
    if (window.bgFx) window.bgFx.setBusy(busy);
}

// =====================================================
//  NEW CHAT
// =====================================================
function startNewChat() {
    viewToken++;
    currentSessionId = null;
    draftKey = 'draft-' + (++draftSeq);
    clearView();
    syncBusyState();
    renderSessions(allSessions);
    emptyState.style.display = 'flex';
    // replay the welcome entrance
    emptyState.querySelectorAll('.welcome > *, .suggestion').forEach(el => {
        el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    });
    questionInput.value = '';
    questionInput.style.height = 'auto';
    document.querySelectorAll('.session-item').forEach(el => el.classList.remove('active'));
    setTopbarTitle('New chat');
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
    } catch (e) { showToast('Could not delete.', 'error'); }
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
    } catch (e) { showToast('Could not rename.', 'error'); }
}

async function clearAllChats() {
    if (!confirm('Delete ALL conversation history? This cannot be undone.')) return;
    try {
        await fetch('/api/sessions', { method: 'DELETE', headers: HEADERS });
        startNewChat();
        await fetchSessions();
        showToast('All conversations cleared.', 'info');
    } catch (e) { showToast('Could not clear.', 'error'); }
}

// =====================================================
//  ASK QUESTION
// =====================================================
async function askQuestion() {
    const question = questionInput.value.trim();
    const key = viewKey();
    if (!question || jobs.has(key)) return;   // one open question per chat

    const job = {
        question,
        sessionId: currentSessionId,
        title: question.length > 60 ? question.slice(0, 60) + '…' : question,
    };
    jobs.set(key, job);

    emptyState.style.display = 'none';
    renderMessage(question, 'user');

    questionInput.value = '';
    questionInput.style.height = 'auto';
    composer.classList.add('sending');
    setTimeout(() => composer.classList.remove('sending'), 900);
    if (window.bgFx) {
        const r = composer.getBoundingClientRect();
        window.bgFx.pulse(r.left + r.width / 2, r.top);
    }

    job.loadingId = showLoading();
    syncBusyState();
    renderSessions(allSessions);

    let res = null, data = {};
    try {
        const body = { question };
        if (job.sessionId) body.session_id = job.sessionId;
        res = await fetch('/api/ask', {
            method: 'POST', headers: HEADERS,
            body: JSON.stringify(body)
        });
        data = await res.json();
    } catch (e) {
        console.error(e);
    }

    jobs.delete(key);
    const stillHere = viewKey() === key;         // the user may have switched chats meanwhile
    const ok = res && res.ok;
    if (ok && data.session_id) job.sessionId = data.session_id;

    if (stillHere) {
        removeLoading(job.loadingId);
        if (ok) {
            if (!currentSessionId) currentSessionId = data.session_id;
            renderMessage(data.answer || 'No answer returned.', 'assistant', true, true);
        } else {
            renderMessage(res ? (data.error || 'Server error. Please try again.')
                              : 'Could not reach the server. Please check your connection and try again.', 'assistant');
        }
        questionInput.focus();
    } else if (ok) {
        showToast(`Answer ready: “${job.title}”`, 'success', 7000,
            { label: 'Open', onClick: () => loadSession(job.sessionId) });
    } else {
        showToast(`Couldn't answer “${job.title}”. Please try again.`, 'error', 6000);
    }

    if (res && res.status === 401) { window.location.href = '/login'; return; }
    syncBusyState();
    await fetchSessions();
}

function askSuggestion(question) {
    questionInput.value = question;
    askQuestion();
}

// =====================================================
//  RENDER MESSAGE
//  animate=true reveals a fresh answer block by block.
// =====================================================
function renderMessage(text, role, scroll = true, animate = false) {
    const div = document.createElement('div');
    div.className = `message ${role}`;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (role === 'user') {
        div.innerHTML = `
            <div class="message-inner">
                <div class="msg-body"><div class="msg-content">${escapeHtml(text)}</div></div>
            </div>`;
    } else {
        div.innerHTML = `
            <div class="message-inner">
                <div class="ai-avatar">${LOGO_SVG}</div>
                <div class="msg-body">
                    <div class="msg-sender">DSA Assistant <span class="msg-time">${timeStr}</span></div>
                    <div class="msg-content">${formatMessage(text)}</div>
                    <div class="msg-actions">
                        <button class="msg-action" data-copy-answer>${COPY_SVG}<span>Copy</span></button>
                    </div>
                </div>
            </div>`;
        const content = div.querySelector('.msg-content');
        enhanceAnswer(content);
        div.querySelector('[data-copy-answer]').addEventListener('click', e => copyText(text, e.currentTarget));
        if (animate && !REDUCED_MOTION) streamAnswer(div, content);
    }

    chatContainer.appendChild(div);
    if (scroll) scrollBottom();
}

// Post-render polish: step lists, source chips.
function enhanceAnswer(content) {
    content.querySelectorAll(':scope > ol').forEach(ol => {
        ol.classList.add('steps');
        if (ol.start > 1) ol.style.counterReset = `step ${ol.start - 1}`;
    });

    const heading = [...content.querySelectorAll('h1, h2, h3, h4, p > strong:only-child')]
        .find(h => /^\s*sources?\s*:?\s*$/i.test(h.textContent));
    if (!heading) return;
    const block = heading.tagName === 'STRONG' ? heading.parentElement : heading;
    const list = block.nextElementSibling;
    if (!list || !/^(UL|OL)$/.test(list.tagName)) return;

    const names = [...new Set([...list.children].map(li => prettySource(li.textContent)).filter(Boolean))];
    const wrap = document.createElement('div');
    wrap.className = 'sources';
    wrap.innerHTML = `<div class="sources-title">${BOOK_SVG}Sources</div><div class="source-chips">` +
        names.map((n, i) => `<span class="source-chip" title="${escapeHtml(n)}"><b>${i + 1}</b><span>${escapeHtml(n)}</span></span>`).join('') +
        '</div>';
    block.replaceWith(wrap);
    list.remove();
}

// "Robert_Sedgewick - Algorithms (2011).pdf" → "Robert Sedgewick - Algorithms (2011)"
function prettySource(name) {
    return name.replace(/\.pdf\b/gi, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

// Streams a fresh answer in like a live chat: text is typed out block by block,
// list items / table rows / source chips appear as they are reached, code arrives line by line.
// Only one text node changes per frame, so it stays smooth on long answers.
const STREAM_CHARS_PER_MS = 0.45;   // ~450 characters per second
const CODE_LINE_COST      = 30;     // a code line "costs" as much as 30 characters

function streamAnswer(message, content) {
    const blocks = [...content.children];
    if (!blocks.length) return;

    const plan = blocks.map(el => {
        el.classList.add('seq-hidden');
        el.querySelectorAll('li, tr, .source-chip').forEach(r => r.classList.add('row-hidden'));
        const rows = el.classList.contains('code-block') ? [...el.querySelectorAll('.code-row')] : null;
        if (rows) {
            rows.forEach(r => r.classList.add('row-hidden'));
            return { el, rows, size: rows.length * CODE_LINE_COST };
        }
        const nodes = [];
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
            const n = walker.currentNode;
            if (n.data.length) { nodes.push({ n, full: n.data }); n.data = ''; }
        }
        return { el, nodes, size: nodes.reduce((s, x) => s + x.full.length, 0) };
    });
    const total = plan.reduce((s, p) => s + p.size, 0);
    // Short answers still take a moment; very long ones are capped so nobody waits too long.
    const rate = total / Math.min(Math.max(total / STREAM_CHARS_PER_MS, 900), 6500);

    message.classList.add('revealing');
    const skip = document.createElement('button');
    skip.className = 'skip-reveal';
    skip.textContent = 'Show all';
    message.querySelector('.msg-sender').appendChild(skip);

    let bi = 0, ni = 0, ri = 0, budget = 0, last = performance.now(), done = false, caretEl = null;
    const setCaret = el => {
        if (caretEl === el) return;
        if (caretEl) caretEl.classList.remove('typing-caret');
        caretEl = el;
        if (el) el.classList.add('typing-caret');
    };
    const unhide = (el, stop) => {           // show the li / tr / chip that holds this text
        for (let e = el; e && e !== stop; e = e.parentElement) e.classList.remove('row-hidden');
    };
    const finish = () => {
        if (done) return;
        done = true;
        for (const p of plan) {
            p.el.classList.remove('seq-hidden');
            p.el.querySelectorAll('.row-hidden').forEach(r => r.classList.remove('row-hidden'));
            if (p.nodes) p.nodes.forEach(x => { x.n.data = x.full; });
        }
        setCaret(null);
        message.classList.remove('revealing');
        skip.remove();
    };
    skip.addEventListener('click', e => { e.stopPropagation(); finish(); });
    content.addEventListener('click', finish, { once: true });

    const frame = now => {
        if (done) return;
        if (!message.isConnected) return finish();   // the user switched chats
        budget += (now - last) * rate;
        last = now;
        const nearBottom = chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight < 140;

        while (budget > 0 && bi < plan.length) {
            const p = plan[bi];
            if (p.el.classList.contains('seq-hidden')) {
                p.el.classList.remove('seq-hidden');
                p.el.classList.add('seq-in');
            }
            if (p.rows && ri < p.rows.length) {
                p.rows[ri++].classList.remove('row-hidden');
                budget -= CODE_LINE_COST;
                setCaret(null);
                continue;
            }
            if (p.nodes && ni < p.nodes.length) {
                const t = p.nodes[ni];
                if (!t.n.data) unhide(t.n.parentElement, p.el);
                const take = Math.min(t.full.length - t.n.data.length, Math.ceil(budget));
                t.n.data = t.full.slice(0, t.n.data.length + take);
                budget -= take;
                setCaret(t.n.parentElement);
                if (t.n.data.length === t.full.length) ni++;
                continue;
            }
            p.el.querySelectorAll('.row-hidden').forEach(r => r.classList.remove('row-hidden'));
            bi++; ni = 0; ri = 0;
        }

        if (nearBottom) chatArea.scrollTop = chatArea.scrollHeight;
        if (bi >= plan.length) return finish();
        requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
}

// =====================================================
//  LOADING — "thinking" indicator with stages
// =====================================================
const THINKING_STAGES = [
    'Understanding your question',
    'Searching the textbooks',
    'Reading the most relevant passages',
    'Writing a clear explanation',
];
const loadingTimers = {};

function showLoading() {
    const id = 'loading-' + Date.now();
    const div = document.createElement('div');
    div.className = 'message assistant thinking';
    div.id = id;
    div.innerHTML = `
        <div class="message-inner">
            <div class="ai-avatar">${LOGO_SVG}</div>
            <div class="msg-body">
                <div class="msg-sender">DSA Assistant</div>
                <div class="thinking-box" role="status" aria-live="polite">
                    <div class="thinking-stage"><span class="mini-book" aria-hidden="true"><i></i><i></i></span><span class="stage-text">${THINKING_STAGES[0]}…</span><span class="elapsed">0s</span></div>
                    <div class="thinking-steps">${THINKING_STAGES.map((_, i) => `<span class="${i === 0 ? 'active' : ''}"></span>`).join('')}</div>
                    <div class="skeleton"><i></i><i></i><i></i></div>
                </div>
            </div>
        </div>`;
    chatContainer.appendChild(div);
    scrollBottom();

    let stage = 0, seconds = 0;
    const elapsed = div.querySelector('.elapsed');
    loadingTimers[id] = setInterval(() => {
        elapsed.textContent = `${++seconds}s`;
        if (seconds % 3 || stage >= THINKING_STAGES.length - 1) return;
        stage++;
        const text = div.querySelector('.stage-text');
        text.textContent = THINKING_STAGES[stage] + '…';
        text.classList.remove('swap'); void text.offsetWidth; text.classList.add('swap');
        div.querySelectorAll('.thinking-steps span').forEach((s, i) => {
            s.className = i < stage ? 'done' : i === stage ? 'active' : '';
        });
    }, 1000);
    return id;
}

function removeLoading(id) {
    clearInterval(loadingTimers[id]);
    delete loadingTimers[id];
    const el = document.getElementById(id);
    if (el) el.remove();
}


async function ingestPDFs() {
    const btn   = document.getElementById('ingestBtn');
    const icon  = document.getElementById('ingestIcon');
    const label = document.getElementById('ingestLabel');

    btn.disabled = true;
    icon.classList.add('spinning');
    label.textContent = 'Indexing…';
    showToast('Indexing the PDF library…', 'info', 3500);

    try {
        const res  = await fetch('/api/ingest', { method: 'POST', headers: HEADERS });
        const data = await res.json();
        if (res.ok) showToast('Library indexed and ready.', 'success', 4000);
        else        showToast(data.error || 'Indexing failed.', 'error', 4000);
    } catch (e) {
        showToast('Server unreachable. Please try again.', 'error', 4000);
    }

    btn.disabled = false;
    icon.classList.remove('spinning');
    label.textContent = 'Index PDFs';
}


let toastTimer = null;
// action: optional { label, onClick } shown as a button inside the toast
function showToast(message, type = 'info', duration = 3000, action = null) {
    toastEl.textContent = message;
    toastEl.className = `toast ${type} show${action ? ' has-action' : ''}`;
    if (action) {
        const btn = document.createElement('button');
        btn.className = 'toast-action';
        btn.textContent = action.label;
        btn.addEventListener('click', () => { toastEl.classList.remove('show'); action.onClick(); });
        toastEl.appendChild(btn);
    }
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}


questionInput.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 200) + 'px';
});

function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        askQuestion();
    }
}

// Spotlight that follows the cursor on suggestion cards
document.querySelectorAll('.suggestion').forEach((card, i) => {
    card.style.setProperty('--i', i);
    card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
});


// ══════════════════════════════════════════════════════════════
//  PDF UPLOAD MODAL
// ══════════════════════════════════════════════════════════════

let _selectedPdfFile = null;
// The upload result replaces the footer; reset restores the original buttons.
const _pdfFooterHtml = document.getElementById('pdfModalFooter').innerHTML;

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
    document.getElementById('pdfModalFooter').innerHTML = _pdfFooterHtml;
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
        showToast('Only PDF files are accepted', 'error', 3000);
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

    document.getElementById('pdfDropZone').style.display    = 'none';
    document.getElementById('pdfFilePreview').style.display = 'none';
    document.getElementById('pdfProgress').style.display    = 'block';
    document.getElementById('pdfModalFooter').style.display = 'none';
    document.getElementById('pdfResult').style.display      = 'none';

    const bar   = document.getElementById('pdfProgressBar');
    const pct   = document.getElementById('pdfProgressPct');
    const label = document.getElementById('pdfProgressLabel');
    const sub   = document.getElementById('pdfProgressSub');

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

    // Simulate indexing progress (40%-92%) while the server embeds chunks
    let fakeP = 40;
    let fakeInterval;

    xhr.upload.addEventListener('load', () => {
        label.textContent = 'Indexing into vector database…';
        sub.textContent   = 'Embedding chunks — this may take a minute…';
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
                            ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'
                            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
                        }
                    </div>
                    <p class="pdf-result-title">${isAlready ? 'Already in your library' : 'Textbook indexed'}</p>
                    <p class="pdf-result-msg">${escapeHtml(data.message)}</p>
                    ${data.chunks ? `<div class="pdf-result-stats">
                        <span>${data.chunks} chunks stored</span>
                        <span>${data.total_time}s total</span>
                        <span>${data.embed_time}s embedding</span>
                    </div>` : ''}
                `;
                showToast(isAlready ? 'Already indexed' : `${data.filename} indexed`, isAlready ? 'info' : 'success', 4000);
            } else {
                resultEl.innerHTML = `
                    <div class="pdf-result-icon error">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    </div>
                    <p class="pdf-result-title">Upload failed</p>
                    <p class="pdf-result-msg">${escapeHtml(data.error || 'Unknown error occurred.')}</p>
                `;
                showToast('Upload failed: ' + (data.error || 'Unknown'), 'error', 4000);
            }
        } catch {
            resultEl.innerHTML = '<p class="pdf-result-msg">Unexpected server response.</p>';
        }

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
            <div class="pdf-result-icon error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></div>
            <p class="pdf-result-title">Network error</p>
            <p class="pdf-result-msg">Could not reach the server. Check your connection.</p>
        `;
        document.getElementById('pdfModalFooter').innerHTML =
            '<button class="pdf-btn-primary" onclick="closeUploadModal()">Close</button>';
        document.getElementById('pdfModalFooter').style.display = 'flex';
        showToast('Network error during upload', 'error', 4000);
    });

    xhr.open('POST', '/api/upload-pdf');
    xhr.send(formData);
}


function scrollBottom() {
    chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: REDUCED_MOTION ? 'auto' : 'smooth' });
    if (scrollBtn) scrollBtn.classList.remove('visible');
}

/* Show/hide scroll-to-bottom button based on scroll position */
chatArea.addEventListener('scroll', () => {
    if (!scrollBtn) return;
    const distFromBottom = chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight;
    scrollBtn.classList.toggle('visible', distFromBottom > 120);
});


// =====================================================
//  MARKDOWN → HTML
//  Text is escaped first; only the markup below is turned into tags.
// =====================================================
function formatMessage(text) {
    const codeBlocks = [];

    // Answers sometimes arrive wrapped in a ```markdown fence — unwrap it.
    text = text.replace(/\r\n/g, '\n');
    const wrapped = text.match(/^\s*```(?:markdown|md)\s*\n([\s\S]*?)\n```\s*$/i);
    if (wrapped) text = wrapped[1];
    text = text.replace(/^```(?:markdown|md)\s*\n?/gim, '');

    // 1. Pull fenced code blocks out so nothing inside them is treated as markdown.
    text = text.replace(/```([\w+#-]*)[^\n]*\n?([\s\S]*?)```/g, (_, lang, code) => {
        codeBlocks.push({ lang: (lang || '').toLowerCase(), code: code.replace(/\t/g, '    ').trimEnd() });
        return '\n\n%%CB' + (codeBlocks.length - 1) + '%%\n\n';
    });

    // The answer can echo PDF text or user input — escape it before turning markdown into HTML.
    text = escapeHtml(text);

    // "* item" bullets → "- item" so the italic rule below can't pair them up.
    text = text.replace(/^(\s*)\*\s+/gm, '$1- ');

    // 2. Inline formatting
    text = text.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    text = text.replace(/\*\*([^*\n]+)\*\*/g,     '<strong>$1</strong>');
    text = text.replace(/__([^_\n]+)__/g,          '<strong>$1</strong>');
    text = text.replace(/(^|[^\w*])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');
    text = text.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

    // 3. Block elements
    text = text.replace(/^#### (.+)$/gm, '\n<h4>$1</h4>\n');
    text = text.replace(/^### (.+)$/gm,  '\n<h3>$1</h3>\n');
    text = text.replace(/^## (.+)$/gm,   '\n<h2>$1</h2>\n');
    text = text.replace(/^# (.+)$/gm,    '\n<h1>$1</h1>\n');
    text = text.replace(/((?:^\|.*\|[ \t]*(?:\n|$))+)/gm, block => '\n\n' + renderTable(block) + '\n\n');
    text = text.replace(/^(?:-{3,}|\*{3,}|_{3,})\s*$/gm, '\n<hr>\n');
    text = text.replace(/((?:^&gt; ?.*(?:\n|$))+)/gm, block =>
        '\n\n<blockquote><p>' + block.trim().split('\n').map(l => l.replace(/^&gt; ?/, '')).join('<br>') + '</p></blockquote>\n\n');
    text = renderLists(text);

    // 4. Paragraphs — anything that isn't already a block element
    text = text
        .split(/\n{2,}/)
        .map(block => {
            block = block.trim();
            if (!block) return '';
            if (/^<(h[1-6]|ul|ol|blockquote|hr|div|table|p)\b/.test(block)) return block;
            if (/^%%CB\d+%%$/.test(block)) return block;
            return `<p>${block.replace(/\n/g, '<br>')}</p>`;
        })
        .join('\n');

    // 5. Code blocks back in
    codeBlocks.forEach((cb, idx) => {
        text = text.replace(`%%CB${idx}%%`, () => buildCodeBlock(cb.code, cb.lang));
    });
    return text;
}

// Markdown table (already escaped) → HTML table. Returns the input unchanged if it isn't one.
function renderTable(block) {
    const rows = block.trim().split('\n');
    const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    if (rows.length < 2 || !/^\|?[\s:|-]+\|?$/.test(rows[1].trim()) || !rows[1].includes('-')) return block;
    const head = cells(rows[0]).map(c => `<th>${c}</th>`).join('');
    const body = rows.slice(2).map(r => '<tr>' + cells(r).map(c => `<td>${c}</td>`).join('') + '</tr>').join('');
    return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

// Line-based list parser: nested lists by indentation, numbering kept across interruptions.
function renderLists(text) {
    const itemRe = /^(\s*)([-+]|\d+[.)])\s+(.*)$/;
    const lines = text.split('\n');
    const out = [];
    let i = 0;
    while (i < lines.length) {
        if (!itemRe.test(lines[i])) { out.push(lines[i++]); continue; }
        const block = [];
        while (i < lines.length) {
            const line = lines[i];
            if (itemRe.test(line) || (/^\s+\S/.test(line) && !/^\s*</.test(line))) { block.push(line); i++; continue; }
            // a blank line inside a list is fine if the list carries on after it
            if (!line.trim() && i + 1 < lines.length && (itemRe.test(lines[i + 1]) || /^\s+\S/.test(lines[i + 1]))) { i++; continue; }
            break;
        }
        out.push('\n' + buildList(block, itemRe) + '\n');
    }
    return out.join('\n');
}

function buildList(block, itemRe) {
    const root = { indent: -1, children: [] };
    const stack = [root];
    for (const line of block) {
        const m = line.match(itemRe);
        if (!m) { stack[stack.length - 1].text += ' ' + line.trim(); continue; }
        const indent = m[1].replace(/\t/g, '    ').length;
        while (stack.length > 1 && indent <= stack[stack.length - 1].indent) stack.pop();
        const item = { indent, ordered: /\d/.test(m[2]), start: parseInt(m[2], 10) || 1, text: m[3], children: [] };
        stack[stack.length - 1].children.push(item);
        stack.push(item);
    }
    const render = items => {
        let html = '';
        for (let k = 0; k < items.length;) {
            const ordered = items[k].ordered;
            const group = [];
            while (k < items.length && items[k].ordered === ordered) group.push(items[k++]);
            const tag = ordered ? 'ol' : 'ul';
            const start = ordered && group[0].start > 1 ? ` start="${group[0].start}"` : '';
            html += `<${tag}${start}>` + group.map(it => `<li>${it.text}${it.children.length ? render(it.children) : ''}</li>`).join('') + `</${tag}>`;
        }
        return html;
    };
    return render(root.children);
}

// =====================================================
//  CODE BLOCKS + LIGHTWEIGHT SYNTAX HIGHLIGHTING
// =====================================================
const LANG_NAMES = {
    cpp: 'C++', 'c++': 'C++', c: 'C', cs: 'C#', csharp: 'C#', java: 'Java', py: 'Python', python: 'Python',
    js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript', go: 'Go',
    rust: 'Rust', rb: 'Ruby', ruby: 'Ruby', kotlin: 'Kotlin', swift: 'Swift', sql: 'SQL', bash: 'Bash',
    sh: 'Shell', json: 'JSON', pseudocode: 'Pseudocode', algo: 'Pseudocode', text: 'Text', '': 'Code',
};
const LANG_COLORS = {
    python: '#3572A5', py: '#3572A5', javascript: '#f1e05a', js: '#f1e05a', ts: '#3178c6', typescript: '#3178c6',
    java: '#b07219', cpp: '#f34b7d', 'c++': '#f34b7d', c: '#a8b9cc', cs: '#178600', go: '#00ADD8', rust: '#dea584',
    ruby: '#cc342d', sql: '#e38c00', bash: '#89e051', sh: '#89e051', kotlin: '#A97BFF', swift: '#ffac45',
};
const KEYWORDS = new Set(('if else elif for while do return break continue switch case default class struct public private protected ' +
    'static void int long short float double char bool boolean byte true false null nullptr None True False def lambda import from as ' +
    'new delete this self try catch except finally throw throws raise const let var function template typename using namespace ' +
    'include auto in not and or is pass yield with extends implements interface enum final virtual override unsigned sizeof ' +
    'String string vector map set list dict tuple queue stack deque pair Node undefined async await fn mut impl pub match').split(' '));

const escHtml = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function highlightCode(code, lang) {
    const hashComments = /^(py|python|bash|sh|shell|ruby|rb|r|yaml|yml|perl)$/.test(lang);
    const re = new RegExp([
        hashComments ? '(#.*$)' : '(\\/\\/.*$)',            // 1 line comment
        '(\\/\\*.*?\\*\\/)',                                // 2 inline block comment
        '("(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\')', // 3 string
        '(\\b\\d+(?:\\.\\d+)?\\b)',                         // 4 number
        '(\\b[A-Za-z_]\\w*)(?=\\s*\\()',                    // 5 call
        '(\\b[A-Za-z_]\\w*\\b)',                            // 6 word
    ].join('|'), 'g');

    return code.split('\n').map(line => {
        let out = '', last = 0;
        line.replace(re, (m, c1, c2, str, num, call, word, idx) => {
            out += escHtml(line.slice(last, idx));
            const cls = c1 || c2 ? 'c' : str ? 's' : num ? 'n'
                      : call ? (KEYWORDS.has(call) ? 'k' : 'f')
                      : KEYWORDS.has(word) ? 'k' : '';
            out += cls ? `<span class="tok-${cls}">${escHtml(m)}</span>` : escHtml(m);
            last = idx + m.length;
            return m;
        });
        return out + escHtml(line.slice(last));
    });
}

let codeBlockSeq = 0;
function buildCodeBlock(code, lang) {
    const id = 'cb-' + (++codeBlockSeq);
    const lines = highlightCode(code, lang);
    const name = LANG_NAMES[lang] || lang.toUpperCase();
    const color = LANG_COLORS[lang] || 'var(--accent)';
    const rows = lines.map((line, i) =>
        `<span class="code-row"><span class="line-num">${i + 1}</span><span class="line-code">${line || ' '}</span></span>`
    ).join('\n');

    return `<div class="code-block">` +
        `<div class="code-block-header">` +
            `<div class="code-traffic-lights"><span class="traffic-dot"></span><span class="traffic-dot"></span><span class="traffic-dot"></span></div>` +
            `<span class="code-lang"><span class="lang-dot" style="background:${color}"></span>${escHtml(name)}</span>` +
            `<div class="code-header-right">` +
                `<span class="code-line-count">${lines.length} line${lines.length !== 1 ? 's' : ''}</span>` +
                `<button class="copy-btn" onclick="copyCode('${id}')" id="copybtn-${id}">${COPY_SVG}<span>Copy</span></button>` +
            `</div>` +
        `</div>` +
        `<div class="code-body"><pre class="code-pre"><code id="${id}" class="code-content lang-${escHtml(lang || 'code')}">${rows}</code></pre></div>` +
    `</div>`;
}

function copyCode(codeId) {
    const el = document.getElementById(codeId);
    // Just the code lines, not the line numbers
    const lineEls = el.querySelectorAll('.line-code');
    const text = lineEls.length ? Array.from(lineEls).map(s => s.textContent).join('\n') : el.textContent;
    copyText(text, document.getElementById('copybtn-' + codeId));
}

function copyText(text, btn) {
    navigator.clipboard.writeText(text).then(() => {
        if (!btn) return;
        const original = btn.innerHTML;
        btn.classList.add('copied');
        btn.innerHTML = `${CHECK_SVG}<span>Copied</span>`;
        setTimeout(() => { btn.classList.remove('copied'); btn.innerHTML = original; }, 1800);
    }).catch(() => showToast('Could not copy to clipboard.', 'error'));
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
