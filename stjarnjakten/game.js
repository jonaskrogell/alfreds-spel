/* ============================================
   Gosedjurens Önskelista — Game Logic
   ============================================ */

// =============================================
// CONFIGURATION
// =============================================
const ANIMALS = {
    bear:  { img: 'bear.png',  wish: { type: 'hold',        icon: '🤗', label: 'Krama mig!',                holdMs: 2000 } },
    dog:   { img: 'dog.png',   wish: { type: 'receive-item', icon: '⚽', label: 'Ge mig bollen!',             itemId: 'ball' } },
    cat:   { img: 'cat.png',   wish: { type: 'drag-to-zone', icon: '🪟', label: 'Sitta i fönstret!',          zone: 'window' } },
    frog:  { img: 'frog.png',  wish: { type: 'throw-up',     icon: '🚀', label: 'Kasta mig högt!',            minVy: -25 } },
    pig:   { img: 'pig.png',   wish: { type: 'tap-many',     icon: '😆', label: 'Kittla mig!',                taps: 5 } },
    lion:  { img: 'lion.png',  wish: { type: 'drag-to-zone', icon: '💤', label: 'Vila i fåtöljen!',           zone: 'armchair' } },
    wolf:  { img: 'wolf.png',  wish: { type: 'night-howl',   icon: '🌙', label: 'Yla mot månen!' } },
    bunny: { img: 'bunny.png', wish: { type: 'drag-to-zone', icon: '🙈', label: 'Gömma mig!',                zone: 'behind-chair' } },
};

const BALL = { img: 'bouncy_ball.png' };

const ZONE_DEFS = {
    'window':       { x: 0.325, y: 0.575, w: 0.35, h: 0.065 },
    'armchair':     { x: 0.025, y: 0.675, w: 0.35, h: 0.10 },
    'behind-chair': { x: 0.00,  y: 0.45,  w: 0.10, h: 0.25 },
};

const CELEBRATIONS = {
    bear:  'celebrate-wiggle', dog: 'celebrate-bounce', cat: 'celebrate-sleep', frog: 'celebrate-jump',
    pig:   'celebrate-spin',   lion: 'celebrate-sleep', wolf: 'celebrate-howl', bunny: 'celebrate-peek',
};

const TOTAL = Object.keys(ANIMALS).length;
const SCENE_W = 2000;
const SCENE_H = 2000;

// =============================================
// STATE
// =============================================
let score = 0; let gameOver = false;
let W = window.innerWidth; let H = window.innerHeight;
let sceneX = 0, sceneY = 0, sceneScale = 1;

let engine, world, runner; // Matter.js instances

const toys = {}; // Maps animal id → { wrap, body, satisfied }
let ballData = { wrap: null, body: null };
let unspawnedToys = [];
let speechInitialized = false;

// Dragging
let isPanning = false; let panStartX = 0, panStartY = 0; let panStartSceneX = 0, panStartSceneY = 0;
let dragTarget = null, dragType = null, dragAnimalId = null;
let dragOffsetX = 0, dragOffsetY = 0;
let lastPtrX = 0, lastPtrY = 0, lastPtrTime = 0;
let ptrDragVx = 0, ptrDragVy = 0;
let isDragging = false; let pointerDownX = 0, pointerDownY = 0;

let holdTimer = null, holdTarget = null;
const tapCounts = {}; let tapResetTimers = {};

// DOM
const gameEl = document.getElementById('game'); const sceneEl = document.getElementById('scene');
const canvas = document.getElementById('canvas'); const scoreEl = document.getElementById('score');
const scoreboard = document.getElementById('scoreboard'); const hintText = document.getElementById('hint-text');
const sunMoonBtn = document.getElementById('sun-moon'); const toyBoxDeco = document.getElementById('toybox-deco');
const victoryEl = document.getElementById('victory'); const replayBtn = document.getElementById('replay-btn');

