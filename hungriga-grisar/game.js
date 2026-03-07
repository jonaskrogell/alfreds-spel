const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreSpan = document.getElementById('score');
const startScreen = document.getElementById('start-screen');

let isPlaying = false;
let startTime = 0;
let frames = 0;
let lastInputTime = 0;

// Ljudhantering utan externa filer
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'jump') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'fart') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(30, now + 0.3);
        
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.linearRampToValueAtTime(0.01, now + 0.3);
        
        // Bubbling effect
        const mod = audioCtx.createOscillator();
        mod.type = 'square';
        mod.frequency.value = 40;
        const modGain = audioCtx.createGain();
        modGain.gain.value = 50;
        mod.connect(modGain);
        modGain.connect(osc.frequency);
        mod.start(now);
        mod.stop(now + 0.3);
        
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'splat') {
        const bufferSize = audioCtx.sampleRate * 0.2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(100, now + 0.2);
        
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        noise.start(now);
    } else if (type === 'happy') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'yuck') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.3);
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'win') {
        osc.disconnect();
        const notes = [440, 554, 659, 880, 1108, 1318];
        notes.forEach((freq, i) => {
            const nOsc = audioCtx.createOscillator();
            const nGain = audioCtx.createGain();
            nOsc.type = 'triangle';
            nOsc.frequency.value = freq;
            nOsc.connect(nGain);
            nGain.connect(audioCtx.destination);
            nGain.gain.setValueAtTime(0, now);
            nGain.gain.setValueAtTime(0.3, now + i * 0.15);
            nGain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.5);
            nOsc.start(now + i * 0.15);
            nOsc.stop(now + i * 0.15 + 0.5);
        });
        return;
    }
}

function winGame() {
    isPlaying = false;
    playSound('win');
    const finalTime = Math.floor((Date.now() - startTime) / 1000);
    
    let evaluationMessage = "";
    let voiceMessage = "";

    if (finalTime <= 40) {
        evaluationMessage = "Bäst!";
        voiceMessage = `Du klarade det på ${finalTime} sekunder. Det är bäst!`;
    } else if (finalTime <= 45) {
        evaluationMessage = "Fantastiskt!";
        voiceMessage = `Du klarade det på ${finalTime} sekunder. Det är fantastiskt!`;
    } else if (finalTime <= 50) {
        evaluationMessage = "Bättre!";
        voiceMessage = `Du klarade det på ${finalTime} sekunder. Det är bättre!`;
    } else if (finalTime <= 55) {
        evaluationMessage = "Superjättebra!";
        voiceMessage = `Du klarade det på ${finalTime} sekunder. Det är superjättebra!`;
    } else if (finalTime <= 60) {
        evaluationMessage = "Jättebra!";
        voiceMessage = `Du klarade det på ${finalTime} sekunder. Det är jättebra!`;
    } else if (finalTime <= 65) {
        evaluationMessage = "Bra!";
        voiceMessage = `Du klarade det på ${finalTime} sekunder. Det är bra!`;
    } else {
        evaluationMessage = "Bättre lycka nästa gång!";
        voiceMessage = `Du klarade det på ${finalTime} sekunder. Bättre lycka nästa gång!`;
    }

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(voiceMessage);
        utterance.lang = 'sv-SE';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }

    startScreen.style.display = 'flex';
    startScreen.innerHTML = `<h1 style="font-size: clamp(30px, 8vw, 60px); margin-bottom: 10px; text-align: center;">🎉 DU VANN! 🎉</h1><h2 style="font-size: clamp(14px, 4vw, 24px); text-align: center;">Grisen åt sig ända upp till fåglarna på ${finalTime} sekunder!<br>Betyg: ${evaluationMessage}<br><br>Tryck eller klicka för att spela igen.</h2>`;
}

