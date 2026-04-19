/* ============================================
   Stjärnjakten – Game Logic
   ============================================ */

// --- Config ---
const TOY_IMAGES = [
    'bear.png', 'bunny.png', 'cat.png', 'dog.png',
    'frog.png', 'lion.png', 'pig.png', 'wolf.png'
];
const EXTRA_TOY_IMAGES = ['star_pillow.png', 'bouncy_ball.png'];
const TOTAL_STARS = 5;
const FLOOR_Y_OFFSET = 180;   // px from bottom that acts as "floor"
const TOY_SIZE = 160;          // approx toy width for overlap calculations

// --- State ---
let score = 0;
let gameWon = false;

// --- DOM refs ---
const gameCanvas   = document.getElementById('game-canvas');
const scoreText    = document.getElementById('score-text');
const nightSwitch  = document.getElementById('night-switch');
const toyBox       = document.getElementById('toy-box');
const victoryOverlay = document.getElementById('victory-overlay');
const playAgainBtn = document.getElementById('play-again-btn');

// --- Drag state ---
let draggedToy = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let lastPointerX = 0;
let lastPointerY = 0;
let lastPointerTime = 0;

// --- Physics state (per toy, stored in dataset) ---
// dataset keys: x, y, vx, vy, rot

// --- Viewport ---
let W = window.innerWidth;
let H = window.innerHeight;
window.addEventListener('resize', () => { W = window.innerWidth; H = window.innerHeight; });

// --- Audio context (lazy init) ---
let audioCtx = null;
function getAudioCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}

/* ============================================
   Initialization
   ============================================ */
function init() {
    score = 0;
    gameWon = false;
    updateScore();
    gameCanvas.innerHTML = '';
    victoryOverlay.classList.remove('show');

    // 1. Pick star positions — spread across screen, avoid edges
    const starPositions = [];
    const margin = 80;
    const cellW = (W - margin * 2) / 3;  // divide into rough grid cells
    const cellH = (H - margin * 2 - FLOOR_Y_OFFSET) / 2;

    // Generate spread positions so stars don't cluster
    for (let i = 0; i < TOTAL_STARS; i++) {
        let x, y, tooClose;
        let attempts = 0;
        do {
            tooClose = false;
            x = margin + Math.random() * (W - margin * 2 - 60);
            y = margin + 60 + Math.random() * (H - margin * 2 - FLOOR_Y_OFFSET - 60);
            for (const pos of starPositions) {
                if (Math.hypot(pos.x - x, pos.y - y) < 120) { tooClose = true; break; }
            }
            attempts++;
        } while (tooClose && attempts < 50);
        starPositions.push({ x, y });
    }

    // 2. Create star elements
    starPositions.forEach(pos => {
        const starEl = document.createElement('div');
        starEl.className = 'star';
        starEl.style.left = pos.x + 'px';
        starEl.style.top  = pos.y + 'px';

        const img = document.createElement('img');
        img.src = 'assets/star_pillow.png';
        img.alt = 'Stjärna';
        img.draggable = false;
        starEl.appendChild(img);

        starEl.addEventListener('click', () => collectStar(starEl));
        starEl.addEventListener('touchstart', (e) => { e.preventDefault(); collectStar(starEl); }, { passive: false });

        gameCanvas.appendChild(starEl);
    });

    // 3. Create toys — first TOTAL_STARS toys cover the stars, rest placed randomly
    const shuffled = shuffle([...TOY_IMAGES]);

    shuffled.forEach((file, i) => {
        let px, py;
        if (i < TOTAL_STARS) {
            // Center toy over star
            const sp = starPositions[i];
            px = sp.x - 20 + (Math.random() * 30 - 15);
            py = sp.y - 30 + (Math.random() * 20 - 10);
        } else {
            px = margin + Math.random() * (W - margin * 2 - TOY_SIZE);
            py = margin + 40 + Math.random() * (H - margin * 2 - FLOOR_Y_OFFSET - 60);
        }
        spawnToy(file, px, py, 0, 0, Math.random() * 30 - 15);
    });

    // Start physics loop
    requestAnimationFrame(physicsLoop);
}

/* ============================================
   Spawn a toy element
   ============================================ */