// =============================================
// PHYSICS SETUP (MATTER.JS)
// =============================================
function initPhysics() {
    if (engine) {
        Matter.Runner.stop(runner);
        Matter.Engine.clear(engine);
    }
    
    engine = Matter.Engine.create();
    world = engine.world;
    world.gravity.y = 1.3; // Lighter gravity for toys

    const staticOpts = { isStatic: true, friction: 0.9, restitution: 0.1 };
    Matter.World.add(world, [
        // Golvet (Floor)
        Matter.Bodies.rectangle(1000, 1980, 2500, 80, staticOpts),
        
        // Fåtölj Sits (Chair seat)
        Matter.Bodies.rectangle(400, 1630, 450, 50, { ...staticOpts, chamfer: { radius: 20 } }),
        
        // Fåtölj Rygg (Chair back)
        Matter.Bodies.rectangle(150, 1350, 160, 550, { ...staticOpts, angle: Math.PI * 0.04 }),
        
        // Fönsterbräda (Window sill)
        Matter.Bodies.rectangle(1000, 1410, 750, 30, staticOpts),
        
        // Bokhylla Hyllor
        Matter.Bodies.rectangle(1820, 1515, 360, 20, staticOpts),
        Matter.Bodies.rectangle(1820, 1145, 360, 20, staticOpts),
        Matter.Bodies.rectangle(1820, 780,  360, 20, staticOpts),
        
        // Leksakslåda (Toy box)
        Matter.Bodies.rectangle(1640, 1795, 420, 50, staticOpts),
        Matter.Bodies.rectangle(1420, 1850, 40, 250, staticOpts),
        
        // Boundaries
        Matter.Bodies.rectangle(-50, 1000, 100, 3000, { isStatic: true }),
        Matter.Bodies.rectangle(SCENE_W + 50, 1000, 100, 3000, { isStatic: true }),
        Matter.Bodies.rectangle(1000, -50, 3000, 100, { isStatic: true })
    ]);

    runner = Matter.Runner.create();
    Matter.Runner.run(runner, engine);
}

// =============================================
// RENDER LOOP (Sync DOM to Matter.js)
// =============================================
function renderLoop() {
    // Sync toys
    Object.keys(toys).forEach(id => {
        const data = toys[id];
        if (!data || !data.body || !data.wrap) return;

        if (dragTarget === data.wrap && isDragging) return;

        const visualX = data.body.position.x - 125; 
        const visualY = data.body.position.y - 125; 
        const rot = data.body.angle;
        
        data.wrap.style.transform = `translate(${visualX}px, ${visualY}px) rotate(${rot}rad)`;
    });

    // Sync ball
    if (ballData && ballData.body && ballData.wrap) {
        if (!(dragType === 'item' && isDragging)) {
            const visualX = ballData.body.position.x - 75; 
            const visualY = ballData.body.position.y - 75;
            ballData.wrap.style.transform = `translate(${visualX}px, ${visualY}px) rotate(${ballData.body.angle}rad)`;
        }
    }

    requestAnimationFrame(renderLoop);
}

// =============================================
// AUDIO & SPEECH
// =============================================
let audioCtx = null;
function ctx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
}
function playChime(f) {
    const c = ctx(); const o = c.createOscillator(); const g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f||880, c.currentTime);
    o.frequency.exponentialRampToValueAtTime((f||880)*2, c.currentTime+0.12);
    g.gain.setValueAtTime(0.3, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime+0.5);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime+0.5);
}
function playPop() {
    const c = ctx(); const o = c.createOscillator(); const g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(600, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(200, c.currentTime+0.1);
    g.gain.setValueAtTime(0.4, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime+0.15);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime+0.15);
}
function playTick() {
    const c = ctx(); const o = c.createOscillator(); const g = c.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(1200, c.currentTime);
    g.gain.setValueAtTime(0.15, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime+0.06);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime+0.06);
}
function playHowl() {
    const c = ctx(); const o = c.createOscillator(); const g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(300, c.currentTime);
    o.frequency.linearRampToValueAtTime(600, c.currentTime+0.4);
    o.frequency.linearRampToValueAtTime(550, c.currentTime+1.0);
    o.frequency.linearRampToValueAtTime(200, c.currentTime+1.5);
    g.gain.setValueAtTime(0.2, c.currentTime); g.gain.setValueAtTime(0.2, c.currentTime+0.8);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime+1.5);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime+1.5);
}
function playSuccess() {
    [0, 150, 300].forEach((delay, i) => {
        setTimeout(() => playChime(660 * Math.pow(1.26, i)), delay);
    });
}