// Spelobjekt
const pig = {
    x: 100,
    y: 350,
    baseSize: 60,
    size: 60,
    width: 60,
    height: 60,
    vy: 0,
    gravity: 0.8,
    jumpPower: -18,
    isJumping: false,
    isDucking: false,
    duckTimer: 0,
    draw() {
        ctx.font = this.size + 'px Arial';
        ctx.textBaseline = 'top';
        if (this.isDucking) {
            ctx.save();
            ctx.translate(this.x, this.y + this.size);
            ctx.scale(1, 0.5); // Grisen hukar sig platt till hälften
            ctx.fillText('🐷', 0, -this.size);
            ctx.restore();
        } else {
            ctx.fillText('🐷', this.x, this.y);
        }
    },
    update() {
        this.y += this.vy;
        this.vy += this.gravity;

        const floorY = 450 - (this.size - this.baseSize);

        // Golv
        if (this.y > floorY) {
            this.y = floorY;
            this.vy = 0;
            this.isJumping = false;
        }

        // Tuta upp igen om vi duckar
        if (this.isDucking) {
            this.duckTimer--;
            if (this.duckTimer <= 0) {
                this.isDucking = false;
            }
        }
    },
    jump() {
        if (!this.isJumping) {
            this.vy = this.jumpPower;
            this.isJumping = true;
            this.isDucking = false; // Man kan inte ducka när man börjar ett hopp
            playSound('jump');
            playSound('fart');
            createFart();
        }
    },
    duck() {
        this.isDucking = true;
        this.duckTimer = 60; // Ducka i ca 1 sekund (60 frames)
        if (this.isJumping) {
            this.vy = 25; // För doubleclicks i luften - krascha neråt snabbt!
        } else {
            playSound('fart'); // Annars en liten mysig huk-fart
        }
    }
};

const birds = [];
const foodsArr = [];
const farts = [];

function createFart() {
    for (let i = 0; i < 3; i++) {
        farts.push({
            x: pig.x - 20 + Math.random() * 20,
            y: pig.y + 40 + Math.random() * 20,
            vx: -2 - Math.random() * 3,
            vy: -1 + Math.random() * 2,
            life: 30
        });
    }
}

function updateDrawFarts() {
    for (let i = farts.length - 1; i >= 0; i--) {
        const f = farts[i];
        f.x += f.vx;
        f.y += f.vy;
        f.life--;
        ctx.font = '40px Arial';
        ctx.globalAlpha = f.life / 30;
        ctx.fillText('💨', f.x, f.y);
        ctx.globalAlpha = 1.0;

        if (f.life <= 0) {
            farts.splice(i, 1);
        }
    }
}

function spawnBird() {
    birds.push({
        x: 900,
        y: 50 + Math.random() * 150,
        width: 60,
        height: 60,
        vx: -4 - Math.random() * 2,
        hasDroppedFood: false
    });
}

function updateDrawBirds() {
    if (frames % 120 === 0) {
        spawnBird();
    }

    for (let i = birds.length - 1; i >= 0; i--) {
        const b = birds[i];
        b.x += b.vx;
        
        ctx.font = '60px Arial';
        ctx.fillText('🐦', b.x, b.y);

        // Mat! Det kommer på olika höjder!
        if (b.x < 700 && b.x > 300 && !b.hasDroppedFood && Math.random() < 0.05) {
            const foods = ['🍔', '🌽', '🍗', '🥦'];
            const emoji = foods[Math.floor(Math.random() * foods.length)];
            
            foodsArr.push({
                x: b.x + 10,
                y: 150 + Math.random() * 300, // Olika höjder så man måste tajma hoppen
                width: 40,
                height: 40,
                vx: -6, // Rör sig vänster!
                emoji: emoji,
                isBroccoli: emoji === '🥦'
            });
            b.hasDroppedFood = true;
        }

        if (b.x < -100) {
            birds.splice(i, 1);
        }
    }
}

