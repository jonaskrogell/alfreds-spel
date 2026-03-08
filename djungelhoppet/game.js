// ============================================================
// DJUNGELHOPPET: MAGISKA BÖNAN
// En vertikal infinite jumper byggd med Phaser 3
// ============================================================

// ===================== LJUD-SYSTEM (Web Audio API) =====================
// Alla ljud genereras procedurellt. Byt ut mot riktiga filer om du vill.
let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    if (type === 'jump') {
        // Boing med djup bas och diskant-svish
        const pitchVariation = 0.9 + Math.random() * 0.2; // +/- 10%
        // Bass
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(180 * pitchVariation, now);
        osc1.frequency.exponentialRampToValueAtTime(400 * pitchVariation, now + 0.15);
        gain1.gain.setValueAtTime(0.25, now);
        gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc1.connect(gain1); gain1.connect(audioCtx.destination);
        osc1.start(now); osc1.stop(now + 0.2);
        // Svish (höga övertoner)
        const osc2 = audioCtx.createOscillator(); 
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(600 * pitchVariation, now);
        osc2.frequency.exponentialRampToValueAtTime(1200 * pitchVariation, now + 0.1);
        gain2.gain.setValueAtTime(0.08, now);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc2.connect(gain2); gain2.connect(audioCtx.destination);
        osc2.start(now); osc2.stop(now + 0.12);

    } else if (type === 'land') {
        // Mjukt prassel
        const bufferSize = audioCtx.sampleRate * 0.15;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filt = audioCtx.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.value = 800;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        noise.connect(filt); filt.connect(gain); gain.connect(audioCtx.destination);
        noise.start(now);

    } else if (type === 'superBounce') {
        // Magisk klang - pentatonisk skala
        [523, 659, 784, 1047].forEach((f, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.value = f;
            gain.gain.setValueAtTime(0, now + i * 0.08);
            gain.gain.linearRampToValueAtTime(0.15, now + i * 0.08 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.08 + 0.3);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(now + i * 0.08); osc.stop(now + i * 0.08 + 0.3);
        });

    } else if (type === 'rescue') {
        // Svepande uppåt ljud
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.4);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(now); osc.stop(now + 0.5);

    } else if (type === 'collect') {
        // Pling
        const pitchVariation = 0.9 + Math.random() * 0.2;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880 * pitchVariation, now);
        osc.frequency.setValueAtTime(1100 * pitchVariation, now + 0.08);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(now); osc.stop(now + 0.25);
    }
}

// Ambient loop – fåglar och vind
let ambientInterval = null;
function startAmbient() {
    if (ambientInterval) return;
    // Spela ambient-ljud var 4:e sekund
    function ambientTick() {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;
        // Fågel-tweet
        if (Math.random() < 0.5) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            const base = 1200 + Math.random() * 800;
            osc.frequency.setValueAtTime(base, now);
            osc.frequency.setValueAtTime(base * 1.2, now + 0.05);
            osc.frequency.setValueAtTime(base * 0.9, now + 0.1);
            osc.frequency.setValueAtTime(base * 1.1, now + 0.15);
            gain.gain.setValueAtTime(0.03, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.2);
        }
        // Vind
        if (Math.random() < 0.3) {
            const bufferSize = audioCtx.sampleRate * 0.8;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;
            const filt = audioCtx.createBiquadFilter();
            filt.type = 'lowpass'; filt.frequency.value = 400;
            const gain = audioCtx.createGain();
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.04, now + 0.3);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
            noise.connect(filt); filt.connect(gain); gain.connect(audioCtx.destination);
            noise.start(now);
        }
    }
    ambientTick();
    ambientInterval = setInterval(ambientTick, 3000 + Math.random() * 3000);
}

// ===================== PHASER CONFIG =====================
const GAME_WIDTH = 960;
const GAME_HEIGHT = 800;

const config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    parent: 'game-container',
    backgroundColor: '#1a3a1a',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 900 },
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_WIDTH,
        height: GAME_HEIGHT
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

const game = new Phaser.Game(config);

// ===================== SPEL-VARIABLER =====================
let player;
let platforms;
let cursors;
let score = 0;
let highestY = 0;
let scoreText;
let heightText;
let isStarted = false;
let startText;
let safetyCloud = null;
let isFalling = false;
let isRescued = false;
let bgLayers = [];
let guideParticles;
let lastPlatformY = 0;
let touchLeft = false;
let touchRight = false;
let cameraTarget = 0;
let gameScene;
let starsGroup;
let lastProgressTime = 0;
let lastProgressY = 0;
let monkeyActive = false;
let activeFruits = [];

