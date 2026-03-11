
// ===================== LJUD-SYSTEM (Web Audio API) =====================
let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    if (type === 'jump') {
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = 'triangle'; osc.frequency.setValueAtTime(250, now); osc.frequency.exponentialRampToValueAtTime(500, now + 0.15);
        gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'collect') {
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); osc.frequency.setValueAtTime(1200, now + 0.1);
        gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.25);
    } else if (type === 'superBounce') {
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(1000, now + 0.3);
        gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.4);
    } else if (type === 'rescue') {
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = 'sine'; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(800, now + 0.5);
        gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.6);
    } else if (type === 'land') {
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = 'square'; osc.frequency.setValueAtTime(80, now); osc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
        gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.15);
    }
}

// ===================== PHASER CONFIG (16-BIT STYLE) =====================
const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.RESIZE,
        parent: 'game-container',
        width: '100%',
        height: '100%'
    },
    backgroundColor: '#0f2027',
    pixelArt: false, // Smooth sprites för "16-bit"-Snes-känsla
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 1200 }, debug: false }
    },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

// Spel-variabler
let player, platforms, fruitsGroup, cursors, score = 0, highestY = 0, starsGroup, startText;
let scoreText, distText, isStarted = false, isFalling = false, isRescued = false;
let touchLeft = false, touchRight = false;
let bgLayers = [], guideParticles, safetyCloud;
let monkeyActive = false, lastProgressTime = 0, lastProgressY = 0, lastProgressX = 0;
let chunks = {}; // Håller reda på genererade chunks (både X och Y)
const CHUNK_SIZE = 600;

// ===================== TEXTUR-GENERERING (16-BIT STYLE) =====================
function preload() {}