function spawnToy(file, x, y, vx, vy, rot) {
    const el = document.createElement('img');
    el.src = 'assets/' + file;
    el.className = 'toy';
    el.draggable = false;

    el.dataset.x   = x;
    el.dataset.y   = y;
    el.dataset.vx  = vx || 0;
    el.dataset.vy  = vy || 0;
    el.dataset.rot = rot || 0;

    applyTransform(el);
    gameCanvas.appendChild(el);

    el.addEventListener('mousedown', onPointerDown);
    el.addEventListener('touchstart', onPointerDown, { passive: false });
}

/* ============================================
   Transform helper — sets left/top + rotation
   ============================================ */
function applyTransform(el) {
    const x   = parseFloat(el.dataset.x);
    const y   = parseFloat(el.dataset.y);
    const rot = parseFloat(el.dataset.rot) || 0;
    const sx  = parseFloat(el.dataset.sx) || 1;
    const sy  = parseFloat(el.dataset.sy) || 1;
    el.style.left = '0px';
    el.style.top  = '0px';
    el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${sx}, ${sy})`;
}

/* ============================================
   Star collection
   ============================================ */
function collectStar(starEl) {
    if (starEl.classList.contains('collected') || gameWon) return;
    starEl.classList.add('collected');
    score++;
    updateScore();
    playChime(880 + score * 100);

    if (score >= TOTAL_STARS) {
        gameWon = true;
        setTimeout(showVictory, 600);
    }
}

function updateScore() {
    scoreText.textContent = `${score} / ${TOTAL_STARS}`;
}

/* ============================================
   Victory
   ============================================ */
function showVictory() {
    victoryOverlay.classList.add('show');

    // Confetti
    if (window.confetti) {
        const end = Date.now() + 3000;
        (function frame() {
            confetti({ particleCount: 4, angle: 60,  spread: 55, origin: { x: 0 }, colors: ['#FFD700','#FFA500','#FFF'] });
            confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#FFD700','#FFA500','#FFF'] });
            if (Date.now() < end) requestAnimationFrame(frame);
        })();
    }
}

playAgainBtn.addEventListener('click', () => init());

/* ============================================
   Pointer handling (mouse + touch unified)
   ============================================ */
function getPointer(e) {
    if (e.touches && e.touches.length > 0) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
}

function onPointerDown(e) {
    if (gameWon) return;
    if (e.type === 'mousedown' && e.button !== 0) return;
    e.preventDefault();

    const el = e.currentTarget;
    draggedToy = el;
    el.classList.add('dragging');

    // Bring to front
    gameCanvas.appendChild(el);

    // Zero velocity
    el.dataset.vx = 0;
    el.dataset.vy = 0;

    const ptr = getPointer(e);
    dragOffsetX = ptr.x - parseFloat(el.dataset.x);
    dragOffsetY = ptr.y - parseFloat(el.dataset.y);
    lastPointerX = ptr.x;
    lastPointerY = ptr.y;
    lastPointerTime = performance.now();

    // Pick-up squish
    el.dataset.sx = 1.05;
    el.dataset.sy = 0.92;
    applyTransform(el);

    document.addEventListener('mousemove', onPointerMove);
    document.addEventListener('touchmove', onPointerMove, { passive: false });
    document.addEventListener('mouseup', onPointerUp);
    document.addEventListener('touchend', onPointerUp);
}

function onPointerMove(e) {
    if (!draggedToy) return;
    e.preventDefault();

    const ptr = getPointer(e);
    const nx = ptr.x - dragOffsetX;
    const ny = ptr.y - dragOffsetY;

    draggedToy.dataset.x = nx;
    draggedToy.dataset.y = ny;

    // Velocity tracking
    const now = performance.now();
    const dt = now - lastPointerTime;
    if (dt > 0) {
        draggedToy.dataset.vx = (ptr.x - lastPointerX) / dt * 12;
        draggedToy.dataset.vy = (ptr.y - lastPointerY) / dt * 12;
    }

    // Rotation tilt based on horizontal speed
    draggedToy.dataset.rot = parseFloat(draggedToy.dataset.vx) * 1.5;

    // Dynamic squish
    const speed = Math.abs(parseFloat(draggedToy.dataset.vy));
    draggedToy.dataset.sx = 1 + Math.min(speed * 0.008, 0.15);
    draggedToy.dataset.sy = 1 - Math.min(speed * 0.005, 0.1);

    lastPointerX = ptr.x;
    lastPointerY = ptr.y;
    lastPointerTime = now;

    applyTransform(draggedToy);
}

function onPointerUp() {
    if (!draggedToy) return;

    draggedToy.classList.remove('dragging');
    draggedToy.dataset.sx = 1;
    draggedToy.dataset.sy = 1;
    applyTransform(draggedToy);
    draggedToy = null;

    document.removeEventListener('mousemove', onPointerMove);
    document.removeEventListener('touchmove', onPointerMove);
    document.removeEventListener('mouseup', onPointerUp);
    document.removeEventListener('touchend', onPointerUp);
}

/* ============================================
   Physics loop — gravity, friction, bounce
   ============================================ */
function physicsLoop() {
    const toys = gameCanvas.querySelectorAll('.toy');
    const friction = 0.93;
    const gravity  = 0.4;
    const floorY   = H - FLOOR_Y_OFFSET;

    toys.forEach(el => {
        if (el === draggedToy) return;

        let vx  = parseFloat(el.dataset.vx);
        let vy  = parseFloat(el.dataset.vy);
        let x   = parseFloat(el.dataset.x);
        let y   = parseFloat(el.dataset.y);
        let rot = parseFloat(el.dataset.rot);

        // Only process if moving
        if (Math.abs(vx) < 0.05 && Math.abs(vy) < 0.05) return;

        vy += gravity;
        vx *= friction;
        vy *= friction;

        x += vx;
        y += vy;

        // Floor collision
        if (y > floorY) {
            y = floorY;
            vy *= -0.45;
            vx *= 0.7;
            // Impact squish
            el.dataset.sx = 1.2;
            el.dataset.sy = 0.8;
            applyTransform(el);
            setTimeout(() => {
                el.dataset.sx = 1;
                el.dataset.sy = 1;
                applyTransform(el);
            }, 120);
        }

        // Wall collisions
        if (x < 0)          { x = 0;          vx = Math.abs(vx) * 0.5; }
        if (x > W - TOY_SIZE) { x = W - TOY_SIZE; vx = -Math.abs(vx) * 0.5; }
        if (y < 0)          { y = 0;          vy = Math.abs(vy) * 0.5; }

        // Rotation settles
        rot *= 0.92;

        // Stop if very small
        if (Math.abs(vx) < 0.05) vx = 0;
        if (Math.abs(vy) < 0.05) vy = 0;

        el.dataset.vx  = vx;
        el.dataset.vy  = vy;
        el.dataset.x   = x;
        el.dataset.y   = y;
        el.dataset.rot = rot;
        applyTransform(el);
    });

    requestAnimationFrame(physicsLoop);
}

/* ============================================
   Night mode toggle
   ============================================ */
nightSwitch.addEventListener('click', () => {
    document.body.classList.toggle('night-mode');
    nightSwitch.textContent = document.body.classList.contains('night-mode') ? '☀️' : '🌙';
});

/* ============================================
   Toy Box — spawn extra toys
   ============================================ */
toyBox.addEventListener('click', () => {
    if (gameWon) return;

    // Pop animation
    toyBox.style.transform = 'scale(0.88) translateY(8px)';
    setTimeout(() => { toyBox.style.transform = ''; }, 150);

    const file = EXTRA_TOY_IMAGES[Math.floor(Math.random() * EXTRA_TOY_IMAGES.length)];
    const boxRect = toyBox.getBoundingClientRect();
    const startX = boxRect.left + boxRect.width / 2 - TOY_SIZE / 2;
    const startY = boxRect.top;

    spawnToy(
        file,
        startX,
        startY,
        (Math.random() - 0.5) * 25,   // random horizontal velocity
        -12 - Math.random() * 8,        // upward velocity
        Math.random() * 60 - 30         // random rotation
    );
    playPop();
});

/* ============================================
   Sound effects (synthesized — no files needed)
   ============================================ */
function playChime(freq) {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq || 880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime((freq || 880) * 2, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.35, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.6);
}

function playPop() {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
}

/* ============================================
   Utilities
   ============================================ */
function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/* ============================================
   Start the game!
   ============================================ */
init();