// ===================== TEXTUR-GENERERING =====================
function preload() {
    // Vi genererar alla texturer i create() – inget att ladda!
}

function createTextures(scene) {
    // --- SPELARE: Grod-apa (grön rund karaktär) ---
    const playerGfx = scene.make.graphics({ add: false });
    // Kropp (grön rund)
    playerGfx.fillStyle(0x44cc44, 1);
    playerGfx.fillCircle(24, 26, 20);
    // Mage (ljusare)
    playerGfx.fillStyle(0x88ee88, 1);
    playerGfx.fillCircle(24, 30, 12);
    // Ögon (vita)
    playerGfx.fillStyle(0xffffff, 1);
    playerGfx.fillCircle(16, 18, 7);
    playerGfx.fillCircle(32, 18, 7);
    // Pupiller (svarta)
    playerGfx.fillStyle(0x111111, 1);
    playerGfx.fillCircle(18, 17, 4);
    playerGfx.fillCircle(34, 17, 4);
    // Mun (leende)
    playerGfx.lineStyle(2, 0x228822);
    playerGfx.beginPath();
    playerGfx.arc(24, 28, 8, 0.2, Math.PI - 0.2, false);
    playerGfx.strokePath();
    // Grodögon-bucklor (ovanpå)
    playerGfx.fillStyle(0x33bb33, 1);
    playerGfx.fillCircle(16, 10, 6);
    playerGfx.fillCircle(32, 10, 6);
    playerGfx.generateTexture('player', 48, 48);
    playerGfx.destroy();

    // --- PLATTFORM: Blad (brett grönt blad) - STÖRRE ---
    const leafGfx = scene.make.graphics({ add: false });
    leafGfx.fillStyle(0x33aa33, 1);
    leafGfx.fillRoundedRect(0, 4, 140, 20, 10);
    // Bladnerv
    leafGfx.lineStyle(2, 0x228822);
    leafGfx.lineBetween(12, 14, 128, 14);
    // Vener
    for (let x = 25; x < 130; x += 18) {
        leafGfx.lineStyle(1, 0x228822);
        leafGfx.lineBetween(x, 7, x + 6, 14);
        leafGfx.lineBetween(x, 21, x + 6, 14);
    }
    leafGfx.generateTexture('leaf', 140, 26);
    leafGfx.destroy();

    // --- PLATTFORM: Lian (rörlig, brun+grön) - STÖRRE ---
    const vineGfx = scene.make.graphics({ add: false });
    vineGfx.fillStyle(0x228833, 1);
    vineGfx.fillRoundedRect(0, 5, 110, 18, 9);
    vineGfx.fillStyle(0x6b4226, 1);
    vineGfx.fillRect(52, 0, 6, 7); // Lian-rep uppåt
    vineGfx.generateTexture('vine', 110, 26);
    vineGfx.destroy();

    // --- GULD-FRUKT (super-studsmatta) ---
    const fruitGfx = scene.make.graphics({ add: false });
    // Glöd-aura
    fruitGfx.fillStyle(0xffdd00, 0.2);
    fruitGfx.fillCircle(20, 20, 19);
    fruitGfx.fillStyle(0xffdd00, 0.4);
    fruitGfx.fillCircle(20, 20, 15);
    // Frukten
    fruitGfx.fillStyle(0xffaa00, 1);
    fruitGfx.fillCircle(20, 20, 12);
    // Highlight
    fruitGfx.fillStyle(0xffee66, 1);
    fruitGfx.fillCircle(16, 16, 5);
    // Blad
    fruitGfx.fillStyle(0x44bb44, 1);
    fruitGfx.fillTriangle(20, 8, 28, 2, 30, 10);
    fruitGfx.generateTexture('fruit', 40, 40);
    fruitGfx.destroy();

    // --- MOLN (räddningsmoln) ---
    const cloudGfx = scene.make.graphics({ add: false });
    cloudGfx.fillStyle(0xffffff, 0.9);
    cloudGfx.fillCircle(60, 35, 30);
    cloudGfx.fillCircle(95, 30, 25);
    cloudGfx.fillCircle(30, 32, 22);
    cloudGfx.fillCircle(50, 20, 22);
    cloudGfx.fillCircle(80, 22, 20);
    cloudGfx.fillStyle(0xffffff, 0.6);
    cloudGfx.fillCircle(45, 38, 20);
    cloudGfx.fillCircle(75, 40, 18);
    // Glad ansikte
    cloudGfx.fillStyle(0x333333, 1);
    cloudGfx.fillCircle(48, 30, 3);
    cloudGfx.fillCircle(72, 30, 3);
    cloudGfx.lineStyle(2, 0x555555);
    cloudGfx.beginPath();
    cloudGfx.arc(60, 34, 8, 0.2, Math.PI - 0.2, false);
    cloudGfx.strokePath();
    cloudGfx.generateTexture('cloud', 120, 60);
    cloudGfx.destroy();

    // --- STJÄRNA (collectible) ---
    const starGfx = scene.make.graphics({ add: false });
    starGfx.fillStyle(0xffdd44, 1);
    // Rita stjärna
    const cx = 12, cy = 12, spikes = 5, outerR = 11, innerR = 5;
    starGfx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const angle = (i * Math.PI / spikes) - Math.PI / 2;
        if (i === 0) starGfx.moveTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
        else starGfx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    }
    starGfx.closePath();
    starGfx.fillPath();
    starGfx.generateTexture('star', 24, 24);
    starGfx.destroy();

    // --- BAKGRUNDER (3 lager parallax) ---
    // Lager 1: Mörk djungel (längst bak)
    const bg1 = scene.make.graphics({ add: false });
    bg1.fillStyle(0x0d1f0d, 1);
    bg1.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Siluett-träd (fler för bredare skärm)
    for (let i = 0; i < 16; i++) {
        const tx = i * (GAME_WIDTH / 16) + Math.random() * 30;
        const th = 200 + Math.random() * 300;
        bg1.fillStyle(0x0a180a, 1);
        bg1.fillRect(tx + 8, GAME_HEIGHT - th, 8, th);
        bg1.fillTriangle(tx + 12, GAME_HEIGHT - th, tx - 10 + Math.random() * 5, GAME_HEIGHT - th + 60, tx + 34 + Math.random() * 5, GAME_HEIGHT - th + 60);
        bg1.fillTriangle(tx + 12, GAME_HEIGHT - th + 30, tx - 15, GAME_HEIGHT - th + 100, tx + 39, GAME_HEIGHT - th + 100);
    }
    bg1.generateTexture('bg1', GAME_WIDTH, GAME_HEIGHT);
    bg1.destroy();

    // Lager 2: Dimmiga träd (mellanplan)
    const bg2 = scene.make.graphics({ add: false });
    for (let i = 0; i < 12; i++) {
        const tx = i * (GAME_WIDTH / 12) + Math.random() * 30;
        const th = 150 + Math.random() * 200;
        bg2.fillStyle(0x1a3a1a, 0.6);
        bg2.fillRect(tx + 10, GAME_HEIGHT - th, 6, th);
        bg2.fillStyle(0x1f4a1f, 0.5);
        bg2.fillCircle(tx + 13, GAME_HEIGHT - th, 30 + Math.random() * 25);
        bg2.fillCircle(tx + 13, GAME_HEIGHT - th + 25, 25 + Math.random() * 20);
    }
    bg2.generateTexture('bg2', GAME_WIDTH, GAME_HEIGHT);
    bg2.destroy();

    // Lager 3: Ljust gröna löv (förgrund)
    const bg3 = scene.make.graphics({ add: false });
    for (let i = 0; i < 20; i++) {
        const lx = Math.random() * GAME_WIDTH;
        const ly = Math.random() * GAME_HEIGHT;
        bg3.fillStyle(0x44aa44, 0.15);
        bg3.fillCircle(lx, ly, 20 + Math.random() * 35);
    }
    bg3.generateTexture('bg3', GAME_WIDTH, GAME_HEIGHT);
    bg3.destroy();

    // --- LÖV-PARTIKEL ---
    const leafP = scene.make.graphics({ add: false });
    leafP.fillStyle(0x55cc55, 1);
    leafP.fillEllipse(6, 4, 12, 8);
    leafP.generateTexture('leafParticle', 12, 8);
    leafP.destroy();

    // --- GLITTER-PARTIKEL ---
    const glitP = scene.make.graphics({ add: false });
    glitP.fillStyle(0xffee44, 1);
    glitP.fillCircle(3, 3, 3);
    glitP.generateTexture('glitter', 6, 6);
    glitP.destroy();

    // --- STJÄRNDAMM (guide-partiklar som visar vägen) ---
    const dustP = scene.make.graphics({ add: false });
    dustP.fillStyle(0xffffcc, 0.7);
    dustP.fillCircle(2, 2, 2);
    dustP.generateTexture('stardust', 4, 4);
    dustP.destroy();

    // --- APA (hjälpare) ---
    const monkeyGfx = scene.make.graphics({ add: false });
    // Kropp (brun)
    monkeyGfx.fillStyle(0x8B5A2B, 1);
    monkeyGfx.fillCircle(24, 26, 18);
    // Mage
    monkeyGfx.fillStyle(0xDEB887, 1);
    monkeyGfx.fillCircle(24, 30, 11);
    // Ögon
    monkeyGfx.fillStyle(0xffffff, 1);
    monkeyGfx.fillCircle(17, 20, 6);
    monkeyGfx.fillCircle(31, 20, 6);
    monkeyGfx.fillStyle(0x222222, 1);
    monkeyGfx.fillCircle(18, 19, 3);
    monkeyGfx.fillCircle(32, 19, 3);
    // Stort leende
    monkeyGfx.lineStyle(2, 0x553311);
    monkeyGfx.beginPath();
    monkeyGfx.arc(24, 28, 9, 0.1, Math.PI - 0.1, false);
    monkeyGfx.strokePath();
    // Öron
    monkeyGfx.fillStyle(0xDEB887, 1);
    monkeyGfx.fillCircle(6, 22, 6);
    monkeyGfx.fillCircle(42, 22, 6);
    monkeyGfx.generateTexture('monkey', 48, 48);
    monkeyGfx.destroy();
}

