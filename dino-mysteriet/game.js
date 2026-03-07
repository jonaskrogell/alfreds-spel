const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreSpan = document.getElementById('score');
const startScreen = document.getElementById('start-screen');

let isPlaying = false;
let foundEggs = 0;
const totalEggs = 5;
let frames = 0;
let interactables = [];
let babies = [];
let lastShuffleTime = 0;

// Bakgrunds-dinosaurien som vandrar runt
const bgDino = {
    x: 100,
    y: 340,
    vx: 1.5,
    facingRight: true
};

// Audio hantering
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
    const now = audioCtx.currentTime;

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'rustle') {
        const bufferSize = audioCtx.sampleRate * 0.2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1000, now);
        
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        noise.connect(filter);
        filter.connect(gainNode);
        noise.start(now);
        return;
    } else if (type === 'magic') {
        // Hitta ägg - magiskt pling
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3);
        
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.5, now + 0.05);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'frog') {
        // Groda
        osc.type = 'square';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(80, now + 0.1);
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'monkey') {
        // Apa
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.linearRampToValueAtTime(800, now + 0.1);
        osc.frequency.linearRampToValueAtTime(400, now + 0.2);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'bat') {
        // Fladdermus
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2000, now);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
        
        // Dubbelpip
        setTimeout(() => {
            const osc2 = audioCtx.createOscillator();
            const gainNode2 = audioCtx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(2200, audioCtx.currentTime);
            gainNode2.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
            osc2.connect(gainNode2);
            gainNode2.connect(audioCtx.destination);
            osc2.start(audioCtx.currentTime);
            osc2.stop(audioCtx.currentTime + 0.05);
        }, 100);
        return;
    } else if (type === 'win') {
        osc.disconnect();
        const notes = [523, 659, 783, 1046, 1318];
        notes.forEach((freq, i) => {
            const nOsc = audioCtx.createOscillator();
            const nGain = audioCtx.createGain();
            nOsc.type = 'triangle';
            nOsc.frequency.value = freq;
            nOsc.connect(nGain);
            nGain.connect(audioCtx.destination);
            nGain.gain.setValueAtTime(0, now);
            nGain.gain.setValueAtTime(0.4, now + i * 0.15);
            nGain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);
            nOsc.start(now + i * 0.15);
            nOsc.stop(now + i * 0.15 + 0.4);
        });
        return;
    }
}

// Spel-logik

function createLevel() {
    interactables = [];
    babies = [];
    const positions = [
        {x: 100, y: 380}, {x: 300, y: 360}, {x: 500, y: 390}, {x: 700, y: 370},
        {x: 150, y: 480}, {x: 350, y: 500}, {x: 550, y: 470}, {x: 750, y: 490},
        {x: 50, y: 560}, {x: 250, y: 580}, {x: 450, y: 550}, {x: 650, y: 570}
    ];
    
    // Slumpa fram 5 specifika index som får äggen
    const eggIndices = [];
    while(eggIndices.length < totalEggs) {
        const r = Math.floor(Math.random() * positions.length);
        if(eggIndices.indexOf(r) === -1) eggIndices.push(r);
    }
    
    // De övriga får andra djur eller inget (skräp)
    const covers = ['🌿', '🪨', '🕳'];
    const animals = ['🐸', '🐒', '🦇', '🦋'];

    positions.forEach((pos, i) => {
        const isEgg = eggIndices.includes(i);
        const animal = animals[Math.floor(Math.random() * animals.length)];
        
        interactables.push({
            x: pos.x,
            y: pos.y,
            width: 100,
            height: 100,
            coverEmoji: covers[Math.floor(Math.random() * covers.length)],
            contentEmoji: isEgg ? '🥚' : animal,
            isEgg: isEgg,
            isOpened: false,
            isFound: false, // För ägg som hittats permanent
            openedAt: 0, // När öppnades den
            popOffset: 0,
            shakeOffset: 0
        });
    });
}

