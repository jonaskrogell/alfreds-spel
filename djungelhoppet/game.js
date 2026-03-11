
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
        osc.type = 'square'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
        gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'collect') {
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = 'square'; osc.frequency.setValueAtTime(600, now); osc.frequency.setValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.2);
    } else if (type === 'superBounce') {
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = 'square'; osc.frequency.setValueAtTime(300, now); osc.frequency.exponentialRampToValueAtTime(800, now + 0.3);
        gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.4);
    } else if (type === 'rescue') {
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(200, now); osc.frequency.exponentialRampToValueAtTime(600, now + 0.4);
        gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.5);
    } else if (type === 'land') {
        const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
        osc.type = 'triangle'; osc.frequency.setValueAtTime(100, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gain.gain.setValueAtTime(0.1, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.connect(gain); gain.connect(audioCtx.destination); osc.start(now); osc.stop(now + 0.1);
    }
}

// ===================== PHASER CONFIG (8-BIT) =====================
const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.RESIZE,
        parent: 'game-container',
        width: '100%',
        height: '100%'
    },
    backgroundColor: '#0d1f0d',
    pixelArt: true,
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 1200 }, debug: false }
    },
    scene: { preload, create, update }
};

const game = new Phaser.Game(config);

// Spel-variabler
let player, platforms, cursors, score = 0, distance = 0, starsGroup, startText;
let scoreText, distText, isStarted = false, isRescued = false;
let touchLeft = false, touchRight = false, lastPlatformX = 0;
let bgLayers = [], cloudParticles, guideParticles;
let monkeyActive = false, lastProgressTime = 0, lastProgressX = 0;
let activeFruits = [];

// ===================== TEXTUR-GENERERING (PIXEL ART) =====================
function preload() {}

function generatePixelArt(scene) {
    // Färg-palett
    scene.textures.generate('player8', {
        data: [
            '..3333..',
            '.333333.',
            '67333376',
            '33333333',
            '.111111.',
            '.1....1.',
            '..3..3..',
            '..3..3..'
        ],
        pixelWidth: 6, palette: { 1: '#44cc44', 3: '#33aa33', 6: '#ffffff', 7: '#111111' }
    });
    scene.textures.generate('leaf8', {
        data: [
            '.22222222222222.',
            '2333333333333332',
            '2111111111111112',
            '.22222222222222.'
        ],
        pixelWidth: 8, palette: { 1: '#228822', 2: '#115511', 3: '#33aa33' }
    });
    scene.textures.generate('fruit8', {
        data: [
            '..8888..',
            '.899998.',
            '89969998',
            '89999998',
            '89999998',
            '.899998.',
            '..8888..'
        ],
        pixelWidth: 6, palette: { 8: '#ff8800', 9: '#ffaa00', 6: '#ffffff' }
    });
    scene.textures.generate('star8', {
        data: [
            '...8...',
            '..868..',
            '.88888.',
            '8888888',
            '..888..',
            '.8...8.',
            '8.....8'
        ],
        pixelWidth: 4, palette: { 8: '#ffdd44', 6: '#ffffff' }
    });
    scene.textures.generate('monkey8', {
        data: [
            '..4444..',
            '.444444.',
            '56444465',
            '44444444',
            '.555555.',
            '.55..55.',
            '..4..4..',
            '..4..4..'
        ],
        pixelWidth: 6, palette: { 4: '#8B5A2B', 5: '#DEB887', 6: '#ffffff' }
    });

    // Enkla rektanglar via Graphics
    const p = scene.make.graphics();
    p.fillStyle(0xffffff, 1); p.fillRect(0, 0, 8, 8); p.generateTexture('pixel', 8, 8);
    p.destroy();
}