// ===================== CREATE =====================
function create() {
    gameScene = this;
    createTextures(this);

    // --- Parallax-bakgrund (3 lager) ---
    // Vi skapar två instanser av varje för att kunna loopa vertikalt
    bgLayers = [];
    for (let i = 1; i <= 3; i++) {
        const key = 'bg' + i;
        const speedFactor = i * 0.15; // 0.15, 0.3, 0.45
        const a = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, key).setScrollFactor(0);
        const b = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2 - GAME_HEIGHT, key).setScrollFactor(0);
        a.setAlpha(i === 3 ? 0.3 : 1);
        b.setAlpha(i === 3 ? 0.3 : 1);
        bgLayers.push({ a, b, speed: speedFactor });
    }

    // --- Plattformar (fysik-grupp) ---
    platforms = this.physics.add.staticGroup();

    // --- Stjärnor (grupp) ---
    starsGroup = this.physics.add.group({ allowGravity: false });

    // --- SPELARE (skapas FÖRE plattformarna så overlap fungerar) ---
    player = this.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT - 100, 'player');
    player.setBounce(0);
    player.setCollideWorldBounds(false);
    // Förlåtande hitbox: 20% mindre
    player.body.setSize(38, 38);
    player.body.setOffset(5, 5);
    player.setDepth(10);

    // Start-plattform (stor och trygg)
    const startPlat = platforms.create(GAME_WIDTH / 2, GAME_HEIGHT - 50, 'leaf');
    startPlat.setScale(1.5).refreshBody();
    startPlat.setData('type', 'leaf');

    // Generera initiala plattformar
    lastPlatformY = GAME_HEIGHT - 50;
    for (let i = 0; i < 20; i++) {
        generatePlatform(this);
    }

    // --- Kollisioner ---
    this.physics.add.collider(player, platforms, onPlatformLand, null, this);
    this.physics.add.overlap(player, starsGroup, collectStar, null, this);

    // --- Poäng-text ---
    scoreText = this.add.text(GAME_WIDTH / 2, 20, '⭐ 0', {
        fontSize: '28px',
        fontFamily: '"Comic Sans MS", cursive',
        color: '#ffdd44',
        stroke: '#000',
        strokeThickness: 4,
        align: 'center'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(20);

    heightText = this.add.text(GAME_WIDTH / 2, 55, '🌿 0m', {
        fontSize: '18px',
        fontFamily: '"Comic Sans MS", cursive',
        color: '#88ff88',
        stroke: '#000',
        strokeThickness: 3,
        align: 'center'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(20);

    // --- Start-text ---
    startText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, '🐸 Djungelhoppet 🌴\n\nTryck för att börja!', {
        fontSize: '28px',
        fontFamily: '"Comic Sans MS", cursive',
        color: '#ffffff',
        stroke: '#000',
        strokeThickness: 5,
        align: 'center',
        lineSpacing: 8
    }).setOrigin(0.5).setScrollFactor(0).setDepth(30);

    // Pulsera start-texten
    this.tweens.add({
        targets: startText,
        scaleX: 1.05,
        scaleY: 1.05,
        yoyo: true,
        repeat: -1,
        duration: 800,
        ease: 'Sine.easeInOut'
    });

    // --- Kontroller ---
    cursors = this.input.keyboard.createCursorKeys();

    // Touch-kontroll (vänster/höger halva av skärmen)
    this.input.on('pointerdown', (pointer) => {
        if (!isStarted) {
            startGameAction();
            return;
        }
        if (pointer.x < GAME_WIDTH / 2) touchLeft = true;
        else touchRight = true;
    });
    this.input.on('pointerup', () => {
        touchLeft = false;
        touchRight = false;
    });
    this.input.on('pointermove', (pointer) => {
        if (!pointer.isDown) return;
        touchLeft = pointer.x < GAME_WIDTH / 2;
        touchRight = pointer.x >= GAME_WIDTH / 2;
    });

    // Keyboard start
    this.input.keyboard.on('keydown', (e) => {
        if (!isStarted && (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
            startGameAction();
        }
    });

    // Ta emot tangentbordshändelser från iframe parent
    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'keydown') {
            const fakeEvent = {
                type: 'keydown',
                code: e.data.code,
                key: e.data.key,
                repeat: e.data.repeat,
                preventDefault: () => {},
                cancelable: false,
                target: document.body
            };
            if (!isStarted) {
                startGameAction();
            }
            // Simulera tangenttryckningar
            if (e.data.code === 'ArrowLeft' || e.data.code === 'KeyA') {
                touchLeft = true; touchRight = false;
                setTimeout(() => { touchLeft = false; }, 100);
            } else if (e.data.code === 'ArrowRight' || e.data.code === 'KeyD') {
                touchRight = true; touchLeft = false;
                setTimeout(() => { touchRight = false; }, 100);
            }
        }
    });

    // --- Stjärndamm-partiklar (guide) ---
    guideParticles = this.add.particles(0, 0, 'stardust', {
        x: { min: 50, max: GAME_WIDTH - 50 },
        y: { min: -100, max: -20 },
        speedY: { min: 30, max: 80 },
        speedX: { min: -15, max: 15 },
        lifespan: 3000,
        alpha: { start: 0.6, end: 0 },
        scale: { start: 1.0, end: 0.3 },
        frequency: 200,
        quantity: 1,
        blendMode: 'ADD'
    });
    guideParticles.setScrollFactor(0);
    guideParticles.setDepth(5);

    // Säkerhetsmoln (osynligt tills det behövs)
    safetyCloud = this.physics.add.sprite(GAME_WIDTH / 2, GAME_HEIGHT + 100, 'cloud');
    safetyCloud.body.setAllowGravity(false);
    safetyCloud.setVisible(false);
    safetyCloud.setDepth(15);
    safetyCloud.body.setSize(100, 30);
    safetyCloud.body.setOffset(10, 25);

    // Kameravy
    cameraTarget = GAME_HEIGHT - 100;
    this.cameras.main.scrollY = 0;
}