function handleInteractableClick(x, y) {
    // Omvandla koordinater (spelet skalas med responsiv #game-container)
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const gameX = (x - rect.left) * scaleX;
    const gameY = (y - rect.top) * scaleY;
    
    // Leta efter objekt i omvänd ordning (det översta klickas först)
    for (let i = interactables.length - 1; i >= 0; i--) {
        const item = interactables[i];
        
        // Har vi klickat på den, och är den oöppnad?
        // Offset i renderingen är centrerad, vi beräknar ytan:
        const itemLeft = item.x - item.width/2;
        const itemRight = item.x + item.width/2;
        const itemTop = item.y - item.height; // textBaseline är alphabetic
        const itemBottom = item.y;
        
        if (!item.isOpened && !item.isFound && gameX >= itemLeft && gameX <= itemRight && gameY >= itemTop && gameY <= itemBottom) {
            item.isOpened = true;
            item.openedAt = Date.now();
            item.popOffset = 0;
            
            if (item.isEgg) {
                playSound('magic');
                item.isFound = true; // Ägg stannar permanent!
                foundEggs++;
                scoreSpan.innerText = `${foundEggs} / ${totalEggs}`;
                
                if (foundEggs >= totalEggs) {
                    setTimeout(winGame, 1000);
                }
            } else {
                playSound('rustle');
                setTimeout(() => {
                    if (item.contentEmoji === '🐸') playSound('frog');
                    else if (item.contentEmoji === '🐒') playSound('monkey');
                    else if (item.contentEmoji === '🦇') playSound('bat');
                    else playSound('rustle');
                }, 100);
            }
            break;
        }
    }
}

function winGame() {
    isPlaying = false;
    playSound('win');
    
    // Byt ut äggen mot dansande bebisar för sista animationen
    babies = interactables.filter(i => i.isEgg).map(item => {
        return {
            x: item.x,
            y: item.y,
            vy: 0,
            gravity: 1,
            jumpFrames: 0
        };
    });
    
    let voiceMessage = "Grattis! Du hittade alla fem äggen, och nu har de kläckts till vackra små dinosaurier!";

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(voiceMessage);
        utterance.lang = 'sv-SE';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }
    
    setTimeout(() => {
        startScreen.style.display = 'flex';
        startScreen.innerHTML = `<h1 style="font-size: clamp(30px, 8vw, 60px); margin-bottom: 10px; text-align: center;">🎉 DU KLARADE DET! 🎉</h1><h2 style="font-size: clamp(16px, 4vw, 30px); text-align: center;">Du räddade alla dino-bebisarna!<br><br>Tryck eller klicka för att spela igen.</h2>`;
    }, 4000);
}

function resetGame() {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }
    foundEggs = 0;
    frames = 0;
    lastShuffleTime = Date.now();
    scoreSpan.innerText = `0 / ${totalEggs}`;
    createLevel();
}

