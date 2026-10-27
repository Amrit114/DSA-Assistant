// Animated page background, shared by every page:
//  · aurora glows (CSS)
//  · a drifting graph of nodes; every few seconds a BFS traversal lights up level by level
//  · floating DSA glyphs (CSS) and a soft glow that follows the cursor
// window.bgFx.pulse(x, y)  — start a traversal from the node nearest to (x, y)
// window.bgFx.setBusy(on)  — while the AI is searching, traversals fire continuously
(function () {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer  = window.matchMedia('(pointer: fine)').matches;

    const GLYPHS = ['O(log n)', 'O(n)', '{ }', '[ ]', 'A[i]', '→', 'Σ', 'λ', 'BFS', 'DFS', 'n²', '⊕', 'log₂', 'push()', 'pop()', 'heap', 'mid'];
    const fx = document.createElement('div');
    fx.className = 'bg-fx';
    fx.setAttribute('aria-hidden', 'true');
    fx.innerHTML = '<div class="aurora"><span></span><span></span><span></span></div><canvas></canvas>' +
        '<div class="fx-glyphs">' + GLYPHS.slice(0, window.innerWidth < 700 ? 8 : GLYPHS.length).map((g, i) =>
            `<span style="--x:${(i * 61) % 100}%;--d:${22 + (i * 7) % 18}s;--delay:${-(i * 3.7) % 30}s;--s:${.75 + (i % 4) * .15}">${g}</span>`
        ).join('') + '</div>';
    document.body.prepend(fx);

    if (finePointer && !reduceMotion) {
        const glow = document.createElement('div');
        glow.className = 'fx-cursor';
        glow.setAttribute('aria-hidden', 'true');
        document.body.prepend(glow);
        let gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy, moving = false;
        const follow = () => {
            gx += (tx - gx) * .12; gy += (ty - gy) * .12;
            glow.style.transform = `translate3d(${gx - 300}px, ${gy - 300}px, 0)`;
            moving = Math.abs(tx - gx) + Math.abs(ty - gy) > .5;
            if (moving) requestAnimationFrame(follow);
        };
        window.addEventListener('pointermove', e => {
            tx = e.clientX; ty = e.clientY;
            glow.classList.add('on');
            if (!moving) { moving = true; requestAnimationFrame(follow); }
        }, { passive: true });
        document.addEventListener('pointerleave', () => glow.classList.remove('on'));
    }

    const canvas = fx.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const LINK = 150;          // max edge length (px)
    const STEP = 200;          // ms per BFS level
    const MAX_DEPTH = 4;
    const BUCKETS = 4;         // edges are batched into a few alpha levels: one stroke() per level
    let W = 0, H = 0, nodes = [], pulses = [], colors = {}, last = 0, nextPulse = 2500, busy = false;
    const pointer = { x: -1e4, y: -1e4 };

    function readColors() {
        const s = getComputedStyle(document.documentElement);
        colors = {
            accent:  s.getPropertyValue('--accent').trim() || '#6366f1',
            accent2: s.getPropertyValue('--accent-2').trim() || '#a78bfa',
            dark:    document.documentElement.dataset.scheme === 'dark',
        };
    }

    function makeNode() {
        return {
            x: Math.random() * W, y: Math.random() * H,
            vx: (Math.random() - .5) * .016, vy: (Math.random() - .5) * .016,
            r: 1.1 + Math.random() * 1.5,
        };
    }

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        W = window.innerWidth; H = window.innerHeight;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const target = Math.round(Math.min(64, Math.max(20, (W * H) / 24000)));
        while (nodes.length < target) nodes.push(makeNode());
        nodes.length = target;
        for (const n of nodes) { n.x = Math.min(n.x, W); n.y = Math.min(n.y, H); }
        if (reduceMotion) draw(0);
    }

    // BFS over the current proximity graph, recording which edge reached each node.
    function startPulse(origin) {
        const levels = new Map([[origin, 0]]);
        const edges = [];
        const queue = [origin];
        while (queue.length) {
            const a = queue.shift();
            const depth = levels.get(a);
            if (depth >= MAX_DEPTH) continue;
            for (const b of nodes) {
                if (levels.has(b)) continue;
                if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 < LINK * LINK) {
                    levels.set(b, depth + 1);
                    edges.push({ a, b, level: depth + 1 });
                    queue.push(b);
                }
            }
        }
        pulses.push({ start: performance.now(), levels, edges, end: (MAX_DEPTH + 1) * STEP + 900 });
        if (pulses.length > 6) pulses.shift();
    }

    function nearestNode(x, y) {
        let best = nodes[0], bestD = Infinity;
        for (const n of nodes) {
            const d = (n.x - x) ** 2 + (n.y - y) ** 2;
            if (d < bestD) { bestD = d; best = n; }
        }
        return best;
    }

    function draw(t) {
        ctx.clearRect(0, 0, W, H);
        const base = colors.dark ? .22 : .17;

        // edges, batched by alpha bucket
        const paths = Array.from({ length: BUCKETS }, () => new Path2D());
        const used = new Array(BUCKETS).fill(false);
        for (let i = 0; i < nodes.length; i++) {
            const a = nodes[i];
            for (let j = i + 1; j < nodes.length; j++) {
                const b = nodes[j];
                const dx = a.x - b.x, dy = a.y - b.y;
                const d2 = dx * dx + dy * dy;
                if (d2 > LINK * LINK) continue;
                const k = Math.min(BUCKETS - 1, Math.floor(Math.sqrt(d2) / LINK * BUCKETS));
                paths[k].moveTo(a.x, a.y); paths[k].lineTo(b.x, b.y); used[k] = true;
            }
            const pd = Math.hypot(a.x - pointer.x, a.y - pointer.y);
            if (pd < 170) {
                const k = Math.min(BUCKETS - 1, Math.floor(pd / 170 * BUCKETS));
                paths[k].moveTo(a.x, a.y); paths[k].lineTo(pointer.x, pointer.y); used[k] = true;
            }
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = colors.accent;
        for (let k = 0; k < BUCKETS; k++) {
            if (!used[k]) continue;
            ctx.globalAlpha = (1 - (k + .5) / BUCKETS) * base;
            ctx.stroke(paths[k]);
        }

        // nodes in one path
        const dots = new Path2D();
        for (const n of nodes) { dots.moveTo(n.x + n.r, n.y); dots.arc(n.x, n.y, n.r, 0, Math.PI * 2); }
        ctx.fillStyle = colors.accent;
        ctx.globalAlpha = colors.dark ? .55 : .45;
        ctx.fill(dots);

        // BFS traversals
        ctx.strokeStyle = colors.accent2;
        ctx.fillStyle = colors.accent2;
        ctx.lineWidth = 1.6;
        for (const p of pulses) {
            const elapsed = t - p.start;
            const fade = Math.min(1, Math.max(0, (p.end - elapsed) / 700));
            ctx.globalAlpha = .75 * fade;
            ctx.beginPath();
            for (const e of p.edges) {
                const prog = Math.min(1, Math.max(0, (elapsed - (e.level - 1) * STEP) / STEP));
                if (!prog) continue;
                ctx.moveTo(e.a.x, e.a.y);
                ctx.lineTo(e.a.x + (e.b.x - e.a.x) * prog, e.a.y + (e.b.y - e.a.y) * prog);
            }
            ctx.stroke();
            for (const [n, level] of p.levels) {
                const since = elapsed - level * STEP;
                if (since < 0) continue;
                const pop = Math.min(1, since / 250);
                ctx.globalAlpha = .9 * fade;
                ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 1.4 * pop, 0, Math.PI * 2); ctx.fill();
                const ring = .25 * fade * (1 - Math.min(1, since / 900));
                if (ring > .01) {
                    ctx.globalAlpha = ring;
                    ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 10 * pop, 0, Math.PI * 2); ctx.fill();
                }
            }
        }
        ctx.globalAlpha = 1;
    }

    function frame(t) {
        requestAnimationFrame(frame);
        if (t - last < 33) return;              // ~30 fps is plenty for a background
        const dt = Math.min(t - last, 60);
        last = t;

        const speed = busy ? 2.2 : 1;
        for (const n of nodes) {
            n.x += n.vx * dt * speed; n.y += n.vy * dt * speed;
            if (n.x < -20) n.x = W + 20; else if (n.x > W + 20) n.x = -20;
            if (n.y < -20) n.y = H + 20; else if (n.y > H + 20) n.y = -20;
        }
        pulses = pulses.filter(p => t - p.start < p.end);
        if (t > nextPulse && nodes.length) {
            startPulse(nodes[Math.floor(Math.random() * nodes.length)]);
            nextPulse = t + (busy ? 700 + Math.random() * 500 : 3800 + Math.random() * 2500);
        }
        draw(t);
    }

    readColors();
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('themechange', () => { readColors(); if (reduceMotion) draw(0); });
    window.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
    document.addEventListener('pointerleave', () => { pointer.x = pointer.y = -1e4; });

    window.bgFx = {
        pulse(x = W / 2, y = H / 2) { if (!reduceMotion && nodes.length) startPulse(nearestNode(x, y)); },
        setBusy(on) { busy = !!on; if (busy) nextPulse = 0; },
    };

    if (!reduceMotion) requestAnimationFrame(frame);
})();