// ===================== GENERERA PLATTFORMAR =====================
function generatePlatform(scene) {
    // Bestäm Y-position (60-100px ovanför senaste - lättare hopp!
    const gap = 55 + Math.random() * 45;
    const y = lastPlatformY - gap;

    // Generera 1-2 plattformar per rad (färre men större = lättare)
    const numPlatforms = Math.random() < 0.6 ? 2 : 1;
    const usedZones = [];

    // Pruna gamla frukter ur lagrade listan för prestanda (bara spara nyligen skapade under oss)
    activeFruits = activeFruits.filter(f => (f.y - lastPlatformY) < 1500);

    for (let p = 0; p < numPlatforms; p++) {
        // Sprida ut över hela bredden, undvik överlapp och undvik att bygga över "guld-frukter" (bomber)
        let x;
        let attempts = 0;
        do {
            x = 80 + Math.random() * (GAME_WIDTH - 160);
            attempts++;
        } while ((usedZones.some(z => Math.abs(z - x) < 180) ||
                  activeFruits.some(f => Math.abs(f.x - x) < 160 && (f.y - y) > 0 && (f.y - y) < 800)) 
                  && attempts < 15);
        usedZones.push(x);

        const rand = Math.random();
        let plat;

        if (rand < 0.60) {
            // Stora blad (vanligast, trygga)
            plat = platforms.create(x, y + (Math.random() - 0.5) * 15, 'leaf');
            plat.setData('type', 'leaf');
        } else if (rand < 0.85) {
            // Svingande lian
            plat = platforms.create(x, y + (Math.random() - 0.5) * 15, 'vine');
            plat.setData('type', 'vine');
            plat.setData('startX', x);
            plat.setData('swingSpeed', 1.0 + Math.random() * 1.0);
            plat.setData('swingAmplitude', 30 + Math.random() * 50);
            plat.setData('swingPhase', Math.random() * Math.PI * 2);
        } else {
            // Guld-frukt
            plat = platforms.create(x, y + (Math.random() - 0.5) * 15, 'fruit');
            plat.setData('type', 'fruit');
            
            // Spara positionen så att inga plattformar genereras rakt ovanför
            activeFruits.push({ x: x, y: plat.y });

            scene.tweens.add({
                targets: plat,
                alpha: 0.6,
                yoyo: true,
                repeat: -1,
                duration: 600,
                ease: 'Sine.easeInOut'
            });
        }

        plat.refreshBody();

        // Lägg ibland till stjärnor
        if (Math.random() < 0.25) {
            const star = scene.physics.add.sprite(x + (Math.random() - 0.5) * 40, y - 35, 'star');
            star.body.setAllowGravity(false);
            star.setData('type', 'collectible');
            star.setDepth(8);
            scene.tweens.add({
                targets: star,
                angle: 360,
                repeat: -1,
                duration: 2000,
                ease: 'Linear'
            });
            starsGroup.add(star);
        }
    }

    lastPlatformY = y;
}

