const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreText = document.getElementById('score-text');
const messageText = document.getElementById('message-text');
const loadingText = document.getElementById('loading');

let W = window.innerWidth;
let H = window.innerHeight;
canvas.width = W;
canvas.height = H;

// Game State
let state = 'LOADING'; // LOADING, IDLE, DRAGGING, FLYING, SCORED, MISSED
let score = 0;

// Assets
const images = {
    bg: null,
    wolf: null,
    dog: null,
    bin: null
};

// Physics and Positions
const gravity = 0.5;
let dog = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    radius: 40,
    startX: 0,
    startY: 0
};

let bin = {
    x: 0,
    y: 0,
    width: 150,
    height: 180,
    hitRadius: 60
};

let wolf = {
    x: 0,
    y: 0,
    width: 250,
    height: 350
};

let particles = [];

let obstacles = [];

// Web Audio API for sounds
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playThrow() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const bufferSize = audioCtx.sampleRate * 0.4;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2000, audioCtx.currentTime + 0.1);
    filter.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.4);
    
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start();
}

function playSqueak() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.stop(audioCtx.currentTime + 0.3);
}

function playCheer() {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(audioCtx.currentTime + i * 0.1);
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + i * 0.1 + 0.3);
        osc.stop(audioCtx.currentTime + i * 0.1 + 0.3);
    });
}

// Input
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
const maxPull = 150;
const powerMultiplier = 0.25;

// Load images and remove green screen
function makeTransparent(imageSrc, isBg, callback) {
    if (isBg) {
        const img = new Image();
        img.onload = () => callback(img);
        img.src = imageSrc;
        return;
    }
    const img = new Image();
    img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const cctx = c.getContext('2d', { willReadFrequently: true });
        cctx.drawImage(img, 0, 0);
        const data = cctx.getImageData(0, 0, c.width, c.height);
        const pixels = data.data;
        for (let i = 0; i < pixels.length; i += 4) {
            let r = pixels[i];
            let g = pixels[i+1];
            let b = pixels[i+2];
            // Bättre greenscreen med mjuk övergång (anti-aliasing)
            if (g > 100 && g > r * 1.1 && g > b * 1.1) {
                let diff = g - Math.max(r, b);
                if (diff > 40) {
                    pixels[i+3] = 0;
                } else {
                    let alpha = 255 - (diff * 6);
                    pixels[i+3] = Math.max(0, Math.min(255, alpha));
                }
            }
        }
        cctx.putImageData(data, 0, 0);
        const newImg = new Image();
        newImg.onload = () => callback(newImg);
        newImg.src = c.toDataURL();
    };
    img.src = imageSrc;
}

function initGame() {
    let loaded = 0;
    const total = 4;
    
    const checkLoad = () => {
        loaded++;
        if (loaded === total) {
            loadingText.style.display = 'none';
            resize();
            resetDog();
            state = 'IDLE';
            requestAnimationFrame(gameLoop);
        }
    };

    makeTransparent('assets/bg.png', true, (img) => { images.bg = img; checkLoad(); });
    makeTransparent('assets/wolf.png', false, (img) => { images.wolf = img; checkLoad(); });
    makeTransparent('assets/dog.png', false, (img) => { images.dog = img; checkLoad(); });
    makeTransparent('assets/bin.png', false, (img) => { images.bin = img; checkLoad(); });
}

function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    // Responsive positioning
    wolf.width = W * 0.25;
    wolf.height = wolf.width * 1.4;
    wolf.x = W * 0.1;
    wolf.y = H - wolf.height - H * 0.05;

    dog.radius = W * 0.05;
    if (dog.radius > 50) dog.radius = 50;

    bin.width = W * 0.2;
    bin.height = bin.width * 1.2;
    bin.x = W * 0.75;
    bin.y = H - bin.height - H * 0.05;
    bin.hitRadius = bin.width * 0.7; // Normal hitbox för mer utmaning
    
    dog.startX = wolf.x + wolf.width * 0.8;
    dog.startY = wolf.y + wolf.height * 0.3;
}

window.addEventListener('resize', () => {
    if (state !== 'LOADING') {
        resize();
        if (state === 'IDLE') resetDog();
    }
});

