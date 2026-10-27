// Themes. Follows the OS light/dark setting until the user picks one.
// Loaded in <head> so the theme is applied before first paint.

const THEME_KEY = 'dsa_theme';
const THEMES = [
    { id: 'light',  name: 'Daylight', note: 'Clean and bright',     scheme: 'light', bg: '#ffffff', accent: '#4f46e5' },
    { id: 'dark',   name: 'Midnight', note: 'Easy on the eyes',     scheme: 'dark',  bg: '#0a0a0f', accent: '#6366f1' },
    { id: 'aurora', name: 'Aurora',   note: 'Deep teal glow',       scheme: 'dark',  bg: '#04121a', accent: '#2dd4bf' },
    { id: 'sunset', name: 'Sunset',   note: 'Warm rose and amber',  scheme: 'dark',  bg: '#140d10', accent: '#fb7185' },
    { id: 'ocean',  name: 'Ocean',    note: 'Calm sky blue',        scheme: 'light', bg: '#f5f9fc', accent: '#0369a1' },
];
const themeById = id => THEMES.find(t => t.id === id);

function getTheme() {
    try {
        const saved = localStorage.getItem(THEME_KEY);
        if (themeById(saved)) return saved;
    } catch (e) { /* storage blocked */ }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function syncThemeControls(id) {
    const theme = themeById(id);
    document.querySelectorAll('[data-theme-name]').forEach(el => { el.textContent = theme.name; });
    document.querySelectorAll('.theme-option').forEach(el => {
        el.setAttribute('aria-checked', String(el.dataset.value === id));
    });
}

function applyTheme(id, persist = true) {
    const theme = themeById(id) || THEMES[0];
    const root = document.documentElement;
    root.setAttribute('data-theme', theme.id);
    root.setAttribute('data-scheme', theme.scheme);
    if (persist) {
        try { localStorage.setItem(THEME_KEY, theme.id); } catch (e) { /* storage blocked */ }
    }
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'theme-color';
        document.head.appendChild(meta);
    }
    meta.content = theme.bg;
    syncThemeControls(theme.id);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme.id } }));
}

// Kept for older buttons: cycles through every theme.
function toggleTheme() {
    const i = THEMES.findIndex(t => t.id === getTheme());
    applyTheme(THEMES[(i + 1) % THEMES.length].id);
}

// Circle that grows from the click point in the new theme's colour.
function themeRipple(x, y, color) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)) * 2;
    const el = document.createElement('div');
    el.className = 'theme-ripple';
    el.style.cssText = `left:${x}px;top:${y}px;width:${r}px;height:${r}px;--ripple-color:${color}`;
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
}

const THEME_CHECK_SVG = '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>';

// Every [data-theme-picker] holds a [data-theme-trigger] button; this adds the menu.
function buildThemePickers() {
    document.querySelectorAll('[data-theme-picker]').forEach(picker => {
        const trigger = picker.querySelector('[data-theme-trigger]');
        const menu = document.createElement('div');
        menu.className = 'theme-menu';
        menu.setAttribute('role', 'menu');
        menu.innerHTML = '<div class="theme-menu-title">Theme</div>' + THEMES.map(t => `
            <button type="button" class="theme-option" role="menuitemradio" data-value="${t.id}" aria-checked="false">
                <span class="theme-swatch" style="--sw-bg:${t.bg};--sw-accent:${t.accent}"></span>
                <span>${t.name}<small>${t.note}</small></span>${THEME_CHECK_SVG}
            </button>`).join('');
        picker.appendChild(menu);

        const setOpen = open => {
            picker.classList.toggle('open', open);
            trigger.setAttribute('aria-expanded', String(open));
            if (open) (menu.querySelector('[aria-checked="true"]') || menu.querySelector('.theme-option')).focus();
        };
        trigger.setAttribute('aria-haspopup', 'menu');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.addEventListener('click', e => { e.stopPropagation(); setOpen(!picker.classList.contains('open')); });
        menu.addEventListener('click', e => {
            const opt = e.target.closest('.theme-option');
            if (!opt) return;
            e.stopPropagation();
            const t = themeById(opt.dataset.value);
            themeRipple(e.clientX || innerWidth / 2, e.clientY || innerHeight / 2, t.accent);
            applyTheme(t.id);
            setOpen(false);
            trigger.focus();
        });
        menu.addEventListener('keydown', e => {
            const opts = [...menu.querySelectorAll('.theme-option')];
            const i = opts.indexOf(document.activeElement);
            if (e.key === 'ArrowDown') { e.preventDefault(); opts[(i + 1) % opts.length].focus(); }
            if (e.key === 'ArrowUp')   { e.preventDefault(); opts[(i - 1 + opts.length) % opts.length].focus(); }
            if (e.key === 'Escape')    { setOpen(false); trigger.focus(); }
        });
    });
    document.addEventListener('click', () => {
        document.querySelectorAll('[data-theme-picker].open').forEach(p => {
            p.classList.remove('open');
            p.querySelector('[data-theme-trigger]').setAttribute('aria-expanded', 'false');
        });
    });
    syncThemeControls(getTheme());
}

applyTheme(getTheme(), false);
document.addEventListener('DOMContentLoaded', buildThemePickers);