function speakAnimal(id, text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    // Robust Swedish voice selection
    const voicesReady = () => {
        let u = new SpeechSynthesisUtterance(text);
        u.lang = 'sv-SE';
        
        let voices = window.speechSynthesis.getVoices();
        if (voices.length > 0) {
            let svVoices = voices.filter(v => v.lang.startsWith('sv'));
            if (svVoices.length > 0) {
                // Prioritize natural Swedish voices
                u.voice = svVoices.find(v => v.name.includes('Alva') || v.name.includes('Klara') || v.name.includes('Oskar')) || svVoices[0];
            }
        }
        
        switch(id) {
            case 'bear': u.pitch = 0.6; u.rate = 0.75; break;
            case 'pig': u.pitch = 1.8; u.rate = 1.3; break;
            case 'wolf': u.pitch = 0.7; u.rate = 0.9; break;
            case 'bunny': u.pitch = 1.6; u.rate = 1.25; break;
            case 'lion': u.pitch = 0.4; u.rate = 0.85; break;
            case 'frog': u.pitch = 1.4; u.rate = 1.1; break;
            case 'cat': u.pitch = 1.3; u.rate = 1.15; break;
            case 'dog': u.pitch = 1.2; u.rate = 1.1; break;
            default: u.pitch = 1; u.rate = 1;
        }
        window.speechSynthesis.speak(u);
    };

    if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = voicesReady;
    } else {
        voicesReady();
    }
}

// =============================================
// INITIALIZATION
// =============================================
function init() {
    score = 0; gameOver = false;
    document.body.classList.remove('night');
    canvas.innerHTML = '';
    victoryEl.classList.remove('show');
    updateScore();
    hintText.style.opacity = 1;

    Object.keys(tapCounts).forEach(k => delete tapCounts[k]);
    Object.keys(tapResetTimers).forEach(k => { clearTimeout(tapResetTimers[k]); delete tapResetTimers[k]; });

    Object.keys(toys).forEach(k => delete toys[k]);
    ballData = { wrap: null, body: null };
    
    unspawnedToys = Object.keys(ANIMALS);
    unspawnedToys.sort(() => Math.random() - 0.5);
    unspawnedToys.splice(Math.floor(Math.random() * unspawnedToys.length), 0, 'ball');

    initPhysics();
    resize(); updateSceneTransform();
}

function resize() {
    W = window.innerWidth; H = window.innerHeight;
    const minScaleW = W / SCENE_W; const minScaleH = H / SCENE_H;
    // Set scale to slightly less than fill to "zoom out" as requested
    sceneScale = Math.max(minScaleW, minScaleH) * 0.85; 
    sceneX = (W - SCENE_W * sceneScale) / 2;
    sceneY = (H - SCENE_H * sceneScale) / 2;
    constrainPan();
}

function updateSceneTransform() {
    sceneEl.style.transform = `translate(${sceneX}px, ${sceneY}px) scale(${sceneScale})`;
}

function updateScore() { scoreEl.textContent = `${score} / ${TOTAL}`; }

// =============================================
// TOY BOX SPAWNER
// =============================================
function unlockSpeechSafari() {
    if (!speechInitialized && window.speechSynthesis) {
        let u = new SpeechSynthesisUtterance('');
        u.volume = 0;
        window.speechSynthesis.speak(u);
        speechInitialized = true;
    }
}

toyBoxDeco.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); unlockSpeechSafari();
    if(gameOver) return;
    
    toyBoxDeco.classList.remove('toybox-bump');
    void toyBoxDeco.offsetWidth;
    toyBoxDeco.classList.add('toybox-bump');
    playPop();

    if (unspawnedToys.length === 0) {
        hintText.style.opacity = 0; return; 
    }

    const id = unspawnedToys.shift();
    if (unspawnedToys.length === 0) hintText.style.opacity = 0;

    if (id === 'ball') spawnBall();
    else spawnAnimal(id);
});

