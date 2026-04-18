const grid = document.getElementById('memory-grid');
const scoreText = document.getElementById('score-text');
const messageText = document.getElementById('message-text');

const animals = ['wolf', 'dog', 'bear', 'bunny', 'cat', 'frog', 'pig', 'lion'];
let cardsArray = [...animals, ...animals]; // 16 cards

// AudioContext for sounds
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

function playSound(type) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (type === 'flip') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
        gainNode.gain.setValueAtTime(0.1, now);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'match') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.1);
        osc.frequency.setValueAtTime(800, now + 0.2);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'win') {
        // Simple little cheer chord
        const freqs = [440, 554, 659, 880];
        freqs.forEach(f => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            o.type = 'sine';
            o.frequency.value = f;
            o.connect(g);
            g.connect(audioCtx.destination);
            g.gain.setValueAtTime(0.1, now);
            g.gain.linearRampToValueAtTime(0, now + 1.5);
            o.start(now);
            o.stop(now + 1.5);
        });
    }
}

// Fisher-Yates Shuffle
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

let firstCard = null;
let secondCard = null;
let lockBoard = false;
let pairsFound = 0;

const filteredImages = {};

function makeTransparent(imageSrc, callback) {
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
            // Greenscreen removal
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
        callback(c.toDataURL());
    };
    img.src = imageSrc;
}

function preloadAssets(callback) {
    let toLoad = [...animals, 'bin'];
    let loaded = 0;
    
    toLoad.forEach(name => {
        makeTransparent(`assets/${name}.png`, (dataUrl) => {
            filteredImages[name] = dataUrl;
            loaded++;
            if (loaded === toLoad.length) {
                callback();
            }
        });
    });
}

function createBoard() {
    shuffle(cardsArray);
    grid.innerHTML = '';
    
    cardsArray.forEach((animal) => {
        const card = document.createElement('div');
        card.classList.add('memory-card');
        card.dataset.animal = animal;
        
        card.innerHTML = `
            <div class="memory-card-inner">
                <div class="memory-card-front">
                    <img src="${filteredImages[animal]}" alt="${animal}">
                </div>
                <div class="memory-card-back" style="background-image: url('${filteredImages['bin']}')"></div>
            </div>
        `;
        
        card.addEventListener('click', flipCard);
        grid.appendChild(card);
    });
}

function flipCard() {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (lockBoard) return;
    if (this === firstCard) return;

    this.classList.add('flipped');
    playSound('flip');

    if (!firstCard) {
        firstCard = this;
        return;
    }

    secondCard = this;
    checkForMatch();
}

function checkForMatch() {
    let isMatch = firstCard.dataset.animal === secondCard.dataset.animal;

    if (isMatch) {
        disableCards();
        pairsFound++;
        scoreText.innerText = `⭐ Par hittade: ${pairsFound} / 8`;
        playSound('match');
        
        if (pairsFound === 8) {
            setTimeout(() => {
                messageText.classList.add('show');
                playSound('win');
                createConfetti();
            }, 500);
        }
    } else {
        unflipCards();
    }
}

function disableCards() {
    firstCard.removeEventListener('click', flipCard);
    secondCard.removeEventListener('click', flipCard);

    firstCard.classList.add('matched');
    secondCard.classList.add('matched');

    resetBoard();
}

function unflipCards() {
    lockBoard = true;

    setTimeout(() => {
        firstCard.classList.remove('flipped');
        secondCard.classList.remove('flipped');

        resetBoard();
    }, 1000);
}

function resetBoard() {
    [firstCard, secondCard, lockBoard] = [null, null, false];
}

function createConfetti() {
    const colors = ['#FF1493', '#FFD700', '#00BFFF', '#32CD32'];
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'absolute';
        confetti.style.width = '15px';
        confetti.style.height = '15px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.top = '-20px';
        confetti.style.zIndex = '1000';
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        document.body.appendChild(confetti);
        
        const animation = confetti.animate([
            { transform: `translate3d(0, 0, 0) rotate(0)`, opacity: 1 },
            { transform: `translate3d(${Math.random() * 200 - 100}px, 100vh, 0) rotate(${Math.random() * 720}deg)`, opacity: 0 }
        ], {
            duration: Math.random() * 2000 + 1000,
            easing: 'cubic-bezier(.37,0,.63,1)',
            fill: 'forwards'
        });
        
        animation.onfinish = () => confetti.remove();
    }
}

// Add a start interaction listener for AudioContext
document.body.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}, { once: true });

preloadAssets(createBoard);
