(function () {
    var TEST_MODE = false; // Set to true to force light mode only

    var STORAGE_KEY = 'hhh-theme';
    var root = document.documentElement;

    function systemPrefersDark() {
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    function readOverride() {
        try {
            var value = localStorage.getItem(STORAGE_KEY);
            if (value === 'dark' || value === 'light') return value;
        } catch (e) { /* ignore */ }
        return null;
    }

    function writeOverride(value) {
        try {
            if (value === null) {
                localStorage.removeItem(STORAGE_KEY);
            } else {
                localStorage.setItem(STORAGE_KEY, value);
            }
        } catch (e) { /* ignore */ }
    }

    // The device preference is the default; a stored value is a manual override.
    function preferredDark() {
        if (TEST_MODE) return false;
        var override = readOverride();
        if (override !== null) return override === 'dark';
        return systemPrefersDark();
    }

    function applyTheme(isDark) {
        root.classList.toggle('dark', isDark);
        var meta = document.querySelector('meta[name="color-scheme"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'color-scheme';
            document.head.appendChild(meta);
        }
        meta.content = isDark ? 'dark light' : 'light dark';
    }

    // Apply immediately so there is no flash of the wrong theme.
    // Defaults to the OS preference and honours a previous manual override.
    applyTheme(preferredDark());

    var ICONS = {
        moon: '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>',
        sun: '<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path stroke-linecap="round" d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>'
    };

    function iconMarkup() {
        return '<span class="hhh-theme-light">' + ICONS.moon + '</span>' +
               '<span class="hhh-theme-dark">' + ICONS.sun + '</span>';
    }

    function isDark() {
        return root.classList.contains('dark');
    }

    function syncButtons() {
        var btns = document.querySelectorAll('[data-theme-toggle]');
        for (var i = 0; i < btns.length; i++) {
            btns[i].setAttribute('aria-pressed', String(isDark()));
        }
    }

    function applyThemeChange(next) {
        applyTheme(next);
        writeOverride(next ? 'dark' : 'light');
        syncButtons();
    }

    // Manual override: remember the choice so it survives page navigations
    // and so live OS changes don't undo it.
    function toggleTheme(e) {
        if (TEST_MODE) return;
        var next = !isDark();

        // Animated, page-wide reveal spreading out from the clicked switch
        // (View Transitions API). Falls back to an instant switch elsewhere.
        if (document.startViewTransition) {
            var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (!reduced) {
                var btn = ((e && e.currentTarget) || null);
                var revealX = window.innerWidth / 2;
                var revealY = window.innerHeight / 2;
                if (btn) {
                    var rect = btn.getBoundingClientRect();
                    revealX = rect.left + rect.width / 2;
                    revealY = rect.top + rect.height / 2;
                }
                var farX = Math.max(revealX, window.innerWidth - revealX);
                var farY = Math.max(revealY, window.innerHeight - revealY);
                root.style.setProperty('--hhh-reveal-x', revealX + 'px');
                root.style.setProperty('--hhh-reveal-y', revealY + 'px');
                root.style.setProperty('--hhh-reveal-radius', Math.hypot(farX, farY) + 'px');

                document.startViewTransition(function () {
                    applyThemeChange(next);
                }).finished.then(function () {
                    root.style.removeProperty('--hhh-reveal-x');
                    root.style.removeProperty('--hhh-reveal-y');
                    root.style.removeProperty('--hhh-reveal-radius');
                }).catch(function () { /* transition skipped – vars are inert */ });
                return;
            }
        }

        applyThemeChange(next);
    }

    function makeButton(extraClass) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-theme-toggle', '');
        btn.setAttribute('aria-label', 'Toggle dark mode');
        btn.setAttribute('title', 'Toggle dark mode');
        btn.setAttribute('aria-pressed', String(isDark()));
        btn.className = 'inline-flex items-center justify-center rounded-full p-2 text-ink hover:bg-header/50 transition-colors ' + (extraClass || '');
        btn.innerHTML = iconMarkup();
        btn.addEventListener('click', toggleTheme);
        return btn;
    }

    function init() {
        var added = false;

        // Desktop navigation.
        var desktopNav = document.querySelector('nav .md\\:flex') || document.querySelector('nav div.flex.space-x-4');
        if (desktopNav) {
            desktopNav.appendChild(makeButton('ml-2'));
            added = true;
        }

        // Mobile dropdown menu.
        var mobileInner = document.querySelector('#mobileMenu > div');
        if (mobileInner) {
            var row = document.createElement('div');
            row.className = 'py-2 flex items-center justify-between';
            var label = document.createElement('span');
            label.textContent = 'Dark mode';
            row.appendChild(label);
            row.appendChild(makeButton(''));
            mobileInner.appendChild(row);
            added = true;
        }

        // Fallback for pages without a standard navigation.
        if (!added && document.body) {
            var floatBtn = makeButton('');
            floatBtn.classList.add('fixed', 'top-20', 'right-6', 'z-50', 'bg-white/90', 'shadow-lg', 'border', 'border-header');
            document.body.appendChild(floatBtn);
        }

        syncButtons();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Follow the OS preference live, but only while the user has not
    // manually overridden it.
    if (window.matchMedia) {
        try {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
                if (TEST_MODE) return;
                if (readOverride() !== null) return; // respect the manual override
                applyTheme(e.matches);
                syncButtons();
            });
        } catch (e) { /* older browsers */ }
    }
})();