function spawnAnimal(id) {
    const cfg = ANIMALS[id];
    const wrap = document.createElement('div');
    wrap.className = 'toy-wrap'; wrap.dataset.id = id;

    const img = document.createElement('img');
    img.className = 'toy-img'; img.src = 'assets/' + cfg.img; img.draggable = false;
    wrap.appendChild(img);

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.innerHTML = `<span class="bubble-icon">${cfg.wish.icon}</span><span class="bubble-label">${cfg.wish.label}</span>`;
    bubble.addEventListener('pointerdown', (e) => {
        e.stopPropagation(); unlockSpeechSafari();
        if(!toys[id].satisfied) speakAnimal(id, cfg.wish.label);
    });
    wrap.appendChild(bubble);

    if (cfg.wish.type === 'tap-many') {
        const counter = document.createElement('div'); counter.className = 'tap-counter';
        counter.textContent = cfg.wish.taps; counter.id = 'tap-counter-' + id;
        wrap.appendChild(counter); tapCounts[id] = 0;
    }

    canvas.appendChild(wrap);
    wrap.addEventListener('pointerdown', onPointerDown);

    // Create Matter.js body correctly sized for the visual
    const body = Matter.Bodies.rectangle(1640, 1600, 120, 140, {
        chamfer: { radius: 30 },
        restitution: 0.4,
        friction: 0.8,
        frictionAir: 0.015
    });
    // Pop effect: Shoots from INSIDE the open box
    Matter.Body.setVelocity(body, { x: -8 - Math.random() * 12, y: -30 - Math.random() * 15 });
    Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.4);
    Matter.World.add(world, body);

    toys[id] = { wrap, body, satisfied: false };

    // Use a small delay for the voice so it doesn't clip with the pop sound
    setTimeout(() => speakAnimal(id, cfg.wish.label), 200);
}

function spawnBall() {
    const wrap = document.createElement('div');
    wrap.className = 'item-wrap'; wrap.dataset.itemId = 'ball';
    const img = document.createElement('img');
    img.className = 'item-img'; img.src = 'assets/' + BALL.img; img.draggable = false;
    wrap.appendChild(img);
    canvas.appendChild(wrap);
    wrap.addEventListener('pointerdown', onPointerDown);

    const body = Matter.Bodies.circle(1640, 1650, 60, { 
        restitution: 0.8, friction: 0.4, density: 0.005
    });
    Matter.Body.setVelocity(body, { x: -12 - Math.random() * 15, y: -30 - Math.random() * 15 });
    Matter.World.add(world, body);

    ballData = { wrap, body };
}


// =============================================
// POINTER HANDLING (PAN & DRAG)
// =============================================
function getPtr(e) {
    if (e.touches && e.touches.length) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
}

gameEl.addEventListener('pointerdown', (e) => {
    unlockSpeechSafari();
    if (e.target.id === 'bg' || e.target.id === 'game' || e.target.id === 'scene' || e.target.id === 'zones-layer') {
        if (gameOver) return;
        isPanning = true; const ptr = getPtr(e);
        panStartX = ptr.x; panStartY = ptr.y;
        panStartSceneX = sceneX; panStartSceneY = sceneY;
        sceneEl.style.transition = 'none';
        document.addEventListener('pointermove', onPanMove);
        document.addEventListener('pointerup', onPanUp);
        document.addEventListener('pointercancel', onPanUp);
    }
});

function constrainPan() {
    const minX = Math.min(0, W - SCENE_W * sceneScale);
    const maxX = Math.max(0, W - SCENE_W * sceneScale) > 0 ? (W - SCENE_W * sceneScale)/2 : 0;
    const minY = Math.min(0, H - SCENE_H * sceneScale);
    const maxY = Math.max(0, H - SCENE_H * sceneScale) > 0 ? (H - SCENE_H * sceneScale)/2 : 0;
    
    sceneX = Math.max(minX, Math.min(maxX, sceneX));
    sceneY = Math.max(minY, Math.min(maxY, sceneY));
}
function onPanMove(e) {
    if (!isPanning) return;
    const ptr = getPtr(e);
    sceneX = panStartSceneX + (ptr.x - panStartX); sceneY = panStartSceneY + (ptr.y - panStartY);
    constrainPan(); updateSceneTransform();
}
function onPanUp() {
    isPanning = false;
    document.removeEventListener('pointermove', onPanMove);
    document.removeEventListener('pointerup', onPanUp);
    document.removeEventListener('pointercancel', onPanUp);
}

