
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
let bgLayers = [], guideParticles, safetyCloud, bgEntitiesGroup;
let monkeyActive = false, lastProgressTime = 0, lastProgressY = 0, lastProgressX = 0, gameStartTime = 0;
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

    // Bouncepad (Studsande svamp / trumma)
    const bpGfx = scene.make.graphics();
    bpGfx.fillStyle(0x8e44ad, 1); 
    bpGfx.beginPath(); bpGfx.arc(50, 25, 45, Math.PI, Math.PI*2, false); bpGfx.fillPath(); // Svamphatt
    bpGfx.fillStyle(0x9b59b6, 1); 
    bpGfx.beginPath(); bpGfx.arc(50, 23, 40, Math.PI, Math.PI*2, false); bpGfx.fillPath();
    bpGfx.fillStyle(0xf1c40f, 1); bpGfx.fillCircle(30, 10, 8); bpGfx.fillCircle(70, 12, 6); bpGfx.fillCircle(50, 5, 5); // Prickar
    bpGfx.fillStyle(0xe67e22, 1); bpGfx.fillRoundedRect(40, 25, 20, 15, 4); // Stam
    bpGfx.generateTexture('bouncepad16', 100, 40); bpGfx.destroy();

    // Stjärna
    const sGfx = scene.make.graphics();
    sGfx.fillStyle(0xf1c40f, 1); sGfx.fillRect(10,0,4,24); sGfx.fillRect(0,10,24,4);
    sGfx.fillRect(4,4,16,16); sGfx.fillStyle(0xffffff, 1); sGfx.fillRect(6,6,4,4);
    sGfx.generateTexture('star16', 24, 24); sGfx.destroy();

    // Solen (Ny och snygg)
    const sunGfx = scene.make.graphics();
    sunGfx.fillStyle(0xf39c12, 1); 
    sunGfx.beginPath(); sunGfx.arc(120, 120, 115, 0, Math.PI*2, false); sunGfx.fillPath(); // Korona
    sunGfx.fillStyle(0xf1c40f, 1); 
    sunGfx.beginPath(); sunGfx.arc(120, 120, 95, 0, Math.PI*2, false); sunGfx.fillPath(); // Kropp
    sunGfx.fillStyle(0xffffff, 0.4); 
    sunGfx.beginPath(); sunGfx.arc(120, 120, 70, 0, Math.PI*2, false); sunGfx.fillPath(); // Centrumljus
    // Sol-leende
    sunGfx.fillStyle(0x000000, 1); sunGfx.fillCircle(85, 95, 10); sunGfx.fillCircle(155, 95, 10);
    sunGfx.lineStyle(6, 0x000000); sunGfx.beginPath(); sunGfx.arc(120, 120, 45, 0.2, Math.PI - 0.2, false); sunGfx.strokePath();
    sunGfx.generateTexture('sun16', 240, 240); sunGfx.destroy();

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

    // Mark
    const grGfx = scene.make.graphics();
    grGfx.fillStyle(0x27ae60, 1); grGfx.fillRect(0, 0, 800, 100);
    grGfx.fillStyle(0x2ecc71, 1); grGfx.fillRect(0, 0, 800, 20); // Övre ljusare rand
    grGfx.generateTexture('ground16', 800, 100); grGfx.destroy();

    // === Bakgrundsdekorationer ===
    // Fågel
    const biGfx = scene.make.graphics();
    biGfx.fillStyle(0x000000, 1); biGfx.fillTriangle(0, 5, 10, 0, 20, 5); biGfx.fillTriangle(10, 0, 10, 10, 15, 5);
    biGfx.generateTexture('bird16', 20, 10); biGfx.destroy();
    
    // Flygplan
    const plGfx = scene.make.graphics();
    plGfx.fillStyle(0xecf0f1, 1); plGfx.fillEllipse(30, 15, 30, 10); // Kropp
    plGfx.fillStyle(0xbdc3c7, 1); plGfx.fillEllipse(30, 20, 10, 25); // Vingar
    plGfx.fillStyle(0xe74c3c, 1); plGfx.fillEllipse(5, 15, 5, 12); // Stjärt
    plGfx.generateTexture('plane16', 60, 40); plGfx.destroy();
    
    // Luftballong
    const balGfx = scene.make.graphics();
    balGfx.fillStyle(0xe74c3c, 1); balGfx.fillCircle(20, 20, 20);
    balGfx.fillStyle(0xf1c40f, 1); balGfx.fillRect(15, 20, 10, 20);
    balGfx.fillStyle(0x8e44ad, 1); balGfx.fillRect(15, 40, 10, 10); // Korg
    balGfx.generateTexture('balloon16', 40, 50); balGfx.destroy();

    // Satellit
    const satGfx = scene.make.graphics();
    satGfx.fillStyle(0x95a5a6, 1); satGfx.fillRect(15, 15, 20, 20); // Kropp
    satGfx.fillStyle(0x3498db, 1); satGfx.fillRect(0, 20, 15, 10); satGfx.fillRect(35, 20, 15, 10); // Paneler
    satGfx.fillStyle(0xe74c3c, 1); satGfx.fillCircle(25, 15, 3); // Antenn-ljus
    satGfx.generateTexture('satellite16', 50, 50); satGfx.destroy();

    // Raket
    const rGfx = scene.make.graphics();
    rGfx.fillStyle(0xbdc3c7, 1); rGfx.fillEllipse(20, 25, 10, 25);
    rGfx.fillStyle(0xe74c3c, 1); rGfx.fillTriangle(20, 0, 10, 15, 30, 15); // Nos
    rGfx.fillStyle(0xe74c3c, 1); rGfx.fillTriangle(10, 40, 5, 50, 15, 45); rGfx.fillTriangle(30, 40, 35, 50, 25, 45); // Fenor
    rGfx.fillStyle(0xf1c40f, 1); rGfx.fillCircle(20, 50, 6); // Eld
    rGfx.generateTexture('rocket16', 40, 60); rGfx.destroy();
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
    bgEntitiesGroup = this.add.group();

    // Moln i bakgrunden för parallax
    for(let i=0; i<30; i++) {
        let cx = Math.random() * W * 4 - W * 2;
        let cy = -Math.random() * 5000;
        let c = this.add.sprite(cx, cy, 'cloud16');
        c.setScrollFactor(0.2 + Math.random() * 0.3).setAlpha(0.5).setDepth(-5).setScale(0.5 + Math.random());
    }

    // Spelare
    player = this.physics.add.sprite(W/2, 100, 'player16');
    player.setBounce(0).setDepth(10);
    player.body.setSize(38, 38).setOffset(5, 5);

    // Då spelet genererar chunkar baserat på var man är, generera startområdet!
    let startCx = Math.floor(player.x / CHUNK_SIZE);
    let startCy = Math.floor(player.y / CHUNK_SIZE);
    for(let dx=-2; dx<=2; dx++) {
        for(let dy=-1; dy<=1; dy++) {
            generateChunk(this, startCx + dx, startCy + dy);
        }
    }
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

    // MARKNIVÅ (Inga hål, solid mark)
    if (cy >= 0) {
        let ground = platforms.create(startX + CHUNK_SIZE/2, 450, 'ground16');
        ground.setScale(2).refreshBody();
        ground.setData('type', 'ground');
        
        // Se till att det finns en "trappa" uppåt om vi är direkt ovan marken
        if (cy === 0) {
            let p1 = platforms.create(startX + CHUNK_SIZE * 0.3, 200, 'leaf16');
            p1.setData('type', 'leaf'); p1.refreshBody();
            
            let p2 = platforms.create(startX + CHUNK_SIZE * 0.7, 50, 'branch16');
            p2.setData('type', 'branch'); p2.refreshBody();
        }
        
        return; // Avbryt vanliga plattformar här nere
    }
    
    // RYMD OCH SOL (Vinstnivå minskad till ca 1/3)
    if (cy <= -11) {
        if (!scene.sunCreated && Math.abs(cx - Math.floor(player.x/CHUNK_SIZE)) <= 1) {
            scene.sunCreated = true;
            let leX = player.x;
            let leY = cy * CHUNK_SIZE + 400; // Ungefär vid -6200
            
            // En garanterad slutplattform under solen
            let pFinal = platforms.create(leX, leY + 200, 'leaf16');
            pFinal.setData('type', 'leaf'); pFinal.refreshBody();
            scene.finalPlat = pFinal;

            // Placeras direkt ovanför slutplattformen
            let sun = fruitsGroup.create(leX, leY - 100, 'sun16');
            sun.setData('type', 'sun');
            sun.setScale(1.2).refreshBody();
            scene.tweens.add({ targets: sun, scaleX: 1.4, scaleY: 1.4, yoyo: true, repeat: -1, duration: 1500 });
            scene.tweens.add({ targets: sun, angle: 360, repeat: -1, duration: 15000 });
            scene.theSun = sun;
        }
        return; // Inga plattformar över solen
    }
    
    // Vi lägger in plattformar sporadiskt i denna region
    // Låt oss säga ca 3-5 plattformar per chunk för bra balans
    const numPlatforms = 3 + Math.floor(Math.random() * 3);
    for(let i=0; i<numPlatforms; i++) {
        // Ska denna plattform bli en ovanlig studsmatta? (Ca 1 på 20)
        let isBouncepad = Math.random() < 0.05;

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
                
                // Om vi genererar OVANFÖR en existerande bouncepad, ska det vara fritt 1200px uppåt.
                if (!isBouncepad && ep.getData('type') === 'bouncepad' && Math.abs(ep.x - px) < 120 && (py < ep.y && py > ep.y - 1200)) overlap = true;
                
                // Om VI ÄR en bouncepad och genererar UNDER något existerande.
                if (isBouncepad && Math.abs(ep.x - px) < 120 && (ep.y < py && ep.y > py - 1200)) overlap = true;
            });
            
            // Kolla så frukter inte är i vägen för bouncepaden uppåt.
            fruitsGroup.getChildren().forEach(ep => {
                if (isBouncepad && Math.abs(ep.x - px) < 120 && (ep.y < py && ep.y > py - 1200)) overlap = true;
            });
            
            // Hoppa över om vi är extremt nära spawn-regionen
            if (Math.abs(px - (scene.scale.width/2)) < 150 && Math.abs(py - (scene.scale.height/2 - 50)) < 150) overlap = true;

            if (!overlap) { valid = true; break; }
        }
        
        if (!valid) continue; // Hoppa över om chuken var för full

        const rand = Math.random();
        let plat;

        if (isBouncepad) {
            plat = platforms.create(px, py, 'bouncepad16');
            plat.setData('type', 'bouncepad');
            // Placera högre depth så den syns tydligt ifall det skulle klippa med lianer
            plat.setDepth(15);
        } else if (rand < 0.40) {
            plat = platforms.create(px, py, 'leaf16');
            plat.setData('type', 'leaf');
        } else if (rand < 0.55) {
            plat = platforms.create(px, py, 'branch16');
            plat.setData('type', 'branch');
        } else if (rand < 0.70) {
            plat = platforms.create(px, py, 'vine16');
            plat.setData('type', 'vine');
            plat.setData('startX', px);
            plat.setData('swingSpeed', 1.0 + Math.random());
            plat.setData('swingPhase', Math.random() * Math.PI*2);
        } else {
            // Frukter - 30% chans totalt per plattform!
            const fRand = Math.random();
            if (fRand < 0.20) {
                plat = fruitsGroup.create(px, py, 'fruit16');
                plat.setData('type', 'fruit');
            } else if (fRand < 0.40) {
                plat = fruitsGroup.create(px, py, 'chili16');
                plat.setData('type', 'chili');
            } else if (fRand < 0.60) {
                plat = fruitsGroup.create(px, py, 'melon16');
                plat.setData('type', 'melon');
            } else if (fRand < 0.80) {
                plat = fruitsGroup.create(px, py, 'blueberry16');
                plat.setData('type', 'blueberry');
            } else {
                plat = fruitsGroup.create(px, py, 'banana16'); // 20% chans för banan av alla frukter
                plat.setData('type', 'banana');
            }
            scene.tweens.add({ targets: plat, y: py - 7, yoyo: true, repeat: -1, duration: 1000 + Math.random()*500 });
        }
        if (plat.refreshBody) plat.refreshBody();

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
    gameStartTime = Date.now();
    lastProgressTime = Date.now();
    lastProgressY = player.y;
}

