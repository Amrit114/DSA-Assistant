// =====================================================
//  theme.js — shared across ALL pages
//  Reads/writes localStorage('dsa_theme')
// =====================================================

const THEME_KEY = 'dsa_theme';

function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'dark';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);

    // Update all toggle buttons/icons on this page
    document.querySelectorAll('[data-theme-icon]').forEach(el => {
        el.innerHTML = theme === 'light' ? moonIcon() : sunIcon();
    });
    document.querySelectorAll('[data-theme-label]').forEach(el => {
        el.textContent = theme === 'light' ? 'Dark Mode' : 'Light Mode';
    });
}

function toggleTheme() {
    applyTheme(getTheme() === 'dark' ? 'light' : 'dark');
}

function sunIcon() {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
}

function moonIcon() {
    return `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
}

// Apply immediately on page load — prevents flash
applyTheme(getTheme());