// ===================== SPELSTART =====================
function startGameAction() {
    if (isStarted) return;
    isStarted = true;
    initAudio();
    startAmbient();

    if (startText) {
        gameScene.tweens.add({
            targets: startText,
            alpha: 0,
            scaleX: 0.5,
            scaleY: 0.5,
            duration: 400,
            onComplete: () => startText.destroy()
        });
    }

    // Ge spelaren ett initialt hopp
    player.setVelocityY(-500);
    playSound('jump');
    lastProgressTime = Date.now();
    lastProgressY = player.y;

    // TTS: Välkommen
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance('Hoppa uppåt i djungeln!');
        u.lang = 'sv-SE'; u.rate = 1.0;
        window.speechSynthesis.speak(u);
    }
}

// ===================== LANDNING PÅ PLATTFORM =====================
function onPlatformLand(playerSprite, platform) {
    // Bara om spelaren faller nedåt
    if (playerSprite.body.velocity.y < 0) return;
    // Bara om spelaren är ovanför plattformen
    if (playerSprite.body.y + playerSprite.body.height > platform.body.y + 10) return;

    const type = platform.getData('type');

    if (type === 'fruit') {
        // Super-studsmatta! 3x hopp
        playerSprite.setVelocityY(-1100);
        playSound('superBounce');

        // Glitter-explosion
        const emitter = gameScene.add.particles(platform.x, platform.y, 'glitter', {
            speed: { min: 100, max: 250 },
            angle: { min: 200, max: 340 },
            lifespan: 800,
            alpha: { start: 1, end: 0 },
            scale: { start: 1, end: 0.2 },
            quantity: 20,
            blendMode: 'ADD',
            emitting: false
        });
        emitter.explode(20);
        gameScene.time.delayedCall(1000, () => emitter.destroy());

        // Skärmskak
        gameScene.cameras.main.shake(100, 0.01);

        // Squash & stretch
        gameScene.tweens.add({
            targets: playerSprite,
            scaleY: 1.5,
            scaleX: 0.7,
            duration: 100,
            yoyo: true,
            ease: 'Sine.easeOut'
        });

        // Göm frukten tillfälligt istället för att ta bort, så att den kommer tillbaka och man kan testa igen
        platform.body.enable = false;
        platform.setVisible(false);
        gameScene.time.delayedCall(1000, () => {
            if (platform && platform.scene && isStarted) { 
                platform.body.enable = true;
                platform.setVisible(true);
                platform.refreshBody();
            }
        });

        score += 5;
        scoreText.setText('⭐ ' + score);

    } else {
        // Normalt hopp
        playerSprite.setVelocityY(-550);
        playSound('jump');
        playSound('land');

        // Squash & stretch
        gameScene.tweens.add({
            targets: playerSprite,
            scaleY: 0.6,
            scaleX: 1.3,
            duration: 60,
            yoyo: true,
            onYoyo: () => {
                gameScene.tweens.add({
                    targets: playerSprite,
                    scaleY: 1.2,
                    scaleX: 0.85,
                    duration: 80,
                    yoyo: true,
                    ease: 'Sine.easeOut'
                });
            },
            ease: 'Sine.easeIn'
        });

        // Löv-partiklar vid landning
        const leafEmitter = gameScene.add.particles(platform.x, platform.y, 'leafParticle', {
            speed: { min: 30, max: 80 },
            angle: { min: 220, max: 320 },
            lifespan: 600,
            alpha: { start: 0.8, end: 0 },
            scale: { start: 0.8, end: 0.2 },
            rotate: { min: 0, max: 360 },
            quantity: 5,
            emitting: false
        });
        leafEmitter.explode(5);
        gameScene.time.delayedCall(800, () => leafEmitter.destroy());
    }

    isFalling = false;
    isRescued = false;
}