function onPlatformLand(p, plat) {
    if (p.body.velocity.y < 0) return;
    if (p.body.y + p.body.height > plat.body.y + 20) return;
    
    if (!plat.body.enable) return;

    if (plat.getData('type') === 'bouncepad') {
        p.setVelocityY(-1400); // SUPERSTUDDS!
        playSound('superBounce');
        this.cameras.main.shake(200, 0.02);
        
        // Bouncepad svamp-animation
        this.tweens.add({ targets: plat, scaleY: 0.6, scaleX: 1.1, duration: 60, yoyo: true });
        
        // Stjärndamm
        const px = this.add.particles(plat.x, plat.y, 'leafPart16', {
            speed: {min:100, max:300}, angle:{min:220, max:320}, lifespan:700, alpha:{start:1, end:0}, tint: 0x9b59b6, scale:{start:1.5, end:0}, quantity:12, emitting:false
        });
        px.explode(12); this.time.delayedCall(1000, () => px.destroy());
    } else {
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
    }
    
    scoreText.setText('⭐ ' + score);
    isRescued = false; isFalling = false;
    lastProgressTime = Date.now();
    lastProgressY = p.y;
}

function collectFruit(p, plat) {
    if (!plat.body.enable) return;

    if (plat.getData('type') === 'sun') {
        // VINST!
        isStarted = false;
        p.setVelocity(0, 0);
        p.body.setAllowGravity(false);
        this.tweens.add({ targets: p, scaleX: 3, scaleY: 3, angle: 720, alpha: 0, duration: 2500 });
        playSound('superBounce');
        plat.body.enable = false;
        
        let tidSek = Math.floor((Date.now() - gameStartTime) / 1000);
        let winText = this.add.text(p.x, p.y + 150, `DU KLARADE SPELET på ${tidSek} s!\nGrod-apan nådde solen! ☀️\nSpelet startar om...`, { fontSize: '32px', fontFamily: 'Courier', color: '#fff', align: 'center', stroke:'#000', strokeThickness:6 }).setOrigin(0.5).setDepth(40);
        this.tweens.add({ targets: winText, scale: 1.2, duration: 800, yoyo:true, repeat: -1});

        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            let msg = `Fantastiskt bra hoppat! Du nådde solen på bara ${tidSek} sekunder. Du är en riktig supergrod-apa! Spelet startar snart om.`;
            let u = new SpeechSynthesisUtterance(msg); 
            u.lang = 'sv-SE'; 
            window.speechSynthesis.speak(u);
        }

        // Automatisk omstart efter 10 sekunder
        this.time.delayedCall(10000, () => {
            window.location.reload();
        });
        
        return;
    }

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
        this.time.delayedCall(20000, () => {
            if (p) this.tweens.add({ targets: p, scaleX: 1, scaleY: 1, duration: 400, ease: 'Sine.easeInOut' });
        });
        score += 8;

    } else if (plat.getData('type') === 'blueberry') {
        p.setVelocityY(-500); 
        playSound('collect');
        
        // Anti-gravity float: blåbäret gör grodan lätt som en fjäder
        p.body.setGravityY(-700); 
        this.time.delayedCall(20000, () => {
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

        // Bananen gör grodan jätteliten och snabb!
        this.tweens.add({ targets: p, scaleX: 0.5, scaleY: 0.5, duration: 400, ease: 'Elastic.easeOut' });
        this.time.delayedCall(20000, () => {
            if (p) this.tweens.add({ targets: p, scaleX: 1, scaleY: 1, duration: 400, ease: 'Sine.easeInOut' });
        });
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

    // Updatera miljö och färg beroende på hur högt (y) man kommit
    updateBackgroundAndEnv(this, player.y);
    
    // Se till att solen (om skapad) alltid svävar precis över dig i horisontell led
    if (this.theSun && this.finalPlat) {
        this.theSun.x = player.x; this.theSun.refreshBody();
        this.finalPlat.x = player.x; this.finalPlat.refreshBody();
    }

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

function updateBackgroundAndEnv(scene, y) {
    let color;
    // Nya intervaller baserat på 1/3 avstånd till solen
    if (y > 0) color = Phaser.Display.Color.HexStringToColor('#5dade2'); // Ljusblå
    else if (y > -1500) {
        let f = Math.max(0, -y / 1500);
        color = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.HexStringToColor('#5dade2'),
            Phaser.Display.Color.HexStringToColor('#2980b9'), 1, f);
    } else if (y > -3500) {
        let f = Math.max(0, -(y + 1500) / 2000);
        color = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.HexStringToColor('#2980b9'),
            Phaser.Display.Color.HexStringToColor('#154360'), 1, f);
    } else if (y > -5000) {
        let f = Math.max(0, -(y + 3500) / 1500);
        color = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.HexStringToColor('#154360'),
            Phaser.Display.Color.HexStringToColor('#000000'), 1, f);
    } else {
        color = Phaser.Display.Color.HexStringToColor('#000000'); 
    }
    
    let colObj = (typeof color === 'object') ? color : Phaser.Display.Color.IntegerToColor(color);
    scene.cameras.main.setBackgroundColor(colObj);
    
    // Rymd-stjärnor tidigare
    if (y < -4000) {
        if (!scene.spaceStars) {
            scene.spaceStars = scene.add.particles(0, 0, 'pixel', {
                x: { min: -1000, max: 1000 },
                y: { min: -1000, max: 1000 },
                lifespan: 3000,
                alpha: { start: 0, end: 1, yoyo: true },
                scale: { min: 0.1, max: 0.4 },
                quantity: 4,
                blendMode: 'ADD'
            });
            scene.spaceStars.setDepth(-1);
        }
        scene.spaceStars.setPosition(player.x, player.y);
    } else if (scene.spaceStars) {
        scene.spaceStars.destroy();
        scene.spaceStars = null;
    }
    
    // Tona ut skogen ju högre upp man kommer
    let depthFactor = Math.max(0, Math.min(1, (y + 2000) / 2000)); 
    bgLayers.forEach(layer => layer.sprite.setAlpha(0.5 * depthFactor));

    // Slumpmässiga bakgrundselement (Fåglar, flygplan, satelliter)
    if (isStarted && Math.random() < 0.015) {
        let isSpace = y < -4000;
        let type;
        if (isSpace) {
            type = Math.random() < 0.5 ? 'satellite16' : 'rocket16';
        } else {
            let r = Math.random();
            if (r < 0.4) type = 'bird16';
            else if (r < 0.7) type = 'plane16';
            else type = 'balloon16';
        }
        
        let dir = Math.random() < 0.5 ? 1 : -1;
        let pY = y + (Math.random() - 0.5) * 800;
        
        let entity = bgEntitiesGroup.create(player.x - dir * 1000, pY, type);
        entity.setScrollFactor(0.2).setDepth(-3).setAlpha(0.8);
        if (dir === -1 && type !== 'balloon16') entity.setFlipX(true);
        if (type === 'rocket16') entity.setAngle(dir === 1 ? 45 : -45);
        if (type === 'satellite16') scene.tweens.add({ targets: entity, angle: 360, duration: 15000, repeat: -1 });
        
        scene.tweens.add({
            targets: entity,
            x: player.x + dir * 1500,
            y: type === 'rocket16' ? pY - 800 : pY, // Raketer flyger även snett uppåt
            duration: 9000 + Math.random() * 5000,
            onComplete: () => { if (entity) entity.destroy(); }
        });
    }
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
