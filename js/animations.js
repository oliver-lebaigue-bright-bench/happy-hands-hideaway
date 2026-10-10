(function () {
    'use strict';

    var root = document.documentElement;
    var prefersReduced = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Tell the CSS it is safe to hide reveal elements.
    root.classList.add('hhh-anim-ready');

    if (prefersReduced) {
        // Nothing else to do – CSS already neutralises everything.
        return;
    }

    var supportsIO = 'IntersectionObserver' in window;
    var isTouch = window.matchMedia && window.matchMedia('(hover: none)').matches;

    /* --------------------------------------------------------
       Helpers
       -------------------------------------------------------- */
    function $(sel, ctx) { return (ctx || document).querySelector(sel); }
    function $$(sel, ctx) {
        return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
    }
    function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

    /* --------------------------------------------------------
       Scroll reveal
       -------------------------------------------------------- */
    var revealObserver = supportsIO ? new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            var el = entry.target;
            el.classList.add('hhh-in');
            el.classList.add('revealed'); // keeps older page scripts happy
            revealObserver.unobserve(el);
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }) : null;

    function reveal(el, opts) {
        if (!el || el.dataset.hhhBound === '1') return;
        opts = opts || {};
        el.dataset.hhhBound = '1';

        if (!el.classList.contains('scroll-reveal')) {
            el.classList.add('hhh-reveal');
        }
        el.dataset.hhh = opts.dir || 'up';
        if (opts.delay) el.style.setProperty('--hhh-reveal-delay', opts.delay + 'ms');

        if (revealObserver) {
            revealObserver.observe(el);
        } else {
            el.classList.add('hhh-in', 'revealed');
        }
    }

    /* --------------------------------------------------------
       Auto-tag page furniture
       -------------------------------------------------------- */
    function tagStatic() {
        // Headings & hero copy.
        $$('main h1, section h1, section h2').forEach(function (el, i) {
            if (el.closest('[data-hhh-noanim]')) return;
            reveal(el, { dir: 'up', delay: i * 60 });
        });
        $$('section h3').forEach(function (el) { reveal(el, { dir: 'up' }); });

        // Shop category cards.
        $$('a.group.block').forEach(function (el) { reveal(el, { dir: 'up' }); });

        // Generic "card" surfaces (events, feature blocks, etc.).
        $$('section .rounded-2xl').forEach(function (el) {
            if (el.classList.contains('hhh-reveal') || el.classList.contains('scroll-reveal')) return;
            if (el.closest('[data-hhh-noanim]')) return;
            // skip cards nested inside an already-animated card / the big wrappers
            if (el.closest('a.group.block')) return;
            if (el.closest('.hhh-reveal')) return;
            if (el.querySelector('.rounded-2xl')) return;
            reveal(el, { dir: 'up' });
        });

        // Social cards.
        $$('.social-card').forEach(function (el, i) {
            reveal(el, { dir: 'left', delay: i * 90 });
            el.classList.add('hhh-hover-lift');
        });

        // Media.
        $$('section img, main img').forEach(function (img) {
            if (img.classList.contains('hero-flower-left') ||
                img.classList.contains('hero-flower-right') ||
                img.classList.contains('logo-card') ||
                img.closest('.logo-card')) return;
            if (img.closest('[data-hhh-noanim]')) return;
            reveal(img, { dir: 'zoom' });
        });

        // Existing scroll-reveal markup.
        $$('.scroll-reveal').forEach(function (el) { reveal(el, { dir: 'up' }); });

        // Buttons / CTAs.
        $$('a.rounded-full, button.rounded-full, .add-to-basket').forEach(function (el) {
            el.classList.add('hhh-hover-pop');
            if (!el.classList.contains('hhh-hover-play')) el.classList.add('hhh-sheen');
        });
    }

    /* --------------------------------------------------------
       Dynamic content (product cards load from Firebase)
       -------------------------------------------------------- */
    function tagGrid(grid) {
        if (!grid) return;
        Array.prototype.slice.call(grid.children).forEach(function (card, i) {
            reveal(card, { dir: 'up', delay: Math.min(i * 70, 480) });
            card.classList.add('hhh-hover-lift');
            if (!isTouch) card.classList.add('hhh-tilt');
        });
    }

    function initGrids() {
        $$('#productsGrid, .grid').forEach(function (grid) { tagGrid(grid); });
    }

    var mo = null;
    function initMutationObserver() {
        if (!('MutationObserver' in window)) return;
        mo = new MutationObserver(function (mutations) {
            var grids = [];
            mutations.forEach(function (m) {
                Array.prototype.slice.call(m.addedNodes).forEach(function (node) {
                    if (node.nodeType !== 1) return;

                    // A product grid got filled.
                    if (node.id === 'productsGrid' || node.classList && node.classList.contains('grid')) {
                        grids.push(node);
                    }
                    // New cards were added straight into an existing grid.
                    if (node.parentElement && (node.parentElement.id === 'productsGrid' ||
                        node.parentElement.classList && node.parentElement.classList.contains('grid'))) {
                        grids.push(node.parentElement);
                    }
                    // Buttons in freshly injected markup.
                    if (node.classList) {
                        if (node.matches && node.matches('a.rounded-full, button, .add-to-basket')) {
                            node.classList.add('hhh-hover-pop');
                        }
                        $$('a.rounded-full, .add-to-basket', node).forEach(function (b) {
                            b.classList.add('hhh-hover-pop');
                        });
                    }
                });
            });
            grids = grids.filter(function (g, i) { return grids.indexOf(g) === i; });
            grids.forEach(tagGrid);
        });
        mo.observe(document.body, { childList: true, subtree: true });
    }

    /* --------------------------------------------------------
       Animated counters (the "Quick Stats" numbers)
       -------------------------------------------------------- */
    function initCounters() {
        var nodes = $$('[data-hhh-count], p.text-2xl.font-bold, p.text-2xl.font-bold.text-accent');
        nodes.forEach(function (el) {
            if (el.dataset.hhhCountBound === '1') return;
            var text = (el.textContent || '').trim();
            var match = text.match(/^(\d+)(.*)$/);
            if (!match) return;
            el.dataset.hhhCountBound = '1';
            var target = parseInt(match[1], 10);
            var suffix = match[2] || '';

            function run() {
                var start = null;
                var dur = 1200;
                function tick(ts) {
                    if (start === null) start = ts;
                    var p = clamp((ts - start) / dur, 0, 1);
                    // easeOutCubic
                    var eased = 1 - Math.pow(1 - p, 3);
                    el.textContent = Math.round(target * eased) + suffix;
                    if (p < 1) requestAnimationFrame(tick);
                    else el.textContent = target + suffix;
                }
                requestAnimationFrame(tick);
            }

            if (revealObserver) {
                var co = new IntersectionObserver(function (entries) {
                    entries.forEach(function (e) {
                        if (e.isIntersecting) { run(); co.disconnect(); }
                    });
                }, { threshold: 0.4 });
                co.observe(el);
            } else {
                run();
            }
        });
    }

    /* --------------------------------------------------------
       Button ripples
       -------------------------------------------------------- */
    function initRipples() {
        document.addEventListener('pointerdown', function (e) {
            var el = e.target.closest && e.target.closest('a.rounded-full, button.rounded-full, .add-to-basket, .hhh-ripple');
            if (!el) return;
            el.classList.add('hhh-ripple');
            var rect = el.getBoundingClientRect();
            var size = Math.max(rect.width, rect.height);
            var span = document.createElement('span');
            span.className = 'hhh-ripple-circle';
            span.style.width = span.style.height = size + 'px';
            span.style.left = (e.clientX - rect.left - size / 2) + 'px';
            span.style.top = (e.clientY - rect.top - size / 2) + 'px';
            el.appendChild(span);
            setTimeout(function () { if (span.parentNode) span.parentNode.removeChild(span); }, 700);
        }, { passive: true });
    }

    /* --------------------------------------------------------
       Card 3D tilt
       -------------------------------------------------------- */
    function initTilt() {
        if (isTouch || !window.matchMedia('(pointer: fine)').matches) return;
        document.addEventListener('pointermove', function (e) {
            var card = e.target.closest && e.target.closest('.hhh-tilt');
            if (!card || !card.classList.contains('hhh-in')) return;
            var rect = card.getBoundingClientRect();
            var px = (e.clientX - rect.left) / rect.width - 0.5;
            var py = (e.clientY - rect.top) / rect.height - 0.5;
            card.style.transform = 'perspective(800px) rotateY(' + (px * 6).toFixed(2) +
                'deg) rotateX(' + (-py * 6).toFixed(2) + 'deg) translateY(-6px)';
            card.style.transition = 'transform 0.08s linear';
        }, { passive: true });
        document.addEventListener('pointerout', function (e) {
            var card = e.target.closest && e.target.closest('.hhh-tilt');
            if (!card) return;
            if (card.contains(e.relatedTarget)) return;
            card.style.transition = 'transform 0.5s cubic-bezier(0.22,1,0.36,1)';
            card.style.transform = '';
        }, { passive: true });
    }

    /* --------------------------------------------------------
       Parallax (scroll) for hero blocks
       -------------------------------------------------------- */
    function initParallax() {
        var targets = [];
        $$('section.bg-hero > .relative').forEach(function (el) {
            targets.push({ el: el, speed: 0.10 });
        });
        $$('.logo-card').forEach(function (el) {
            targets.push({ el: el, speed: -0.06 });
        });
        if (!targets.length) return;

        var ticking = false;
        function update() {
            ticking = false;
            var vh = window.innerHeight;
            targets.forEach(function (t) {
                var rect = t.el.getBoundingClientRect();
                if (rect.bottom < -100 || rect.top > vh + 100) return;
                var offset = (rect.top + rect.height / 2 - vh / 2);
                t.el.style.transform = 'translateY(' + (offset * t.speed).toFixed(2) + 'px)';
            });
        }
        window.addEventListener('scroll', function () {
            if (!ticking) { ticking = true; requestAnimationFrame(update); }
        }, { passive: true });
        update();
    }

    /* --------------------------------------------------------
       Nav polish + scroll progress + back-to-top
       -------------------------------------------------------- */
    function initChrome() {
        // Nav link underline animation.
        $$('nav a').forEach(function (a) {
            if (a.querySelector('img') || a.classList.contains('hhh-hover-underline')) return;
            a.classList.add('hhh-hover-underline');
        });
        var nav = $('nav');
        if (nav) nav.classList.add('hhh-nav-shrink');

        var progress = document.createElement('div');
        progress.id = 'hhhProgress';
        document.body.appendChild(progress);

        var toTop = document.createElement('button');
        toTop.id = 'hhhToTop';
        toTop.type = 'button';
        toTop.setAttribute('aria-label', 'Back to top');
        toTop.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
        toTop.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        document.body.appendChild(toTop);

        var ticking = false;
        function onScroll() {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
                ticking = false;
                var doc = document.documentElement;
                var max = doc.scrollHeight - window.innerHeight;
                var y = window.scrollY || window.pageYOffset;
                progress.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max, 0, 1) : 0) + ')';
                if (nav) nav.classList.toggle('hhh-scrolled', y > 12);
                toTop.classList.toggle('hhh-show', y > 400);
            });
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* --------------------------------------------------------
       Gentle page transitions on internal links
       -------------------------------------------------------- */
    function initPageTransitions() {
        document.addEventListener('click', function (e) {
            var a = e.target.closest && e.target.closest('a');
            if (!a) return;
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            if (a.target === '_blank' || a.hasAttribute('download')) return;

            var href = a.getAttribute('href') || '';
            if (!href || href.charAt(0) === '#') return;
            if (/^(mailto:|tel:|https?:\/\/)/i.test(href) &&
                a.host && a.host !== window.location.host) return;
            if (a.host && a.host === window.location.host && a.pathname === window.location.pathname) return;

            var url;
            try { url = new URL(a.href, window.location.href); } catch (err) { return; }
            if (url.origin !== window.location.origin) return;
            if (url.pathname === window.location.pathname && url.search === window.location.search) return;

            e.preventDefault();
            document.body.style.transition = 'opacity 0.22s ease';
            document.body.style.opacity = '0';
            setTimeout(function () { window.location.href = a.href; }, 200);
        });
    }

    /* --------------------------------------------------------
       Boot
       -------------------------------------------------------- */
    function init() {
        try { tagStatic(); } catch (e) { /* never block the page */ }
        try { initGrids(); } catch (e) {}
        try { initMutationObserver(); } catch (e) {}
        try { initCounters(); } catch (e) {}
        try { initRipples(); } catch (e) {}
        try { initTilt(); } catch (e) {}
        try { initParallax(); } catch (e) {}
        try { initChrome(); } catch (e) {}
        try { initPageTransitions(); } catch (e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Re-scan if product grids fill in later (defensive, in addition to the MO).
    window.addEventListener('load', function () { try { initGrids(); } catch (e) {} });
})();
