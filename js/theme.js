(function () {
    var TEST_MODE = false; // Set to true to force light mode only

    var root = document.documentElement;

    function systemPrefersDark() {
        return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }

    function applyTheme(isDark) {
        var effectiveDark = TEST_MODE ? false : isDark;
        root.classList.toggle('dark', effectiveDark);
        var meta = document.querySelector('meta[name="color-scheme"]');
        if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'color-scheme';
            document.head.appendChild(meta);
        }
        meta.content = effectiveDark ? 'dark light' : 'light dark';
    }

    // Apply immediately so there is no flash of the wrong theme.
    // Always follow the OS preference. A previously saved toggle (localStorage)
    // must never stick the site in dark mode on a light-mode device, so the
    // manual toggle below is a temporary override for the current page only.
    applyTheme(TEST_MODE ? false : systemPrefersDark());

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

    function toggleTheme() {
        if (TEST_MODE) return; // Prevent manual toggling while test mode is active
        applyTheme(!isDark());
        syncButtons();
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

    // Follow the OS preference live, so the site changes with the system.
    if (window.matchMedia) {
        try {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
                if (!TEST_MODE) {
                    applyTheme(e.matches);
                    syncButtons();
                }
            });
        } catch (e) { /* older browsers */ }
    }
})();