function onPointerDown(e) {
    if (gameOver) return;
    e.preventDefault(); e.stopPropagation();

    const wrap = e.currentTarget; const ptr = getPtr(e);
    const animalId = wrap.dataset.id; const itemId = wrap.dataset.itemId;

    dragTarget = wrap; dragType = animalId ? 'toy' : 'item'; dragAnimalId = animalId || null;
    isDragging = false;
    pointerDownX = ptr.x; pointerDownY = ptr.y;
    lastPtrX = ptr.x; lastPtrY = ptr.y; lastPtrTime = performance.now();
    ptrDragVx = 0; ptrDragVy = 0;

    const sX = (ptr.x - sceneX) / sceneScale; const sY = (ptr.y - sceneY) / sceneScale;
    let visualX = 0, visualY = 0;
    
    // Get visual positions immediately to offset
    if (dragType === 'toy' && toys[dragAnimalId]) {
        visualX = toys[dragAnimalId].body.position.x - 125;
        visualY = toys[dragAnimalId].body.position.y - 125;
    } else if (dragType === 'item' && ballData) {
        visualX = ballData.body.position.x - 75;
        visualY = ballData.body.position.y - 75;
    }

    dragOffsetX = sX - visualX; dragOffsetY = sY - visualY;
    canvas.appendChild(wrap); // bring to front

    if (animalId && !toys[animalId].satisfied) {
        const wish = ANIMALS[animalId].wish;
        if (wish.type === 'hold') startHold(wrap, animalId);
        if (wish.type === 'tap-many') {
            handleTap(animalId); dragTarget = null; return;
        }
    }

    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);
}

function onPointerMove(e) {
    if (!dragTarget) return;
    e.preventDefault(); const ptr = getPtr(e);
    const dist = Math.hypot(ptr.x - pointerDownX, ptr.y - pointerDownY);

    if (dist > 12 && !isDragging) {
        isDragging = true; dragTarget.classList.add('dragging'); cancelHold();
        if (dragAnimalId && !toys[dragAnimalId].satisfied) {
            const wish = ANIMALS[dragAnimalId].wish;
            if (wish.type === 'drag-to-zone') showZone(wish.zone);
        }
    }

    if (isDragging) {
        const sX = (ptr.x - sceneX) / sceneScale; const sY = (ptr.y - sceneY) / sceneScale;
        const nx = sX - dragOffsetX; const ny = sY - dragOffsetY; 

        // Update physics body manually
        let body = null; let offsetH = 0;
        if (dragType === 'toy' && toys[dragAnimalId]) { body = toys[dragAnimalId].body; offsetH = 170; }
        else if (dragType === 'item' && ballData) { body = ballData.body; offsetH = 80; }

        if (body) {
            // center position
            Matter.Body.setPosition(body, { x: nx + 125, y: ny + 125 });
            Matter.Body.setVelocity(body, { x: 0, y: 0 });
            // Smoothly remove rotation while held
            Matter.Body.setAngle(body, body.angle * 0.85);
            
            // Sync visual manually during drag
            dragTarget.style.transform = `translate(${nx}px, ${ny}px) rotate(${body.angle}rad)`;
        }

        const now = performance.now(); const dt = now - lastPtrTime;
        if (dt > 0) {
            ptrDragVx = ((ptr.x - lastPtrX) / sceneScale) / dt * 15;
            ptrDragVy = ((ptr.y - lastPtrY) / sceneScale) / dt * 15;
            ptrDragVx = Math.max(-50, Math.min(50, ptrDragVx));
            ptrDragVy = Math.max(-50, Math.min(50, ptrDragVy));
        }
        lastPtrX = ptr.x; lastPtrY = ptr.y; lastPtrTime = now;
    }
}

