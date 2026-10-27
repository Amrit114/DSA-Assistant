

const THEME_KEY = 'dsa_theme';

function getThemeOrder() {
    return ['midnight', 'dawn', 'ocean', 'arctic'];
}

function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'midnight';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);

    const iconFn = themeIconMap[theme] || moonIcon;

    document.querySelectorAll('[data-theme-icon]').forEach(el => {
        el.innerHTML = iconFn();
    });
    document.querySelectorAll('[data-theme-label]').forEach(el => {
        el.textContent = theme.charAt(0).toUpperCase() + theme.slice(1);
    });

    // Sync theme dots on any page
    document.querySelectorAll('[data-theme-value]').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-theme-value') === theme);
    });
    document.querySelectorAll('.theme-dot, .tdot').forEach(el => {
        const val = el.getAttribute('data-theme-value') || (el.getAttribute('title') || '').toLowerCase();
        el.classList.toggle('active', val === theme);
    });

    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

function toggleTheme() {
    const order = getThemeOrder();
    const current = getTheme();
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    applyTheme(next);
}

/* ── Theme Icon SVGs (16×16 display, 24×24 viewBox, stroke-based) ── */

function moonIcon() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}

function sunIcon() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
}

function waveIcon() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/><path d="M2 7c2-3 4-3 6 0s4 3 6 0 4-3 6 0"/></svg>`;
}

function snowflakeIcon() {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="4.93" y2="19.07"/><polyline points="9 2 12 5 15 2"/><polyline points="9 22 12 19 15 22"/><polyline points="2 9 5 12 2 15"/><polyline points="22 9 19 12 22 15"/></svg>`;
}

const themeIconMap = {
    midnight:  moonIcon,
    dawn:      sunIcon,
    ocean:     waveIcon,
    arctic:    snowflakeIcon
};

applyTheme(getTheme());