// ===================== SAMLA STJÄRNA =====================
function collectStar(playerSprite, star) {
    playSound('collect');
    score += 1;
    scoreText.setText('⭐ ' + score);

    // Glitter-burst
    const emitter = gameScene.add.particles(star.x, star.y, 'glitter', {
        speed: { min: 50, max: 150 },
        lifespan: 500,
        alpha: { start: 1, end: 0 },
        scale: { start: 0.8, end: 0.1 },
        quantity: 8,
        blendMode: 'ADD',
        emitting: false
    });
    emitter.explode(8);
    gameScene.time.delayedCall(600, () => emitter.destroy());

    star.destroy();
}

// ===================== UPDATE-LOOP =====================
function update(time, delta) {
    if (!isStarted) return;

    // --- Snurra spelaren baserat på rörelser ---
    if (player.body.velocity.y < 0) {
        player.setAngle(0); // uppåt: rakt
    }

    // --- Horisontell styrning (super-responsiv) ---
    const moveSpeed = 350;
    if (cursors.left.isDown || touchLeft) {
        player.setVelocityX(-moveSpeed);
        player.setFlipX(true);
    } else if (cursors.right.isDown || touchRight) {
        player.setVelocityX(moveSpeed);
        player.setFlipX(false);
    } else {
        // Bromsning
        player.setVelocityX(player.body.velocity.x * 0.85);
    }

    // Wrap around: om spelaren hamnar utanför sidorna
    if (player.x < -20) player.x = GAME_WIDTH + 20;
    if (player.x > GAME_WIDTH + 20) player.x = -20;

    // --- Kamera: följ spelaren uppåt, aldrig neråt ---
    const camY = player.y - GAME_HEIGHT * 0.4;
    if (camY < cameraTarget) {
        cameraTarget = camY;
    }
    // Smidig kamera-rörelse
    this.cameras.main.scrollY += (cameraTarget - this.cameras.main.scrollY) * 0.1;

    // --- Uppdatera höjd ---
    const currentHeight = Math.max(0, Math.floor((GAME_HEIGHT - 50 - player.y) / 50));
    if (currentHeight > highestY) {
        highestY = currentHeight;
        heightText.setText('🌿 ' + highestY + 'm');
    }

    // --- Generera nya plattformar ovanför ---
    const topEdge = this.cameras.main.scrollY - 200;
    while (lastPlatformY > topEdge) {
        generatePlatform(this);
    }

    // --- Flytta svingande lianer ---
    platforms.getChildren().forEach(p => {
        if (p.getData('type') === 'vine') {
            const startX = p.getData('startX');
            const speed = p.getData('swingSpeed');
            const amp = p.getData('swingAmplitude');
            const phase = p.getData('swingPhase');
            p.x = startX + Math.sin(time * 0.001 * speed + phase) * amp;
            p.refreshBody();
        }
    });

    // --- Ta bort gamla plattformar under kameran ---
    const bottomEdge = this.cameras.main.scrollY + GAME_HEIGHT + 200;
    platforms.getChildren().forEach(p => {
        if (p.y > bottomEdge) {
            p.destroy();
        }
    });

    // --- Parallax-bakgrund ---
    bgLayers.forEach(layer => {
        const offset = (this.cameras.main.scrollY * layer.speed) % GAME_HEIGHT;
        layer.a.y = GAME_HEIGHT / 2 + offset;
        layer.b.y = GAME_HEIGHT / 2 + offset - GAME_HEIGHT;
    });

    // --- SAFETY NET: Räddningsmoln ---
    const fallThreshold = this.cameras.main.scrollY + GAME_HEIGHT + 30;
    if (player.y > fallThreshold && !isRescued) {
        isFalling = true;
        rescuePlayer(this);
    }

    // --- APA-HJÄLPARE: om spelaren fastnat i 20 sek ---
    const currentY = player.y;
    if (currentY < lastProgressY - 30) {
        // Spelaren har gjort framsteg (klättrat uppåt)
        lastProgressY = currentY;
        lastProgressTime = Date.now();
    }
    if (isStarted && !monkeyActive && !isRescued && Date.now() - lastProgressTime > 20000) {
        monkeyRescue(this);
    }

    // Guld guide-partiklar följer kamera
    if (guideParticles) {
        guideParticles.setPosition(0, 0);
    }
}