function onPointerUp(e) {
    if (!dragTarget) return;
    const wrap = dragTarget; const animalId = dragAnimalId;
    wrap.classList.remove('dragging'); cancelHold(); hideAllZones();

    let body = null;
    if (dragType === 'toy' && toys[animalId]) body = toys[animalId].body;
    else if (dragType === 'item' && ballData) body = ballData.body;

    if (body && isDragging) {
        // Release with momentum
        Matter.Body.setVelocity(body, { x: ptrDragVx * 0.8, y: ptrDragVy * 0.8 });
    }

    if (isDragging && animalId && !toys[animalId].satisfied) {
        const wish = ANIMALS[animalId].wish;
        if (wish.type === 'drag-to-zone') {
            if (isInZone(body.position.x, body.position.y, wish.zone)) completeWish(animalId);
        }
        if (wish.type === 'throw-up') {
            if (ptrDragVy < wish.minVy) completeWish(animalId);
        }
    }

    if (isDragging && dragType === 'item') {
        const dog = toys['dog'];
        if (dog && !dog.satisfied) {
            const dist = Math.hypot(body.position.x - dog.body.position.x, body.position.y - dog.body.position.y);
            if (dist < 280) completeWish('dog');
        }
    }

    document.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerup', onPointerUp);
    document.removeEventListener('pointercancel', onPointerUp);
    dragTarget = null; dragAnimalId = null; isDragging = false;
}

// =============================================
// HOLD INTERACTION
// =============================================
function startHold(wrap, animalId) {
    holdTarget = wrap; wrap.classList.add('holding');
    let ring = wrap.querySelector('.hold-ring');
    if (!ring) {
        ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        ring.classList.add('hold-ring'); ring.setAttribute('viewBox', '0 0 160 160');
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '80'); circle.setAttribute('cy', '80'); circle.setAttribute('r', '75');
        ring.appendChild(circle); wrap.appendChild(ring);
    }
    requestAnimationFrame(() => ring.classList.add('active'));
    holdTimer = setTimeout(() => {
        if(holdTarget) { wrap.classList.remove('holding'); ring.classList.remove('active'); completeWish(animalId); }
    }, ANIMALS[animalId].wish.holdMs);
}
function cancelHold() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (holdTarget) {
        holdTarget.classList.remove('holding');
        const ring = holdTarget.querySelector('.hold-ring');
        if (ring) ring.classList.remove('active');
        holdTarget = null;
    }
}

// =============================================
// TAP INTERACTION
// =============================================
function handleTap(animalId) {
    if (toys[animalId].satisfied) return;
    const wish = ANIMALS[animalId].wish;
    tapCounts[animalId] = (tapCounts[animalId] || 0) + 1;
    const remaining = wish.taps - tapCounts[animalId];

    playTick();
    const counter = document.getElementById('tap-counter-' + animalId);
    if (counter) counter.textContent = remaining > 0 ? remaining : '🎉';

    const wrap = toys[animalId].wrap;
    wrap.classList.remove('celebrate-wiggle'); void wrap.offsetWidth; wrap.classList.add('celebrate-wiggle');
    setTimeout(() => wrap.classList.remove('celebrate-wiggle'), 500);

    const bx = toys[animalId].body.position.x; const by = toys[animalId].body.position.y;
    showFloat(bx, by - 120, remaining > 0 ? `${remaining}` : '🎉');

    if (tapResetTimers[animalId]) clearTimeout(tapResetTimers[animalId]);
    tapResetTimers[animalId] = setTimeout(() => {
        tapCounts[animalId] = 0; if (counter) counter.textContent = wish.taps;
    }, 1500);

    if (remaining <= 0) {
        if (tapResetTimers[animalId]) clearTimeout(tapResetTimers[animalId]);
        if (counter) counter.style.display = 'none';
        setTimeout(() => completeWish(animalId), 300);
    }
}