function shuffleUnfound() {
    // Samla ihop alla icke-hittade objekt
    const unfound = interactables.filter(item => !item.isFound);
    
    // Slumpa om deras innehåll (ägg vs djur blandas om)
    const contents = unfound.map(item => ({ contentEmoji: item.contentEmoji, isEgg: item.isEgg }));
    for (let i = contents.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [contents[i], contents[j]] = [contents[j], contents[i]];
    }
    
    unfound.forEach((item, i) => {
        item.contentEmoji = contents[i].contentEmoji;
        item.isEgg = contents[i].isEgg;
        item.isOpened = false;
        item.popOffset = 0;
        // Ge ny cover-emoji också
        const covers = ['🌿', '🪨', '🕳'];
        item.coverEmoji = covers[Math.floor(Math.random() * covers.length)];
        // Skakning för att visa att något hände
        item.shakeOffset = 15;
    });
    
    playSound('rustle');
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Sol och moln i luften
    ctx.font = '80px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('☀️', 650, 80);
    ctx.fillText('☁️', 100, 100);
    ctx.fillText('☁️', 350, 60);

    // Dinosaurien vandrar runt!
    bgDino.x += bgDino.vx;
    if (bgDino.x > 750) {
        bgDino.vx = -1.5;
        bgDino.facingRight = false;
    } else if (bgDino.x < 50) {
        bgDino.vx = 1.5;
        bgDino.facingRight = true;
    }
    ctx.font = '120px Arial';
    ctx.textAlign = 'center';
    if (bgDino.facingRight) {
        ctx.fillText('🦖', bgDino.x, bgDino.y);
    } else {
        ctx.save();
        ctx.translate(bgDino.x, bgDino.y);
        ctx.scale(-1, 1);
        ctx.fillText('🦖', 0, 0);
        ctx.restore();
    }

    const now = Date.now();

    if (isPlaying) {
        // Stäng icke-ägg-buskar efter 3 sekunder
        interactables.forEach(item => {
            if (item.isOpened && !item.isFound && now - item.openedAt > 3000) {
                item.isOpened = false;
                item.popOffset = 0;
            }
        });

        // Blanda om alla icke-hittade positioner var 15:e sekund
        const timeSinceShuffle = now - lastShuffleTime;
        const shuffleWarning = timeSinceShuffle > 12000; // Sista 3 sekunderna: varna!

        if (timeSinceShuffle > 15000) {
            lastShuffleTime = now;
            shuffleUnfound();
        }

        // Under varningen: skaka alla stängda buskar
        if (shuffleWarning) {
            interactables.forEach(item => {
                if (!item.isOpened && !item.isFound && item.shakeOffset === 0) {
                    item.shakeOffset = 5;
                }
            });
        }

        // Z-sortera så buskar lägre ner hamnar framför
        interactables.sort((a,b) => a.y - b.y).forEach(item => {
            ctx.font = '100px Arial';
            ctx.textAlign = 'center';
            
            if (item.isFound) {
                // Hittade ägg - visa permanent med guldskimmer
                ctx.font = '70px Arial';
                ctx.globalAlpha = 1.0;
                ctx.fillText(item.contentEmoji, item.x, item.y - 50);
                ctx.globalAlpha = 1.0;
            } else if (item.isOpened) {
                // Tillfälligt öppnad (icke-ägg)
                if (item.popOffset < 30) {
                    item.popOffset += 2;
                }
                
                ctx.font = '70px Arial';
                ctx.globalAlpha = 1.0;
                ctx.fillText(item.contentEmoji, item.x, item.y - 20 - item.popOffset);
                
                ctx.font = '100px Arial';
                ctx.globalAlpha = 0.3;
                ctx.fillText(item.coverEmoji, item.x, item.y);
                ctx.globalAlpha = 1.0;
            } else {
                // Stängd buske/sten
                if (Math.random() < 0.01 && item.shakeOffset === 0) {
                    item.shakeOffset = 10;
                }
                
                if (item.shakeOffset > 0) {
                    item.shakeOffset--;
                    ctx.save();
                    ctx.translate(item.x, item.y);
                    ctx.rotate((item.shakeOffset % 2 === 0 ? 0.1 : -0.1));
                    ctx.fillText(item.coverEmoji, 0, 0);
                    ctx.restore();
                } else {
                    ctx.fillText(item.coverEmoji, item.x, item.y);
                }
            }
        });
    } else if (babies.length > 0) {
        // Vinnarskärmsdans!
        babies.forEach((baby, i) => {
            if (baby.y >= 450) {
                baby.y = 450;
                if (Math.random() < 0.05) {
                    baby.vy = -15 - Math.random() * 5;
                } else {
                    baby.vy = 0;
                }
            } else {
                baby.vy += baby.gravity;
            }
            baby.y += baby.vy;
            
            ctx.font = '80px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('🐣', baby.x, baby.y);
        });
        
        if (frames % 40 < 20) {
             ctx.font = '150px Arial';
             ctx.fillText('🦖❤️', 400, 300);
        } else {
             ctx.font = '150px Arial';
             ctx.fillText('🦖', 400, 300);
        }
    }

    frames++;
    if(isPlaying || babies.length > 0) {
        requestAnimationFrame(gameLoop);
    }
}

function handleInput(e) {
    if (e.target.id === 'help-btn' || (e.target.closest && e.target.closest('#help-btn'))) return;
    if (e.target.id === 'back-btn' || (e.target.closest && e.target.closest('#back-btn'))) return;
    
    if (e.type === 'touchstart' || e.type === 'mousedown') {
        if (!isPlaying && babies.length === 0) {
            initAudio();
            if ('speechSynthesis' in window) {
                window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
            }
            startScreen.style.display = 'none';
            isPlaying = true;
            resetGame();
            requestAnimationFrame(gameLoop);
        } else if (isPlaying) {
            // Skicka koordinator
            let clientX, clientY;
            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            handleInteractableClick(clientX, clientY);
        } else if (babies.length > 0 && startScreen.style.display === 'flex') {
            babies = [];
            startScreen.style.display = 'none';
            isPlaying = true;
            resetGame();
            requestAnimationFrame(gameLoop);
        }
    }
    
    // Skrolla inte
    if (e.type === 'touchstart') {
        if (e.cancelable) e.preventDefault();
    }
}

// Mus/touch
window.addEventListener('mousedown', handleInput);
window.addEventListener('touchstart', handleInput, { passive: false });

const helpBtn = document.getElementById('help-btn');
helpBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    initAudio();
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(
            'Välkommen till Dino Mysteriet! ' +
            'En dinosaurie har tappat bort sina ägg i djungeln. ' +
            'Tryck på buskar, stenar och grottor för att leta efter äggen. ' +
            'Ibland hittar du roliga djur istället, som grodor och apor. ' +
            'När du har hittat alla fem äggen så kläcks de till små dinosaurier!'
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