// ===================== RÄDDNING (Safety Net) =====================
function rescuePlayer(scene) {
    isRescued = true;
    playSound('rescue');

    // Visa molnet under spelaren
    const cloudY = player.y + 60;
    safetyCloud.setPosition(player.x, cloudY);
    safetyCloud.setVisible(true);

    // Animera molnet uppåt med spelaren
    scene.tweens.add({
        targets: safetyCloud,
        y: cameraTarget + GAME_HEIGHT * 0.6,
        x: GAME_WIDTH / 2,
        duration: 800,
        ease: 'Sine.easeOut',
        onUpdate: () => {
            player.setPosition(safetyCloud.x, safetyCloud.y - 40);
            player.setVelocityY(0);
            player.setVelocityX(0);
        },
        onComplete: () => {
            // Skjut upp spelaren!
            player.setVelocityY(-700);
            safetyCloud.setVisible(false);
            playSound('superBounce');

            // Skärmskak
            scene.cameras.main.shake(150, 0.015);

            // Stjärnor vid räddning
            const emitter = scene.add.particles(player.x, player.y, 'glitter', {
                speed: { min: 80, max: 200 },
                lifespan: 600,
                alpha: { start: 1, end: 0 },
                scale: { start: 1, end: 0.2 },
                quantity: 15,
                blendMode: 'ADD',
                emitting: false
            });
            emitter.explode(15);
            scene.time.delayedCall(800, () => emitter.destroy());

            isFalling = false;
        }
    });

    // Lätt skakning under räddning
    scene.cameras.main.shake(100, 0.008);
}

