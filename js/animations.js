(function () {
    'use strict';

    // URL of this very script, so the sibling glyph data (glyphs.js) can be
    // located no matter which folder the page lives in.
    var SELF_SRC = (function () {
        try {
            if (document.currentScript && document.currentScript.src) return document.currentScript.src;
            var scripts = document.getElementsByTagName('script');
            for (var i = scripts.length - 1; i >= 0; i--) {
                if (/\/animations\.js(\?|$)/.test(scripts[i].src)) return scripts[i].src;
            }
        } catch (e) { /* ignore */ }
        return '';
    })();

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
        // Headings & hero copy. Hero titles are handled by the "writing"
        // module below, so leave them to it.
        $$('main h1, section h1, section h2').forEach(function (el, i) {
            if (el.closest('[data-hhh-noanim]')) return;
            if (el.closest('section.bg-hero')) return;
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
       Handwritten hero titles
       Draws the real glyph outlines of the custom font, one
       letter at a time, so the title is "written in" live.
       -------------------------------------------------------- */
    var HHH_GLYPHS_URL = resolveAsset('glyphs.js');
    var HHH_MASK_SEQ = 0;

    function resolveAsset(rel) {
        try { return new URL(rel, SELF_SRC || window.location.href).href; }
        catch (e) { return rel; }
    }

    function glyphAdvance(data, ch, fontSize) {
        var upm = data.unitsPerEm || 1000;
        var g = data.glyphs[ch];
        var a = (g && typeof g.a === 'number') ? g.a : upm * 0.5;
        return a * fontSize / upm;
    }

    function loadScript(src, onload, onerror) {
        var s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = onload;
        s.onerror = onerror || function () {};
        document.head.appendChild(s);
    }

    function debounce(fn, wait) {
        var t;
        return function () {
            var ctx = this, args = arguments;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(ctx, args); }, wait);
        };
    }

    function heroTitles() {
        return $$('section.bg-hero h1, section.bg-hero h2').filter(function (el) {
            return !el.closest('[data-hhh-noanim]');
        });
    }

    // Turn the title's DOM into paragraphs of styled runs.
    function parseTitleRuns(el) {
        var paragraphs = [[]];
        var para = paragraphs[0];

        function walk(node, style) {
            if (node.nodeType === 3) {
                if (node.nodeValue) {
                    para.push({ text: node.nodeValue, italic: style.italic, color: style.color });
                }
                return;
            }
            if (node.nodeType !== 1) return;
            if (node.tagName === 'BR') { para = []; paragraphs.push(para); return; }
            var cs = getComputedStyle(node);
            var next = {
                italic: cs.fontStyle === 'italic' || cs.fontStyle === 'oblique',
                color: cs.color
            };
            for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i], next);
        }

        var base = getComputedStyle(el);
        var baseStyle = {
            italic: base.fontStyle === 'italic' || base.fontStyle === 'oblique',
            color: base.color
        };
        for (var i = 0; i < el.childNodes.length; i++) walk(el.childNodes[i], baseStyle);
        return paragraphs;
    }

    function tokenize(data, para, fontSize) {
        var spaceW = glyphAdvance(data, ' ', fontSize);
        var items = [];
        var word = [];

        function wordWidth(chars) {
            var w = 0;
            for (var i = 0; i < chars.length; i++) w += glyphAdvance(data, chars[i].ch, fontSize);
            return w;
        }

        function flush() {
            if (!word.length) return;
            items.push({ type: 'word', chars: word, width: wordWidth(word) });
            word = [];
        }

        for (var r = 0; r < para.length; r++) {
            var run = para[r], text = run.text;
            for (var i = 0; i < text.length; i++) {
                var ch = text.charAt(i);
                if (ch === ' ' || ch === '\n' || ch === '\t' || ch === '\u00a0') {
                    flush();
                    if (!items.length || items[items.length - 1].type !== 'space') {
                        items.push({ type: 'space', width: spaceW });
                    }
                } else {
                    word.push({ ch: ch, italic: run.italic, color: run.color });
                }
            }
        }
        flush();
        // Strip any indentation whitespace that clung to the paragraph edges.
        while (items.length && items[0].type === 'space') items.shift();
        while (items.length && items[items.length - 1].type === 'space') items.pop();
        return items;
    }

    function wrapItems(items, maxWidth) {
        var lines = [], cur = [], curW = 0;
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (it.type === 'space') {
                if (cur.length) { cur.push(it); curW += it.width; }
                continue;
            }
            if (cur.length && curW + it.width > maxWidth) {
                var last = cur[cur.length - 1];
                if (last && last.type === 'space') { curW -= last.width; cur.pop(); }
                lines.push(cur); cur = []; curW = 0;
            }
            cur.push(it); curW += it.width;
        }
        if (cur.length) lines.push(cur);
        return lines;
    }

    function lineWidth(line) {
        var w = 0;
        for (var i = 0; i < line.length; i++) w += line[i].width;
        var last = line[line.length - 1];
        if (last && last.type === 'space') w -= last.width;
        return w;
    }

    function renderTitleSVG(data, paragraphs, o) {
        var upm = data.unitsPerEm || 1000;
        var scale = o.fontSize / upm;
        var ascent = (data.ascender || upm * 0.8) * scale;
        var descent = Math.abs(data.descender || upm * 0.2) * scale;
        var ns = 'http://www.w3.org/2000/svg';

        var lines = [];
        for (var p = 0; p < paragraphs.length; p++) {
            var wrapped = wrapItems(tokenize(data, paragraphs[p], o.fontSize), o.maxWidth);
            for (var w = 0; w < wrapped.length; w++) lines.push(wrapped[w]);
        }

        var markup = '';
        var order = 0; // running index for the writing stagger
        var pen = upm * (o.penRatio || 0.14); // pen thickness in font units

        for (var li = 0; li < lines.length; li++) {
            var line = lines[li];
            var baseline = ascent + li * o.lineHeight;
            var lw = lineWidth(line);
            var x = o.align === 'left' ? 0 :
                (o.align === 'right' ? (o.maxWidth - lw) : (o.maxWidth - lw) / 2);

            for (var k = 0; k < line.length; k++) {
                var it = line[k];
                if (it.type === 'space') { x += it.width; continue; }
                for (var c = 0; c < it.chars.length; c++) {
                    var ch = it.chars[c];
                    var gl = data.glyphs[ch.ch];
                    if (gl && gl.d) {
                        var tr = 'translate(' + x.toFixed(2) + ' ' + baseline.toFixed(2) +
                            ') scale(' + scale.toFixed(6) + ')' + (ch.italic ? ' skewX(-14)' : '');
                        var delay = (o.baseDelay + order * o.step).toFixed(3);
                        var mid = 'hhhm' + (HHH_MASK_SEQ++);
                        // The pen only masks the solid fill, so the letter inks
                        // in as it is drawn rather than showing a hollow outline.
                        markup += '<g transform="' + tr + '">' +
                            '<mask id="' + mid + '" maskUnits="userSpaceOnUse"' +
                                ' x="-1200" y="-1600" width="3400" height="2600">' +
                                '<path class="hhh-pen" d="' + gl.d + '" stroke-width="' + pen.toFixed(1) +
                                    '" pathLength="1" stroke-dasharray="1"' +
                                    ' style="animation-delay:' + delay + 's"></path>' +
                                '<path class="hhh-close" d="' + gl.d + '"' +
                                    ' style="animation-delay:' + delay + 's"></path>' +
                            '</mask>' +
                            '<path class="hhh-ink" d="' + gl.d + '" fill="' + ch.color +
                                '" mask="url(#' + mid + ')"></path>' +
                            '</g>';
                        order++;
                    }
                    x += glyphAdvance(data, ch.ch, o.fontSize);
                }
            }
        }

        var n = lines.length || 1;
        var contentH = (n - 1) * o.lineHeight + ascent + descent;
        // Keep the original line-box height so the hero doesn't jump when the
        // real text is swapped for the traced SVG.
        var boxH = n * o.lineHeight;
        var h = Math.max(contentH, boxH, 1);
        var offsetY = (h - contentH) / 2;

        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('class', 'hhh-writer');
        svg.setAttribute('viewBox', '0 0 ' + o.maxWidth.toFixed(2) + ' ' + h.toFixed(2));
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        svg.innerHTML = '<g transform="translate(0 ' + offsetY.toFixed(2) + ')">' + markup + '</g>';
        return svg;
    }

    function buildWritingTitle(el, data, noAnim) {
        if (!el.__hhhRuns) {
            el.__hhhRuns = parseTitleRuns(el);
            var sr = document.createElement('span');
            sr.className = 'hhh-sr';
            while (el.firstChild) sr.appendChild(el.firstChild);
            el.appendChild(sr);
            el.style.position = 'relative';
        }

        var cs = getComputedStyle(el);
        var fontSize = parseFloat(cs.fontSize) || 40;
        var lineHeight = parseFloat(cs.lineHeight) || fontSize * 1.15;
        var align = cs.textAlign === 'left' ? 'left' : (cs.textAlign === 'right' ? 'right' : 'center');
        var maxWidth = el.clientWidth || el.offsetWidth || 600;

        var sig = [fontSize, Math.round(lineHeight), maxWidth, align, noAnim ? 'n' : 'a'].join('|');
        if (noAnim && el.__hhhSig === sig) return;

        var svg = renderTitleSVG(data, el.__hhhRuns, {
            fontSize: fontSize,
            maxWidth: maxWidth,
            lineHeight: lineHeight,
            align: align,
            step: 0.055,
            baseDelay: 0.05
        });

        var old = el.querySelector('.hhh-writer');
        if (old && old.parentNode) old.parentNode.removeChild(old);

        if (noAnim) svg.classList.add('hhh-static');

        el.appendChild(svg);
        el.__hhhSig = sig;
    }

    function initWriting() {
        var titles = heroTitles();
        if (!titles.length) return;

        function fallback() {
            titles.forEach(function (el) { reveal(el, { dir: 'up' }); });
        }

        function ready(data) {
            titles.forEach(function (el) {
                try { buildWritingTitle(el, data, false); }
                catch (e) { reveal(el, { dir: 'up' }); }
            });
            var relayout = debounce(function () {
                titles.forEach(function (el) {
                    try { buildWritingTitle(el, data, true); } catch (e) {}
                });
            }, 250);
            window.addEventListener('resize', relayout);
            window.addEventListener('orientationchange', relayout);
        }

        loadScript(HHH_GLYPHS_URL, function () {
            if (!window.HHH_GLYPHS || !window.HHH_GLYPHS.glyphs) { fallback(); return; }
            ready(window.HHH_GLYPHS);
        }, fallback);
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
        try { initWriting(); } catch (e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Re-scan if product grids fill in later (defensive, in addition to the MO).
    window.addEventListener('load', function () { try { initGrids(); } catch (e) {} });
})();
