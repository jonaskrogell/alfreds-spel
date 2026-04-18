document.addEventListener('DOMContentLoaded', () => {

    const grid        = document.getElementById('memory-grid');
    const scoreText   = document.getElementById('score-text');
    const messageText = document.getElementById('message-text');
    const restartBtn  = document.getElementById('restart-btn');

    const animals    = ['wolf', 'dog', 'bear', 'bunny', 'cat', 'frog', 'pig', 'lion'];
    const filteredImages = {};

    let firstCard  = null;
    let secondCard = null;
    let lockBoard  = false;
    let pairsFound = 0;

    // ─── Audio ──────────────────────────────────────────────────────────────
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const now = audioCtx.currentTime;

        if (type === 'flip') {
            const osc  = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.1);

        } else if (type === 'match') {
            const osc  = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.setValueAtTime(600, now + 0.1);
            osc.frequency.setValueAtTime(800, now + 0.2);
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.5);
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.start(now); osc.stop(now + 0.5);

        } else if (type === 'win') {
            [440, 554, 659, 880].forEach((f, i) => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.type = 'sine'; o.frequency.value = f;
                g.gain.setValueAtTime(0.1, now + i * 0.12);
                g.gain.linearRampToValueAtTime(0, now + i * 0.12 + 0.4);
                o.connect(g); g.connect(audioCtx.destination);
                o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.4);
            });
        }
    }

    // ─── Greenscreen filter ─────────────────────────────────────────────────
    function makeTransparent(src, callback) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const c = document.createElement('canvas');
            c.width  = img.width;
            c.height = img.height;
            const cx = c.getContext('2d', { willReadFrequently: true });
            cx.drawImage(img, 0, 0);
            const data   = cx.getImageData(0, 0, c.width, c.height);
            const pixels = data.data;
            for (let i = 0; i < pixels.length; i += 4) {
                const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
                if (g > 100 && g > r * 1.1 && g > b * 1.1) {
                    const diff = g - Math.max(r, b);
                    pixels[i+3] = diff > 40 ? 0 : Math.max(0, Math.min(255, 255 - diff * 6));
                }
            }
            cx.putImageData(data, 0, 0);
            callback(c.toDataURL());
        };
        img.src = src;
    }

    function preloadAssets(callback) {
        const toLoad = [...animals, 'bin'];
        let loaded = 0;
        toLoad.forEach(name => {
            makeTransparent(`assets/${name}.png`, dataUrl => {
                filteredImages[name] = dataUrl;
                if (++loaded === toLoad.length) callback();
            });
        });
    }

    // ─── Board ──────────────────────────────────────────────────────────────
    function shuffle(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    function createBoard() {
        // Reset state
        firstCard  = null;
        secondCard = null;
        lockBoard  = false;

        const deck = [...animals, ...animals];
        shuffle(deck);
        grid.innerHTML = '';

        deck.forEach(animal => {
            const card = document.createElement('div');
            card.classList.add('memory-card');
            card.dataset.animal = animal;
            card.innerHTML = `
                <div class="memory-card-inner">
                    <div class="memory-card-front">
                        <img src="${filteredImages[animal]}" alt="${animal}">
                    </div>
                    <div class="memory-card-back" style="background-image:url('${filteredImages['bin']}')"></div>
                </div>`;
            card.addEventListener('click', flipCard);
            grid.appendChild(card);
        });
    }

    // ─── Game logic ─────────────────────────────────────────────────────────
    function flipCard() {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        if (lockBoard || this === firstCard || this.classList.contains('matched')) return;

        this.classList.add('flipped');
        playSound('flip');

        if (!firstCard) {
            firstCard = this;
            return;
        }

        secondCard = this;
        lockBoard  = true;

        if (firstCard.dataset.animal === secondCard.dataset.animal) {
            // Match!
            firstCard.classList.add('matched');
            secondCard.classList.add('matched');
            firstCard.removeEventListener('click', flipCard);
            secondCard.removeEventListener('click', flipCard);
            firstCard  = null;
            secondCard = null;
            lockBoard  = false;

            pairsFound++;
            scoreText.innerText = `⭐ Par hittade: ${pairsFound} / 8`;
            playSound('match');

            if (pairsFound === 8) {
                setTimeout(() => {
                    messageText.classList.add('show');
                    playSound('win');
                    createConfetti();
                    setTimeout(() => { restartBtn.style.display = 'block'; }, 1500);
                }, 400);
            }
        } else {
            // No match — flip back after delay
            setTimeout(() => {
                firstCard.classList.remove('flipped');
                secondCard.classList.remove('flipped');
                firstCard  = null;
                secondCard = null;
                lockBoard  = false;
            }, 1000);
        }
    }

    // ─── Restart ────────────────────────────────────────────────────────────
    restartBtn.addEventListener('click', () => {
        restartBtn.style.display = 'none';
        messageText.classList.remove('show');
        pairsFound = 0;
        scoreText.innerText = '⭐ Par hittade: 0 / 8';
        createBoard();
    });

    // ─── Confetti ───────────────────────────────────────────────────────────
    function createConfetti() {
        const colors = ['#FF1493', '#FFD700', '#00BFFF', '#32CD32', '#FF6347'];
        for (let i = 0; i < 60; i++) {
            const el = document.createElement('div');
            el.style.cssText = `
                position:fixed; width:12px; height:12px; border-radius:2px;
                background:${colors[Math.floor(Math.random() * colors.length)]};
                left:${Math.random() * 100}vw; top:-20px; z-index:9999;
                pointer-events:none;`;
            document.body.appendChild(el);
            const anim = el.animate([
                { transform: `translate(0,0) rotate(0deg)`,
                  opacity: 1 },
                { transform: `translate(${Math.random()*200-100}px,105vh) rotate(${Math.random()*720}deg)`,
                  opacity: 0 }
            ], { duration: Math.random() * 2000 + 1200, easing: 'ease-in', fill: 'forwards' });
            anim.onfinish = () => el.remove();
        }
    }

    // ─── Start ──────────────────────────────────────────────────────────────
    preloadAssets(createBoard);
});