function updateDrawFoods() {
    for (let i = foodsArr.length - 1; i >= 0; i--) {
        const f = foodsArr[i];
        
        f.x += f.vx;
        
        ctx.font = '40px Arial';
        ctx.fillText(f.emoji, f.x, f.y);

        // Kollision med gris (hitbox anpassad till grisens storlek och duckning)
        const pigY = pig.isDucking ? pig.y + pig.size / 2 : pig.y;
        const pigHeight = pig.isDucking ? pig.height / 2 : pig.height;

        const hitX = f.x < pig.x + pig.width && f.x + f.width > pig.x;
        const hitY = f.y < pigY + pigHeight && f.y + f.height > pigY;

        if (hitX && hitY) {
            if (f.isBroccoli) {
                // Broccoli! Usch!
                playSound('yuck');
                pig.size = Math.max(pig.baseSize, pig.size - 10);
            } else {
                // Äta god mat!
                playSound('happy');
                pig.size += 15; // Snabbare tillväxt
            }
            
            pig.width = pig.size;
            pig.height = pig.size;
            
            foodsArr.splice(i, 1);
            
            if (pig.size >= 320) { // Nu når den ända upp till fåglarna!
                winGame();
            }
            continue;
        }

        // Ta bort mat när den åker ut till vänster
        if (f.x < -100) {
            foodsArr.splice(i, 1);
        }
    }
}

function resetGame() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    pig.size = pig.baseSize;
    pig.width = pig.baseSize;
    pig.height = pig.baseSize;
    pig.y = 450;
    pig.vy = 0;
    pig.isJumping = false;
    pig.isDucking = false;
    birds.length = 0;
    foodsArr.length = 0;
    farts.length = 0;
    startTime = Date.now();
    frames = 0;
    scoreSpan.innerText = "0s";
}

function gameLoop() {
    if (!isPlaying) return;

    // Rensa och rita bakgrund (sol kan vara roligt)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Sol
    ctx.font = '80px Arial';
    ctx.fillText('☀️', 650, 50);

    pig.update();
    pig.draw();
    
    updateDrawFarts();
    updateDrawBirds();
    updateDrawFoods();

    const currentElapsed = Math.floor((Date.now() - startTime) / 1000);
    scoreSpan.innerText = currentElapsed + "s";

    frames++;
    requestAnimationFrame(gameLoop);
}

function handleInput(e) {
    // Ignorera tryck på hjälpknappen eller tillbakaknappen
    if (e.target.id === 'help-btn' || (e.target.closest && e.target.closest('#help-btn'))) return;
    if (e.target.id === 'back-btn' || (e.target.closest && e.target.closest('#back-btn'))) return;

    if (e.type === 'keydown') {
        if (e.code !== 'Space') return;
        if (e.repeat) return; // Förhindra "hacket" med att hålla inne tangenten
    }
    
    // Förhindra skrollning eller dubbla events vid touch och mellanslag
    if (e.type === 'touchstart' || (e.type === 'keydown' && e.code === 'Space')) {
        if (e.cancelable) e.preventDefault();
    }

    if (!isPlaying) {
        initAudio();
        
        // Väck talsyntesen för iOS som kräver ett musklick
        if ('speechSynthesis' in window) {
             const preUtterance = new SpeechSynthesisUtterance("");
             window.speechSynthesis.speak(preUtterance);
        }

        startScreen.style.display = 'none';
        isPlaying = true;
        resetGame();
        gameLoop();
    } else {
        const now = Date.now();
        // Kolla efter dubbeltryck för att ducka! (Inom 300 ms)
        if (now - lastInputTime < 300) {
            pig.duck();
            lastInputTime = 0; // Återställ så man inte spam-duckar galet
        } else {
            pig.jump();
            lastInputTime = now;
        }
    }
}

window.addEventListener('keydown', handleInput);
window.addEventListener('touchstart', handleInput, { passive: false });
window.addEventListener('mousedown', handleInput);

const helpBtn = document.getElementById('help-btn');
helpBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(
            'Välkommen till Hungriga Grisar! ' +
            'Tryck på skärmen eller mellanslag för att hoppa. ' +
            'Fånga hamburgare, majs och kycklingklubbor för att grisen ska växa. ' +
            'Undvik broccolin, den gör grisen mindre! ' +
            'När grisen är jättestor har du vunnit. ' +
            'Dubbelklicka snabbt för att ducka under broccolin.'
        );
        msg.lang = 'sv-SE';
        msg.rate = 0.9;
        window.speechSynthesis.speak(msg);
    }
});

document.getElementById('back-btn').addEventListener('click', (e) => {
    e.preventDefault();
    if (window.parent !== window) {
        window.parent.postMessage('goBack', '*');
    } else {
        window.location.href = '../index.html';
    }
});