// ===================== APA-RÄDDNING (Stuck Helper) =====================
function monkeyRescue(scene) {
    monkeyActive = true;
    playSound('collect');

    // TTS: Apan kommer!
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance('Här kommer apan och hjälper dig!');
        u.lang = 'sv-SE'; u.rate = 1.0;
        window.speechSynthesis.speak(u);
    }

    // Skapa apa-sprite
    const monkey = scene.add.sprite(player.x + 50, player.y + 30, 'monkey');
    monkey.setDepth(12);
    monkey.setScale(1.2);

    // Apan svingar in till spelaren
    scene.tweens.add({
        targets: monkey,
        x: player.x,
        y: player.y - 10,
        duration: 500,
        ease: 'Back.easeOut',
        onComplete: () => {
            // Apan lyfter spelaren uppåt!
            const targetY = cameraTarget + GAME_HEIGHT * 0.3;

            scene.tweens.add({
                targets: monkey,
                y: targetY,
                x: GAME_WIDTH / 2 + (Math.random() - 0.5) * 200,
                duration: 1200,
                ease: 'Sine.easeInOut',
                onUpdate: () => {
                    player.setPosition(monkey.x, monkey.y + 20);
                    player.setVelocityY(0);
                    player.setVelocityX(0);
                },
                onComplete: () => {
                    // Släpp spelaren
                    player.setVelocityY(-400);
                    playSound('jump');

                    // Apan vinkar och försvinner
                    scene.tweens.add({
                        targets: monkey,
                        alpha: 0,
                        y: monkey.y - 80,
                        scaleX: 0.3,
                        scaleY: 0.3,
                        duration: 600,
                        ease: 'Sine.easeIn',
                        onComplete: () => monkey.destroy()
                    });

                    // Glitter!
                    const emitter = scene.add.particles(player.x, player.y, 'glitter', {
                        speed: { min: 60, max: 150 },
                        lifespan: 500,
                        alpha: { start: 1, end: 0 },
                        scale: { start: 0.8, end: 0.1 },
                        quantity: 12,
                        blendMode: 'ADD',
                        emitting: false
                    });
                    emitter.explode(12);
                    scene.time.delayedCall(600, () => emitter.destroy());

                    // Återställ timers
                    lastProgressTime = Date.now();
                    lastProgressY = player.y;
                    monkeyActive = false;
                }
            });
        }
    });
}

// ===================== TILLBAKA-KNAPP & HJÄLP =====================
document.getElementById('back-btn').addEventListener('click', (e) => {
    e.preventDefault();
    if (window.parent !== window) {
        window.parent.postMessage('goBack', '*');
    } else {
        window.location.href = '../index.html';
    }
});

document.getElementById('help-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(
            'Välkommen till Djungelhoppet! ' +
            'Du är en liten grod-apa som hoppar uppåt i djungeln. ' +
            'Tryck på vänster sida av skärmen för att gå vänster. ' +
            'Tryck på höger sida för att gå höger. ' +
            'Du studsar automatiskt på bladen! ' +
            'Samla stjärnor och hitta gyllene frukter för att hoppa extra högt. ' +
            'Oroa dig inte om du faller, ett snällt moln fångar dig!'
        );
        msg.lang = 'sv-SE'; msg.rate = 0.9;
        window.speechSynthesis.speak(msg);
    }
});