function create() {
    generatePixelArt(this);
    const W = this.scale.width;
    const H = this.scale.height;

    // Bakgrund (Parallax)
    for(let i=1; i<=3; i++) {
        const bg = this.add.tileSprite(0, 0, W*5, H, 'pixel').setOrigin(0,0).setScrollFactor(i*0.1);
        bg.setTint(i===1 ? 0x0a180a : (i===2 ? 0x1a3a1a : 0x2a5a2a));
        bg.setAlpha(0.6);
        bgLayers.push({ sprite: bg, speed: i*0.1 });
    }

    platforms = this.physics.add.staticGroup();
    starsGroup = this.physics.add.group({ allowGravity: false });

    // Startplattform
    const startPlat = platforms.create(W/2, H - 100, 'leaf8');
    startPlat.setData('type', 'leaf');
    lastPlatformX = W/2;

    // Generera skärmer framåt
    for (let i=0; i<30; i++) generatePlatform(this);

    // Spelare
    player = this.physics.add.sprite(W/2, H - 200, 'player8');
    player.setBounce(0).setDepth(10);
    player.body.setSize(player.width*0.8, player.height*0.8);

    this.physics.add.collider(player, platforms, onPlatformLand, null, this);
    this.physics.add.overlap(player, starsGroup, collectStar, null, this);

    // UI
    scoreText = this.add.text(20, 20, '⭐ 0', { fontSize: '24px', fontFamily: 'Courier', color: '#ffdd44' }).setScrollFactor(0).setDepth(20);
    distText = this.add.text(20, 50, '🚩 0m', { fontSize: '18px', fontFamily: 'Courier', color: '#88ff88' }).setScrollFactor(0).setDepth(20);

    startText = this.add.text(W/2, H/2 - 50, 'DJUNGELHOPPET\nTryck för start', { fontSize: '32px', fontFamily: 'Courier', color: '#fff', align: 'center', backgroundColor: '#000' }).setOrigin(0.5).setScrollFactor(0).setDepth(30);

    cursors = this.input.keyboard.createCursorKeys();

    this.input.on('pointerdown', (p) => {
        if(!isStarted) return startGameAction();
        if(p.x < W/2) touchLeft = true; else touchRight = true;
    });
    this.input.on('pointerup', () => { touchLeft = touchRight = false; });
    
    this.input.keyboard.on('keydown', (e) => {
        if (!isStarted && e.code === 'Space') startGameAction();
    });

    this.cameras.main.setBounds(0, -H, Number.MAX_SAFE_INTEGER, H*2);
    this.cameras.main.startFollow(player, true, 0.1, 0.1);
    this.cameras.main.setFollowOffset(-W * 0.2, 0); // Spelaren är mer till vänster
}

function generatePlatform(scene) {
    const H = scene.scale.height;
    // Slumpa Xavstånd och Y-position
    const gapX = 120 + Math.random() * 100;
    const x = lastPlatformX + gapX;
    
    // Slumpa höjd, sträva mot mitten
    let y = (H/2) + (Math.random() - 0.5) * (H * 0.6);
    
    // Antal plattformar i "kolumnen"
    const num = Math.random() < 0.4 ? 2 : 1;
    for(let i=0; i<num; i++) {
        let py = y + (i * 200 * (Math.random() > 0.5 ? 1 : -1));
        if (py > H - 50) py = H - 50;
        if (py < 100) py = 100;
        
        const rand = Math.random();
        let plat;
        if(rand < 0.8) {
            plat = platforms.create(x, py, 'leaf8');
            plat.setData('type', 'leaf');
        } else {
            plat = platforms.create(x, py, 'fruit8');
            plat.setData('type', 'fruit');
            scene.tweens.add({ targets: plat, alpha: 0.5, yoyo: true, repeat: -1, duration: 400 });
        }
        plat.refreshBody();

        if (Math.random() < 0.3) {
            const star = scene.physics.add.sprite(x, py - 60, 'star8');
            scene.tweens.add({ targets: star, y: py - 70, yoyo: true, repeat: -1, duration: 500 });
            starsGroup.add(star);
        }
    }
    lastPlatformX = x;
}

function startGameAction() {
    isStarted = true;
    initAudio();
    startText.destroy();
    player.setVelocityY(-600);
    playSound('jump');
    lastProgressTime = Date.now();
    lastProgressX = player.x;
}