function generateTextures(scene) {
    // Spelare (Grod-apa 16-bit stil) - Rund, skuggad, snyggare färger
    const pGfx = scene.make.graphics();
    pGfx.fillStyle(0x0f5e0f, 1); pGfx.fillCircle(24, 28, 20); // Mörk bottenSkugga
    pGfx.fillStyle(0x2ecc71, 1); pGfx.fillCircle(24, 24, 20); // Grön bas
    pGfx.fillStyle(0x52be80, 1); pGfx.fillCircle(24, 28, 12); // Ljus mage
    // Ögon
    pGfx.fillStyle(0xffffff, 1); pGfx.fillCircle(15, 16, 7); pGfx.fillCircle(33, 16, 7);
    pGfx.fillStyle(0x000000, 1); pGfx.fillCircle(17, 16, 3); pGfx.fillCircle(31, 16, 3);
    // Mun
    pGfx.lineStyle(2, 0x1d8348); pGfx.beginPath(); pGfx.arc(24, 24, 10, 0.2, Math.PI - 0.2, false); pGfx.strokePath();
    pGfx.generateTexture('player16', 48, 48); pGfx.destroy();

    // Plattform (Blad, tjockare och skuggad)
    const lGfx = scene.make.graphics();
    lGfx.fillStyle(0x1e8449, 1); lGfx.fillRoundedRect(0, 4, 140, 22, 11);
    lGfx.fillStyle(0x27ae60, 1); lGfx.fillRoundedRect(0, 0, 140, 20, 10);
    lGfx.fillStyle(0x1e8449, 1); lGfx.fillRect(20, 10, 100, 2); // Nerv
    lGfx.generateTexture('leaf16', 140, 26); lGfx.destroy();

    // Lian
    const vGfx = scene.make.graphics();
    vGfx.fillStyle(0x784212, 1); vGfx.fillRoundedRect(0, 4, 110, 20, 10);
    vGfx.fillStyle(0xa04000, 1); vGfx.fillRoundedRect(0, 0, 110, 18, 9);
    vGfx.fillStyle(0x27ae60, 1); vGfx.fillCircle(15, 9, 6); vGfx.fillCircle(95, 9, 6); // Grön mossa
    vGfx.generateTexture('vine16', 110, 26); vGfx.destroy();

    // Guld-frukt (Apelsin)
    const fGfx = scene.make.graphics();
    fGfx.fillStyle(0xf39c12, 1); fGfx.fillCircle(20, 22, 16);
    fGfx.fillStyle(0xf1c40f, 1); fGfx.fillCircle(20, 20, 16);
    fGfx.fillStyle(0xffffff, 1); fGfx.fillCircle(14, 14, 4); // Highlight
    fGfx.fillStyle(0x229954, 1); fGfx.fillTriangle(20, 6, 26, 0, 28, 8); // Topplöv
    fGfx.generateTexture('fruit16', 40, 40); fGfx.destroy();

    // Chili-frukt (Röd, dash)
    const chGfx = scene.make.graphics();
    chGfx.fillStyle(0xc0392b, 1); chGfx.fillEllipse(20, 22, 18, 10);
    chGfx.fillStyle(0xe74c3c, 1); chGfx.fillEllipse(20, 20, 18, 10);
    chGfx.fillStyle(0xffffff, 1); chGfx.fillEllipse(15, 18, 6, 3);
    chGfx.fillStyle(0x27ae60, 1); chGfx.fillRect(36, 17, 6, 4); // Grön stjälk
    chGfx.generateTexture('chili16', 45, 30); chGfx.destroy();

    // Melon-frukt (Gör dig stor)
    const mGfx = scene.make.graphics();
    mGfx.fillStyle(0x27ae60, 1); 
    mGfx.beginPath(); mGfx.arc(25, 25, 22, 0, Math.PI, false); mGfx.fillPath(); // Grön skalk
    mGfx.fillStyle(0xe74c3c, 1); 
    mGfx.beginPath(); mGfx.arc(25, 23, 19, 0, Math.PI, false); mGfx.fillPath(); // Rött inkråm
    mGfx.fillStyle(0x000000, 1); mGfx.fillCircle(15, 30, 2); mGfx.fillCircle(25, 35, 2); mGfx.fillCircle(35, 30, 2); // Kärnor
    mGfx.generateTexture('melon16', 50, 50); mGfx.destroy();

    // Blåbär (Lättvikt/flyt)
    const bbGfx = scene.make.graphics();
    bbGfx.fillStyle(0x2980b9, 1); bbGfx.fillCircle(15, 15, 12);
    bbGfx.fillStyle(0x3498db, 1); bbGfx.fillCircle(13, 13, 12);
    bbGfx.fillStyle(0x1abc9c, 1); bbGfx.fillTriangle(15, 0, 20, 5, 10, 5); // Topplöv
    bbGfx.fillStyle(0xffffff, 1); bbGfx.fillCircle(10, 8, 3); // Blänk
    bbGfx.generateTexture('blueberry16', 30, 30); bbGfx.destroy();

    // Banan (Bonus points)
    const baGfx = scene.make.graphics();
    baGfx.fillStyle(0xf1c40f, 1); baGfx.fillEllipse(20, 20, 20, 10);
    baGfx.fillStyle(0xf39c12, 1); baGfx.fillEllipse(20, 23, 18, 8); // skugga
    baGfx.fillStyle(0x111111, 1); baGfx.fillRect(36, 18, 4, 4); // Tip
    baGfx.generateTexture('banana16', 40, 40); baGfx.destroy();

    // Gren-plattform (Trä)
    const bGfx = scene.make.graphics();
    bGfx.fillStyle(0x5d4037, 1); bGfx.fillRoundedRect(0, 5, 150, 20, 8);
    bGfx.fillStyle(0x795548, 1); bGfx.fillRoundedRect(0, 0, 150, 18, 8);
    bGfx.fillStyle(0x3e2723, 1); 
    bGfx.fillRect(20, 5, 40, 2); bGfx.fillRect(80, 10, 50, 2); // Trämönster
    bGfx.fillStyle(0x2ecc71, 1); bGfx.fillCircle(10, 10, 8); bGfx.fillCircle(140, 5, 6); // Lite mossa
    bGfx.generateTexture('branch16', 150, 26); bGfx.destroy();

    // Stjärna
    const sGfx = scene.make.graphics();
    sGfx.fillStyle(0xf1c40f, 1); sGfx.fillRect(10,0,4,24); sGfx.fillRect(0,10,24,4);
    sGfx.fillRect(4,4,16,16); sGfx.fillStyle(0xffffff, 1); sGfx.fillRect(6,6,4,4);
    sGfx.generateTexture('star16', 24, 24); sGfx.destroy();

    // Apa
    const moGfx = scene.make.graphics();
    moGfx.fillStyle(0x5d4037, 1); moGfx.fillCircle(24, 24, 20); // Huvud
    moGfx.fillStyle(0x8d6e63, 1); moGfx.fillCircle(24, 28, 14); // Ljus Nosing
    moGfx.fillStyle(0x8d6e63, 1); moGfx.fillCircle(4, 24, 8); moGfx.fillCircle(44, 24, 8); // Öron
    moGfx.fillStyle(0xffffff, 1); moGfx.fillCircle(16, 18, 6); moGfx.fillCircle(32, 18, 6); // Ögonvita
    moGfx.fillStyle(0x000000, 1); moGfx.fillCircle(17, 17, 3); moGfx.fillCircle(31, 17, 3);
    moGfx.generateTexture('monkey16', 48, 48); moGfx.destroy();

    // Moln
    const cGfx = scene.make.graphics();
    cGfx.fillStyle(0xbdc3c7, 1); cGfx.fillCircle(60, 40, 30); cGfx.fillCircle(30, 45, 20); cGfx.fillCircle(90, 45, 20);
    cGfx.fillStyle(0xecf0f1, 1); cGfx.fillCircle(60, 35, 30); cGfx.fillCircle(30, 40, 20); cGfx.fillCircle(90, 40, 20);
    cGfx.generateTexture('cloud16', 120, 70); cGfx.destroy();

    // Partikel
    const partGfx = scene.make.graphics();
    partGfx.fillStyle(0x27ae60, 1); partGfx.fillCircle(4, 4, 4);
    partGfx.generateTexture('leafPart16', 8, 8); partGfx.destroy();
    
    // Pixel för BG
    const pxGfx = scene.make.graphics(); pxGfx.fillStyle(0xffffff,1); pxGfx.fillRect(0,0,8,8); pxGfx.generateTexture('pixel', 8, 8); pxGfx.destroy();
}