// =============================================
// SUN/MOON TOGGLE (NIGHT)
// =============================================
sunMoonBtn.addEventListener('click', () => {
    document.body.classList.toggle('night');
    const isNight = document.body.classList.contains('night');
    
    // Check wolf
    if (isNight && toys['wolf'] && !toys['wolf'].satisfied) {
        setTimeout(() => { playHowl(); completeWish('wolf'); }, 600);
    }
});

// =============================================
// WISH COMPLETION
// =============================================
function completeWish(animalId) {
    if (toys[animalId].satisfied) return;
    toys[animalId].satisfied = true;

    const wrap = toys[animalId].wrap;
    const celebClass = CELEBRATIONS[animalId];

    const bubble = wrap.querySelector('.bubble');
    if (bubble) { bubble.classList.add('popping'); setTimeout(() => bubble.remove(), 400); }

    wrap.classList.add(celebClass);
    wrap.classList.add('satisfied');
    playSuccess();

    setTimeout(() => {
        const badge = document.createElement('div');
        badge.className = 'satisfied-star'; badge.textContent = '⭐';
        wrap.appendChild(badge);
    }, 500);

    // Apply a small victory hop!
    Matter.Body.applyForce(toys[animalId].body, toys[animalId].body.position, { x: 0, y: -2.5 });

    flyStarToScore(toys[animalId].body.position.x, toys[animalId].body.position.y - 100);

    score++; updateScore();
    if (score >= TOTAL) setTimeout(showVictory, 1500);
}

function flyStarToScore(sceneXPos, sceneYPos) {
    const txScreen = (sceneXPos * sceneScale) + sceneX;
    const tyScreen = (sceneYPos * sceneScale) + sceneY;
    
    const star = document.createElement('div');
    star.className = 'flying-star'; star.textContent = '⭐';
    star.style.left = txScreen + 'px'; star.style.top = tyScreen + 'px';
    document.body.appendChild(star);

    const rect = scoreboard.getBoundingClientRect();
    const finalX = rect.left + 20 - txScreen; const finalY = rect.top + 10 - tyScreen;

    requestAnimationFrame(() => {
        star.style.transform = `translate(${finalX}px, ${finalY}px) scale(0.5)`;
        star.style.opacity = '0.7';
    });
    setTimeout(() => {
        star.remove();
        scoreboard.classList.add('pulse');
        setTimeout(() => scoreboard.classList.remove('pulse'), 400);
    }, 650);
}

function showFloat(x, y, text) {
    const el = document.createElement('div'); el.className = 'float-text'; el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px';
    canvas.appendChild(el);
    setTimeout(() => el.remove(), 900);
}

// =============================================
// DROP ZONES
// =============================================
function showZone(zoneId) { const el = document.querySelector(`[data-zone="${zoneId}"]`); if (el) el.classList.add('active'); }
function hideAllZones() { document.querySelectorAll('.zone').forEach(z => z.classList.remove('active')); }
function isInZone(cx, cy, zoneId) {
    const z = ZONE_DEFS[zoneId];
    if (!z) return false;
    const zx = z.x * SCENE_W, zy = z.y * SCENE_H, zw = z.w * SCENE_W, zh = z.h * SCENE_H;
    return cx >= zx && cx <= zx + zw && cy >= zy && cy <= zy + zh;
}

// =============================================
// VICTORY
// =============================================
function showVictory() {
    gameOver = true; victoryEl.classList.add('show');
    if (window.confetti) {
        const end = Date.now() + 4000;
        (function frame() {
            confetti({ particleCount: 5, angle: 60, spread: 55, origin: {x:0}, colors: ['#FFD700','#FFA500','#FFF','#FF6B6B'] });
            confetti({ particleCount: 5, angle: 120, spread: 55, origin: {x:1}, colors: ['#FFD700','#FFA500','#FFF','#FF6B6B'] });
            if (Date.now() < end) requestAnimationFrame(frame);
        })();
    }
}
replayBtn.addEventListener('click', init);

// =============================================
// RESIZE & START
// =============================================
window.addEventListener('resize', resize);
init();
requestAnimationFrame(renderLoop);