function onPlatformLand(p, plat) {
    if (p.body.velocity.y < 0) return;
    if (p.body.y + p.body.height > plat.body.y + 20) return;

    if (plat.getData('type') === 'fruit') {
        p.setVelocityY(-1000); // Superhopp
        playSound('superBounce');
        this.cameras.main.shake(100, 0.01);
        
        // Återskapning logik
        plat.body.enable = false;
        plat.setVisible(false);
        this.time.delayedCall(1500, () => {
            if (plat && plat.scene) { plat.body.enable = true; plat.setVisible(true); plat.refreshBody(); }
        });
        score += 5;
    } else {
        p.setVelocityY(-600);
        playSound('jump');
        // Visuell studs
        this.tweens.add({ targets: p, scaleY: 0.7, scaleX: 1.3, duration: 50, yoyo: true });
    }
    scoreText.setText('⭐ ' + score);
    isRescued = false;
    lastProgressTime = Date.now();
}

function collectStar(p, star) {
    playSound('collect');
    score++;
    scoreText.setText('⭐ ' + score);
    star.destroy();
}

function update(time, delta) {
    if(!isStarted) return;

    const H = this.scale.height;

    // Rörelse
    const speed = 400;
    if (cursors.left.isDown || touchLeft) {
        player.setVelocityX(-speed);
        player.setFlipX(true);
    } else if (cursors.right.isDown || touchRight) {
        player.setVelocityX(speed);
        player.setFlipX(false);
    } else {
        // Kör automatiskt sakta framåt? Nej, låt spelaren styra tempot. Eller endless runner auto?
        // "Scrollar oändligt i sidled" -- vi ger konstant fart framåt!
        player.setVelocityX(250);
        player.setFlipX(false);
    }

    // Wrap om man faller ur (Räddning i botten)
    if (player.y > H + 100 && !isRescued) {
        rescuePlayer(this);
    }

    // Fixa parallax baserat på kamera
    bgLayers.forEach(layer => {
        layer.sprite.tilePositionX = this.cameras.main.scrollX * layer.speed;
    });

    // Score distans
    const d = Math.max(0, Math.floor(player.x / 100));
    if (d > distance) {
        distance = d;
        distText.setText('🚩 ' + distance + 'm');
    }

    // Generera i framkanten
    if (this.cameras.main.scrollX + this.scale.width + 1000 > lastPlatformX) {
        generatePlatform(this);
    }

    // Ta bort plattformar långt bak
    const leftEdge = this.cameras.main.scrollX - 500;
    platforms.getChildren().forEach(p => { if(p.x < leftEdge) p.destroy(); });
    starsGroup.getChildren().forEach(s => { if(s.x < leftEdge) s.destroy(); });

    // Apa check
    if (player.x > lastProgressX + 50) {
        lastProgressX = player.x; lastProgressTime = Date.now();
    }
    if (!monkeyActive && !isRescued && Date.now() - lastProgressTime > 15000) {
        // Fastnat (ramlat ner eller misslyckats framåt)
        monkeyRescue(this);
    }
}

function rescuePlayer(scene) {
    isRescued = true;
    playSound('rescue');
    scene.cameras.main.shake(100, 0.02);
    
    // Slunga uppåt & framåt
    player.setVelocityY(-900);
    player.setVelocityX(400);
}

function monkeyRescue(scene) {
    monkeyActive = true;
    playSound('collect');
    
    const m = scene.add.sprite(player.x - 100, player.y - 100, 'monkey8').setDepth(30);
    scene.tweens.add({
        targets: m, x: player.x, y: player.y, duration: 500, ease: 'Sine.easeOut',
        onComplete: () => {
            scene.tweens.add({
                targets: m, x: player.x + 500, y: player.y - 300, duration: 1500, ease: 'Sine.easeInOut',
                onUpdate: () => { player.setPosition(m.x, m.y + 20); player.setVelocity(0,0); },
                onComplete: () => {
                    player.setVelocityY(-500); player.setVelocityX(200); playSound('jump');
                    scene.tweens.add({ targets: m, alpha: 0, duration: 500, onComplete: () => m.destroy() });
                    lastProgressTime = Date.now(); lastProgressX = player.x; monkeyActive = false;
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
    e.preventDefault();
    const helpMsg = 'Grod-apan springer framåt!\\nSpelaren studsar hela tiden.\\n\\n[←] tryck vänster skärm\\n[→] tryck höger skärm\\n\\nHoppa på lianer och blad, undvik fall!';
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        let u = new SpeechSynthesisUtterance(helpMsg); u.lang = 'sv-SE'; u.rate = 1.0;
        window.speechSynthesis.speak(u);
    } else {
        alert(helpMsg);
    }
});