function create() {
    generateTextures(this);
    const W = this.scale.width, H = this.scale.height;

    // Gradient-ig horisont (parallax sky)
    for(let i=1; i<=3; i++) {
        const bg = this.add.tileSprite(0, 0, W*5, H*5, 'pixel').setOrigin(0.5,0.5).setScrollFactor(i*0.2);
        bg.setTint(i===1 ? 0x0f2027 : (i===2 ? 0x203a43 : 0x2c5364));
        bg.setAlpha(0.5);
        bgLayers.push({ sprite: bg, speed: i*0.2 });
    }

    platforms = this.physics.add.staticGroup();
    fruitsGroup = this.physics.add.staticGroup();
    starsGroup = this.physics.add.group({ allowGravity: false });

    // Spelare
    player = this.physics.add.sprite(W/2, H/2 - 50, 'player16');
    player.setBounce(0).setDepth(10);
    player.body.setSize(38, 38).setOffset(5, 5);

    // Initial Chunk (x=0, y=0 och närliggande)
    generateChunk(this, 0, 0);
    generateChunk(this, 0, -1);
    
    // Fysisk startplattform PRECIS under spelaren
    const startPlat = platforms.create(player.x, player.y + 100, 'leaf16');
    startPlat.setData('type', 'leaf');
    startPlat.setScale(1.5).refreshBody();

    this.physics.add.collider(player, platforms, onPlatformLand, null, this);
    this.physics.add.overlap(player, fruitsGroup, collectFruit, null, this);
    this.physics.add.overlap(player, starsGroup, collectStar, null, this);

    // Camera setup - Följ spelaren både vertikalt och horisontellt! (ändlöst åt alla håll)
    this.cameras.main.startFollow(player, true, 0.1, 0.1);
    this.cameras.main.setLerp(0.1, 0.1);

    // UI (fastklistrad på skärmen)
    scoreText = this.add.text(20, 20, '⭐ 0', { fontSize: '28px', fontFamily: 'Courier', color: '#f1c40f', stroke:'#000', strokeThickness:4 }).setScrollFactor(0).setDepth(20);
    distText = this.add.text(20, 60, '🌿 0m', { fontSize: '20px', fontFamily: 'Courier', color: '#2ecc71', stroke:'#000', strokeThickness:3 }).setScrollFactor(0).setDepth(20);

    startText = this.add.text(W/2, H/2 - 150, 'DJUNGELHOPPET\nUtforska oändligt!\nTryck för start', { fontSize: '32px', fontFamily: 'Courier', color: '#fff', align: 'center', stroke:'#000', strokeThickness:6 }).setOrigin(0.5).setScrollFactor(0).setDepth(30);

    // Säkerhetsmolnet i botten av VY
    safetyCloud = this.physics.add.sprite(W/2, H + 100, 'cloud16');
    safetyCloud.body.setAllowGravity(false);
    safetyCloud.setVisible(false).setDepth(15);
    safetyCloud.body.setSize(100, 30).setOffset(10, 25);

    // Kontroller
    cursors = this.input.keyboard.createCursorKeys();
    this.input.on('pointerdown', (p) => {
        if(!isStarted) return startGameAction();
        if(p.x < W/2) touchLeft = true; else touchRight = true;
    });
    this.input.on('pointerup', () => { touchLeft = touchRight = false; });
    this.input.on('pointermove', (p) => { if(p.isDown) { touchLeft = p.x < W/2; touchRight = p.x >= W/2; } });
    this.input.keyboard.on('keydown', (e) => { if (!isStarted && e.code === 'Space') startGameAction(); });

    // Events från parent
    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'keydown') {
            if (!isStarted) startGameAction();
            if (e.data.code === 'ArrowLeft' || e.data.code === 'KeyA') { touchLeft = true; setTimeout(() => touchLeft = false, 150); }
            if (e.data.code === 'ArrowRight' || e.data.code === 'KeyD') { touchRight = true; setTimeout(() => touchRight = false, 150); }
        }
    });

    // Start UI
    highestY = player.y;
}