function resetDog() {
    dog.startX = wolf.x + wolf.width * 0.8;
    dog.startY = wolf.y + wolf.height * 0.3;
    dog.x = dog.startX;
    dog.y = dog.startY;
    dog.vx = 0;
    dog.vy = 0;
}

function randomizeLevel() {
    bin.x = W * 0.6 + Math.random() * (W * 0.25);
    bin.y = (H - bin.height - H * 0.05) - (Math.random() * H * 0.2);

    wolf.x = W * 0.02 + Math.random() * (W * 0.25); // Vargen byter position!
    resetDog(); // Uppdatera hundens startposition direkt

    obstacles = [];
    if (score >= 10 && Math.random() > 0.2) {
        let maxObstacles = 1 + Math.floor(score / 30);
        if (maxObstacles > 4) maxObstacles = 4;
        let numSpawns = Math.floor(Math.random() * maxObstacles) + 1;
        
        // Extra storlekar och variationer
        const emojis = ['🎈', '☁️', '🛸', '🪁', '🚁', '🐝', '👻'];
        const fontSizes = [120, 140, 160, 180]; // Mycket större!

        for (let i = 0; i < numSpawns; i++) {
            let isHorizontal = Math.random() > 0.5;
            let oSizeIndex = Math.floor(Math.random() * fontSizes.length);
            let s = fontSizes[oSizeIndex];
            
            obstacles.push({
                x: W * 0.3 + Math.random() * (W * 0.3),
                y: H * 0.2 + Math.random() * (H * 0.5),
                radius: s * 0.45,
                size: s,
                vy: isHorizontal ? 0 : (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3),
                vx: isHorizontal ? (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 3) : 0,
                emoji: emojis[Math.floor(Math.random() * emojis.length)],
                minY: H * 0.1,
                maxY: H * 0.8,
                minX: W * 0.3,
                maxX: W * 0.7
            });
        }
    }
}

function showMessage(msg, isSuccess) {
    messageText.textContent = msg;
    messageText.style.color = isSuccess ? '#00FF00' : '#FF4500';
    messageText.classList.add('show');
    
    setTimeout(() => {
        messageText.classList.remove('show');
        resetDog();
        if (isSuccess) randomizeLevel();
        state = 'IDLE';
    }, 2000);
}

function createConfetti(x, y) {
    for (let i = 0; i < 50; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 1) * 15,
            color: ['#f00', '#0f0', '#00f', '#ff0', '#0ff'][Math.floor(Math.random() * 5)],
            size: Math.random() * 8 + 4,
            life: 1.0
        });
    }
}

// Input Handling
function handleStart(e) {
    if (state !== 'IDLE') return;
    
    let pointerX = e.clientX || e.touches[0].clientX;
    let pointerY = e.clientY || e.touches[0].clientY;
    
    // Check if clicked near dog
    let dist = Math.hypot(pointerX - dog.x, pointerY - dog.y);
    if (dist < dog.radius * 3) {
        state = 'DRAGGING';
        isDragging = true;
        dragStartX = pointerX;
        dragStartY = pointerY;
    }
}

function handleMove(e) {
    if (state !== 'DRAGGING') return;
    e.preventDefault();
    
    let pointerX = e.clientX || e.touches[0].clientX;
    let pointerY = e.clientY || e.touches[0].clientY;
    
    let dx = pointerX - dragStartX;
    let dy = pointerY - dragStartY;
    
    // Limit pull
    let pullDist = Math.hypot(dx, dy);
    if (pullDist > maxPull) {
        let angle = Math.atan2(dy, dx);
        dx = Math.cos(angle) * maxPull;
        dy = Math.sin(angle) * maxPull;
    }
    
    dog.x = dog.startX + dx;
    dog.y = dog.startY + dy;
}

function handleEnd(e) {
    if (state !== 'DRAGGING') return;
    isDragging = false;
    
    let dx = dog.startX - dog.x;
    let dy = dog.startY - dog.y;
    
    if (Math.hypot(dx, dy) > 20) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        playThrow();
        dog.vx = dx * powerMultiplier;
        dog.vy = dy * powerMultiplier;
        state = 'FLYING';
    } else {
        resetDog();
        state = 'IDLE';
    }
}

canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

canvas.addEventListener('touchstart', handleStart, {passive: false});
canvas.addEventListener('touchmove', handleMove, {passive: false});
window.addEventListener('touchend', handleEnd);


// Game Loop
function update() {
    if (state === 'FLYING') {
        dog.vy += gravity;
        dog.x += dog.vx;
        dog.y += dog.vy;
        
        // Check collision with bin (magnetize a bit for kids)
        // Hitbox: måste falla in i korgen (x inuti, y passera överkanten)
        let binLeft = bin.x + bin.width * 0.25;
        let binRight = bin.x + bin.width * 0.75;
        let binTop = bin.y + bin.height * 0.1;
        let binBottom = bin.y + bin.height * 0.4;
        
        let inXBounds = dog.x > binLeft && dog.x < binRight;
        let inYBounds = dog.y > binTop && dog.y < binBottom;

        if (inXBounds && inYBounds && dog.vy > 0) {
            // Hit!
            playCheer();
            state = 'SCORED';
            score += 10;
            scoreText.textContent = `⭐ Poäng: ${score}`;
            createConfetti(dog.x, dog.y);
            showMessage('Bravo!! 🐶📥', true);
        } else if (dog.y > H + dog.radius) {
            // Missed!
            playSqueak();
            state = 'MISSED';
            showMessage('Ooops! Försök igen.', false);
        }
    }
    
    obstacles.forEach(o => {
        o.y += o.vy;
        o.x += o.vx;
        if (o.y < o.minY || o.y > o.maxY) o.vy *= -1;
        if (o.x < o.minX || o.x > o.maxX) o.vx *= -1;
        
        if (state === 'FLYING') {
            let dist = Math.hypot(dog.x - o.x, dog.y - o.y);
            if (dist < dog.radius + o.radius) {
                // Boing!
                playSqueak();
                dog.vy = -12;
                dog.vx *= -1.5; 
                dog.x += dog.vx * 2;
                dog.y += dog.vy * 2;
            }
        }
    });
    
    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.vy += gravity * 0.5;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life <= 0) particles.splice(i, 1);
    }
}

function draw() {
    ctx.clearRect(0, 0, W, H);
    
    // Draw BG
    if (images.bg) {
        const scale = Math.max(W / images.bg.width, H / images.bg.height);
        const bgW = images.bg.width * scale;
        const bgH = images.bg.height * scale;
        const bgX = (W - bgW) / 2;
        const bgY = (H - bgH) / 2;
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(images.bg, bgX, bgY, bgW, bgH);
    }
    
    // Draw Bin
    if (images.bin) {
        ctx.drawImage(images.bin, bin.x, bin.y, bin.width, bin.height);
    }
    
    // Draw Obstacles
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    obstacles.forEach(o => {
        ctx.font = `${o.size}px Arial`;
        ctx.fillText(o.emoji, o.x, o.y);
    });
    
    // Draw Wolf
    if (images.wolf) {
        ctx.drawImage(images.wolf, wolf.x, wolf.y, wolf.width, wolf.height);
    }
    
    // Draw Trajectory
    if (state === 'DRAGGING') {
        let simX = dog.x;
        let simY = dog.y;
        let simVx = (dog.startX - dog.x) * powerMultiplier;
        let simVy = (dog.startY - dog.y) * powerMultiplier;
        
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 50; i++) {
            simVy += gravity;
            simX += simVx;
            simY += simVy;
            if (simY > H + dog.radius) break;
            
            if (i % 2 === 0) { // draw every other dot for spacing
                ctx.beginPath();
                ctx.arc(simX, simY, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    
    // Draw Dog
    if (images.dog) {
        ctx.save();
        ctx.translate(dog.x, dog.y);
        if (state === 'FLYING') {
            ctx.rotate(Math.atan2(dog.vy, dog.vx)); // give it some spin/rotation
        }
        ctx.drawImage(images.dog, -dog.radius, -dog.radius, dog.radius * 2, dog.radius * 2);
        ctx.restore();
    }
    
    // Draw Particles
    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1.0;
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start
initGame();