// ===================== GENERERA CHUNKS (ÄNDLÖS I X OCH Y) =====================
function getChunkId(cx, cy) { return `${cx},${cy}`; }

function generateChunk(scene, cx, cy) {
    const id = getChunkId(cx, cy);
    if (chunks[id]) return; // Redan skapad
    chunks[id] = true;

    // En chunk är CHUNK_SIZE x CHUNK_SIZE pixlar stor
    const startX = cx * CHUNK_SIZE;
    const startY = cy * CHUNK_SIZE;
    
    // Vi lägger in plattformar sporadiskt i denna region
    // Låt oss säga ca 3-5 plattformar per chunk för bra balans
    const numPlatforms = 3 + Math.floor(Math.random() * 3);
    for(let i=0; i<numPlatforms; i++) {
        // Tvinga dem isär lite inom chunken med försök
        let px, py;
        let valid = false;
        for(let attempts=0; attempts<15; attempts++) {
            px = startX + 50 + Math.random() * (CHUNK_SIZE - 100);
            py = startY + 50 + Math.random() * (CHUNK_SIZE - 100);
            
            // Kolla så det inte är för nära en existerande plattform
            let overlap = false;
            platforms.getChildren().forEach(ep => {
                // Generösa avstånd så de inte hamnar i varandra
                if (Math.abs(ep.x - px) < 180 && Math.abs(ep.y - py) < 130) overlap = true;
            });
            
            // Hoppa över om vi är extremt nära spawn-regionen
            if (Math.abs(px - (scene.scale.width/2)) < 150 && Math.abs(py - (scene.scale.height/2 - 50)) < 150) overlap = true;

            if (!overlap) { valid = true; break; }
        }
        
        if (!valid) continue; // Hoppa över om chuken var för full

        const rand = Math.random();
        let plat;

        if (rand < 0.45) {
            plat = platforms.create(px, py, 'leaf16');
            plat.setData('type', 'leaf');
        } else if (rand < 0.70) {
            plat = platforms.create(px, py, 'branch16');
            plat.setData('type', 'branch');
        } else if (rand < 0.85) {
            plat = platforms.create(px, py, 'vine16');
            plat.setData('type', 'vine');
            plat.setData('startX', px);
            plat.setData('swingSpeed', 1.0 + Math.random());
            plat.setData('swingPhase', Math.random() * Math.PI*2);
        } else {
            // Frukter
            const fRand = Math.random();
            if (fRand < 0.25) {
                plat = fruitsGroup.create(px, py, 'fruit16');
                plat.setData('type', 'fruit');
            } else if (fRand < 0.45) {
                plat = fruitsGroup.create(px, py, 'chili16');
                plat.setData('type', 'chili');
            } else if (fRand < 0.65) {
                plat = fruitsGroup.create(px, py, 'melon16');
                plat.setData('type', 'melon');
            } else if (fRand < 0.85) {
                plat = fruitsGroup.create(px, py, 'blueberry16');
                plat.setData('type', 'blueberry');
            } else {
                plat = fruitsGroup.create(px, py, 'banana16');
                plat.setData('type', 'banana');
            }
            scene.tweens.add({ targets: plat, alpha: 0.7, yoyo: true, repeat: -1, duration: 500 });
        }
        plat.refreshBody();

        // Ev. stjärna ovanför
        if (Math.random() < 0.3) {
            const star = scene.physics.add.sprite(px, py - 60, 'star16');
            scene.tweens.add({ targets: star, y: py - 75, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
            starsGroup.add(star);
        }
    }
}

// ===================== SPELSTART & LOGIK =====================
function startGameAction() {
    isStarted = true;
    initAudio();
    if(startText) { startText.destroy(); startText = null; }
    player.setVelocityY(-600);
    playSound('jump');
    lastProgressTime = Date.now();
    lastProgressY = player.y;
}

function onPlatformLand(p, plat) {
    if (p.body.velocity.y < 0) return;
    if (p.body.y + p.body.height > plat.body.y + 20) return;
    
    if (!plat.body.enable) return;

    p.setVelocityY(-700);
    playSound('jump'); playSound('land');
    
    // Visuell Squash/Stretch 16-bit
    this.tweens.add({ targets: p, scaleY: 0.7, scaleX: 1.2, duration: 60, yoyo: true, onComplete: () => {
        this.tweens.add({ targets: p, scaleY: 1.1, scaleX: 0.9, duration: 80, yoyo: true });
    }});

    // Partiklar
    const px = this.add.particles(plat.x, plat.y, 'leafPart16', {
        speed: {min:40, max:100}, angle:{min:220, max:320}, lifespan:500, alpha:{start:1, end:0}, scale:{start:1, end:0.5}, quantity:6, emitting:false
    });
    px.explode(6); this.time.delayedCall(600, () => px.destroy());
    
    scoreText.setText('⭐ ' + score);
    isRescued = false; isFalling = false;
    lastProgressTime = Date.now();
    lastProgressY = p.y;
}

function collectFruit(p, plat) {
    if (!plat.body.enable) return;

    if (plat.getData('type') === 'fruit') {
        p.setVelocityY(Math.min(p.body.velocity.y, 0) - 900); // SUPERSTUDDS åt det håll man är på väg
        playSound('superBounce');
        this.cameras.main.shake(150, 0.015);
        score += 5;

    } else if (plat.getData('type') === 'chili') {
        p.setVelocityY(-400); // Litet skutt
        let dir = (p.body.velocity.x >= 0 ? 1 : -1); 
        p.setVelocityX(dir * 1800); // Enorm DASH!
        playSound('jump'); playSound('superBounce');
        this.cameras.main.shake(100, 0.015);
        score += 10;
        
        // Eld-partiklar
        const px = this.add.particles(p.x, p.y, 'leafPart16', {
            speed: {min:100, max:300}, angle:{min:160, max:200}, lifespan:400, alpha:{start:1, end:0}, tint: 0xff3300, scale:{start:1.5, end:0}, quantity:15, emitting:false
        });
        px.explode(15); this.time.delayedCall(500, () => px.destroy());

    } else if (plat.getData('type') === 'melon') {
        p.setVelocityY(Math.min(p.body.velocity.y, 0) - 500); // Mindre extrastuds
        playSound('superBounce');
        
        // Melonen gör dig stooor
        this.tweens.add({ targets: p, scaleX: 1.8, scaleY: 1.8, duration: 400, ease: 'Elastic.easeOut' });
        this.time.delayedCall(5000, () => {
            if (p) this.tweens.add({ targets: p, scaleX: 1, scaleY: 1, duration: 400, ease: 'Sine.easeInOut' });
        });
        score += 8;

    } else if (plat.getData('type') === 'blueberry') {
        p.setVelocityY(-500); 
        playSound('collect');
        
        // Anti-gravity float: blåbäret gör grodan lätt som en fjäder
        p.body.setGravityY(-700); 
        this.time.delayedCall(3000, () => {
            if (p && p.body) p.body.setGravityY(0); 
        });
        score += 8;

    } else if (plat.getData('type') === 'banana') {
        playSound('superBounce');
        score += 50;
        
        // Konfetti-explosion
        const px = this.add.particles(p.x, p.y, 'leafPart16', {
            speed: {min:150, max:400}, lifespan:1500, scale:{start:1.5, end:0}, tint: [0xf1c40f, 0x3498db, 0xe74c3c, 0x2ecc71], quantity:30, emitting:false, gravityY: 600
        });
        px.explode(30); this.time.delayedCall(1600, () => px.destroy());
    }

    // Göm tillfälligt
    plat.body.enable = false; plat.setVisible(false);
    this.time.delayedCall(2000, () => { if(isStarted && plat) { plat.body.enable = true; plat.setVisible(true); } });
    
    scoreText.setText('⭐ ' + score);
    lastProgressTime = Date.now();
    lastProgressY = p.y;
}

function collectStar(p, star) {
    playSound('collect');
    score++; scoreText.setText('⭐ ' + score);
    star.destroy();
}

// ===================== UPDATE LOOP =====================
function update(time, delta) {
    if (!isStarted) return;
    const H = this.scale.height;

    // Rörelse Kontroller
    const speed = 400;
    if (cursors.left.isDown || touchLeft)     { player.setVelocityX(-speed); player.setFlipX(true); }
    else if (cursors.right.isDown || touchRight){ player.setVelocityX(speed); player.setFlipX(false); }
    else                                      { player.setVelocityX(player.body.velocity.x * 0.85); }

    // Roterar på väg upp
    if (player.body.velocity.y < 0) player.setAngle(0);

    // Mät djup/höjd ("Höjd" räknas neråt i Y)
    // Oändlig i X och Y!
    if (player.y < highestY) {
        highestY = player.y;
        distText.setText('🌿 ' + Math.floor(-highestY / 50) + 'm');
    }

    // Parallax update (stjärnor/fält) baserad på scroll
    bgLayers.forEach(layer => {
        layer.sprite.tilePositionX = this.cameras.main.scrollX * layer.speed;
        layer.sprite.tilePositionY = this.cameras.main.scrollY * layer.speed;
    });

    // Svingande lianer i aktuell range
    platforms.getChildren().forEach(p => {
        if (p.getData('type') === 'vine') {
            p.x = p.getData('startX') + Math.sin(time*0.0015 + p.getData('swingPhase')) * 50;
            p.refreshBody();
        }
    });

    // GENERERA RUNT SPELAREN
    // Räkna ut spelarens chunkkoordinat
    let currentChunkX = Math.floor(player.x / CHUNK_SIZE);
    let currentChunkY = Math.floor(player.y / CHUNK_SIZE);

    // Generera 3x3 rutnät runt spelaren
    for(let dx = -1; dx <= 1; dx++) {
        for(let dy = -2; dy <= 2; dy++) {
            generateChunk(this, currentChunkX + dx, currentChunkY + dy);
        }
    }

    // TA BORT LÅNGT BORTA 
    // Optimization: Tar bort chukar som är för långt bort (~3 chunks bort)
    const cleanupDist = CHUNK_SIZE * 3;
    platforms.getChildren().forEach(p => {
        if (Math.abs(p.x - player.x) > cleanupDist || Math.abs(p.y - player.y) > cleanupDist * 1.5) {
            let cx = Math.floor(p.x/CHUNK_SIZE), cy = Math.floor(p.y/CHUNK_SIZE);
            if(Math.abs(cx - currentChunkX) > 3 || Math.abs(cy - currentChunkY) > 4) {
               delete chunks[`${cx},${cy}`];
               p.destroy();
            }
        }
    });
    
    fruitsGroup.getChildren().forEach(p => {
        if (Math.abs(p.x - player.x) > cleanupDist || Math.abs(p.y - player.y) > cleanupDist * 1.5) {
            p.destroy();
        }
    });

    // RÄDDNINGSMOLN (OM MAN FALLER FÖR LÅNGT NER I BILD OCH INTE FÅR FÄSTE)
    // Eftersom vi nu kan röra oss neråt frivilligt (dvs utforska nedåt), 
    // triggar vi bara molnet om velocity är extremt hög nerråt under lång tid ELLER farten ökar.
    // Men det är bättre att trigga molnet om man faller "snabbt och långt" utan kontroll, dvs max terminal velocity en stund:
    if (player.body.velocity.y > 1000 && !isRescued) { // Faller stensnabbt = safety net!
        rescuePlayer(this);
    }

    // APA (stuck helper)
    if (player.y < lastProgressY - 50 || Math.abs(player.x - lastProgressX) > 100) {
        lastProgressY = player.y; lastProgressX = player.x; lastProgressTime = Date.now();
    }
    if (isStarted && !monkeyActive && !isRescued && Date.now() - lastProgressTime > 20000) {
        monkeyRescue(this);
    }
}

// ===================== RÄDDNING & APA =====================
function rescuePlayer(scene) {
    isRescued = true;
    playSound('rescue');
    scene.cameras.main.shake(100, 0.02);
    
    // Moln flyger upp i bild och landar vid spelaren
    safetyCloud.setPosition(player.x, player.y + 100);
    safetyCloud.setVisible(true);
    
    scene.tweens.add({
        targets: safetyCloud,
        y: player.y - 300,
        duration: 800,
        ease: 'Sine.easeOut',
        onUpdate: () => { player.setPosition(safetyCloud.x, safetyCloud.y - 40); player.setVelocity(0,0); },
        onComplete: () => {
            player.setVelocityY(-900); playSound('superBounce');
            safetyCloud.setVisible(false);
            isRescued = false;
        }
    });
}

function monkeyRescue(scene) {
    monkeyActive = true;
    playSound('collect');
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        let u = new SpeechSynthesisUtterance('Här kommer apan!'); u.lang='sv-SE'; window.speechSynthesis.speak(u);
    }
    
    const m = scene.add.sprite(player.x + 200, player.y - 100, 'monkey16').setDepth(30).setScale(1.2);
    scene.tweens.add({
        targets: m, x: player.x, y: player.y-10, duration: 600, ease: 'Back.easeOut',
        onComplete: () => {
            scene.tweens.add({
                targets: m, y: player.y - 600, x: player.x + (Math.random()-0.5)*300, duration: 1500, ease: 'Sine.easeInOut',
                onUpdate: () => { player.setPosition(m.x, m.y+20); player.setVelocity(0,0); },
                onComplete: () => {
                    player.setVelocityY(-600); playSound('jump');
                    scene.tweens.add({ targets: m, alpha: 0, duration: 500, onComplete: () => m.destroy() });
                    lastProgressTime = Date.now(); monkeyActive = false;
                }
            });
        }
    });
}

// ===================== TILLBAKA & HJÄLP =====================
document.getElementById('back-btn').addEventListener('click', (e) => {
    e.preventDefault();
    if (window.parent !== window) window.parent.postMessage('goBack', '*');
    else window.location.href = '../index.html';
});

document.getElementById('help-btn').addEventListener('click', (e) => {
    e.preventDefault();
    const h = 'Utforska djungeln obegränsat åt alla håll!\n[←][→] eller peka för att styra.\nHoppa högre på lianer & frukter.';
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        let u = new SpeechSynthesisUtterance(h); u.lang = 'sv-SE'; window.speechSynthesis.speak(u);
    } else alert(h);
});
