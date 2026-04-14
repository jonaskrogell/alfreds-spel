const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- Input Handling ---
const keys = { ArrowLeft: false, ArrowRight: false, KeyA: false, KeyD: false };
const touch = { left: false, right: false };

window.addEventListener('keydown', e => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
});
window.addEventListener('keyup', e => {
    if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
});

const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');

function setupButton(el, prop) {
    const start = (e) => { e.preventDefault(); touch[prop] = true; el.classList.add('active'); };
    const end = (e) => { e.preventDefault(); touch[prop] = false; el.classList.remove('active'); };
    
    el.addEventListener('touchstart', start, {passive: false});
    el.addEventListener('touchend', end, {passive: false});
    el.addEventListener('mousedown', start);
    el.addEventListener('mouseup', end);
    el.addEventListener('mouseleave', end);
}
setupButton(btnLeft, 'left');
setupButton(btnRight, 'right');

window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'keydown') {
        if (keys.hasOwnProperty(e.data.code)) keys[e.data.code] = true;
    }
    if (e.data && e.data.type === 'keyup') {
        if (keys.hasOwnProperty(e.data.code)) keys[e.data.code] = false;
    }
});

// --- Track Generation ---
const roadWidth = 240; // Increased width
let trackPoints = [];
let sceneryElements = [];
let aiCars = [];

function generateTrackPoints(numPoints, baseRadius) {
    const points = [];
    const phase1 = Math.random() * Math.PI * 2;
    const phase2 = Math.random() * Math.PI * 2;
    const amp1 = 300 + Math.random() * 400; 
    const amp2 = 100 + Math.random() * 300; 

    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * Math.PI * 2;
        // True random wave per game
        const w1 = Math.sin(angle * 3 + phase1) * amp1;
        const w2 = Math.cos(angle * 5 + phase2) * amp2;
        let r = baseRadius + w1 + w2 + (Math.random() * 300 - 150);
        
        let dr = 0;
        let da = 0;
        // Inject chicanes/sharp corners at specific segments
        if (i === 4 || i === 12 || i === 20) {
            dr = 400 + Math.random() * 300;
            da = 0.15;
        } else if (i === 5 || i === 13 || i === 21) {
            dr = -300 - Math.random() * 200;
        }

        points.push({
            x: Math.cos(angle + da) * (r + dr),
            y: Math.sin(angle + da) * (r + dr)
        });
    }
    return points;
}

function catmullRomSpline(points, segmentsPerPair) {
    const result = [];
    const n = points.length;
    for (let i = 0; i < n; i++) {
        const p0 = points[(i - 1 + n) % n];
        const p1 = points[i];
        const p2 = points[(i + 1) % n];
        const p3 = points[(i + 2) % n];

        for (let t = 0; t < segmentsPerPair; t++) {
            const t0 = t / segmentsPerPair;
            const t2 = t0 * t0;
            const t3 = t2 * t0;

            const x = 0.5 * (
                (2 * p1.x) +
                (-p0.x + p2.x) * t0 +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
            );
            const y = 0.5 * (
                (2 * p1.y) +
                (-p0.y + p2.y) * t0 +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
            );
            result.push({ x, y });
        }
    }
    return result;
}

const barrierDist = roadWidth / 2 + 60;

function initLevel() {
    const numControlPoints = 24;
    const controlPoints = generateTrackPoints(numControlPoints, 2200);
    trackPoints = catmullRomSpline(controlPoints, 20);

    sceneryElements = [];
    
    // 1. Tire barriers along the edges
    for (let i = 0; i < trackPoints.length; i += 6) {
        const p1 = trackPoints[i];
        const p2 = trackPoints[(i + 1) % trackPoints.length];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        const nx = -dy / len;
        const ny = dx / len;
        
        let color = (Math.floor(i / 6) % 2 === 0) ? '#ff4757' : '#ffffff';
        let angle = Math.atan2(dy, dx);
        
        sceneryElements.push({
            type: 'barrier', x: p1.x + nx * barrierDist, y: p1.y + ny * barrierDist,
            color: color, angle: angle
        });
        sceneryElements.push({
            type: 'barrier', x: p1.x - nx * barrierDist, y: p1.y - ny * barrierDist,
            color: color, angle: angle
        });
    }

    // 2. Random environment objects
    for (let i = 0; i < 1500; i++) { // Very dense world!
        let tx = (Math.random() - 0.5) * 9000;
        let ty = (Math.random() - 0.5) * 9000;
        
        let minD = Infinity;
        for (let pt of trackPoints) {
            let d = Math.hypot(pt.x - tx, pt.y - ty);
            if (d < minD) minD = d;
        }

        if (minD > barrierDist + 100) {
            let r = Math.random();
            if (r > 0.96) {
                // grandstand
                sceneryElements.push({ type: 'grandstand', x: tx, y: ty, rotation: Math.random()*Math.PI*2 });
            } else if (r > 0.92) {
                // village cluster
                let roof = (Math.random() > 0.5) ? '#c0392b' : '#2980b9';
                for(let k=0; k<Math.floor(Math.random()*4)+2; k++) {
                    sceneryElements.push({ type: 'house', x: tx + (Math.random()-0.5)*150, y: ty + (Math.random()-0.5)*150, angle: Math.random()*Math.PI, roofColor: roof });
                }
            } else if (r > 0.88) {
                // windmill & farm
                sceneryElements.push({ type: 'windmill', x: tx, y: ty });
                for(let k=0; k<5; k++) {
                    sceneryElements.push({ type: 'cow', x: tx + 60 + (Math.random()-0.5)*80, y: ty + 60 + (Math.random()-0.5)*80, angle: Math.random()*6 });
                }
            } else if (r > 0.82) {
                sceneryElements.push({ type: 'mountain', x: tx, y: ty, rotation: Math.random()*2 });
            } else if (r > 0.78) {
                // wild animals (deer)
                for(let k=0; k<3; k++) {
                    sceneryElements.push({ type: 'deer', x: tx + (Math.random()-0.5)*50, y: ty + (Math.random()-0.5)*50, angle: Math.random()*6 });
                }
            } else if (r > 0.4) {
                sceneryElements.push({ type: 'tree', x: tx, y: ty, scale: 0.8 + Math.random()*1.0 });
            } else if (r > 0.2) {
                sceneryElements.push({ type: 'flower', x: tx, y: ty, rotation: Math.random()*6 });
            } else {
                sceneryElements.push({ type: 'dirt', x: tx, y: ty });
            }
        }
    }

    // Sort scenery so big objects (mountains, windmills, houses) draw under smaller ones if needed, 
    // or just rely on random order which looks organic.

    // 3. Setup AI cars (8 opponents)
    const aiColors = ['#1e90ff', '#ffa502', '#e056fd', '#2ed573', '#ff6b81', '#ffffff', '#34495e', '#f1c40f'];
    aiCars = [];
    for(let i=0; i<8; i++) {
        let ai = {
            x: 0, y: 0, angle: 0,
            speed: 5.0 + Math.random()*2.5, // 5.0 - 7.5 speed
            color: aiColors[i % aiColors.length],
            targetIndex: (i * 35 + 40) % trackPoints.length
        };
        let pt = trackPoints[ai.targetIndex];
        let nextPt = trackPoints[(ai.targetIndex + 5) % trackPoints.length];
        ai.x = pt.x; ai.y = pt.y;
        ai.angle = Math.atan2(nextPt.y - pt.y, nextPt.x - pt.x);
        aiCars.push(ai);
    }
}

// --- Player State ---
let car = {
    x: 0, y: 0, angle: 0, speed: 0, lap: 1, lastClosestIndex: 0, color: '#ff4757'
};

let camera = { x: 0, y: 0 };
let particles = [];
let confetti = [];

function resetCar() {
    car.x = trackPoints[0].x;
    car.y = trackPoints[0].y;
    car.angle = Math.atan2(trackPoints[1].y - trackPoints[0].y, trackPoints[1].x - trackPoints[0].x);
    car.speed = 0;
    car.lap = 1;
    car.lastClosestIndex = 0;
    camera.x = car.x;
    camera.y = car.y;
    document.getElementById('lap').innerText = car.lap;
}

initLevel();
resetCar();

// --- Drawing logic ---

function drawCar(x, y, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.roundRect(-24, -16, 48, 32, 8);
    ctx.fill();

    // Wheels
    ctx.fillStyle = '#111';
    ctx.fillRect(-18, -19, 10, 6); // rear left
    ctx.fillRect(10, -19, 10, 6);  // front left
    ctx.fillRect(-18, 13, 10, 6);  // rear right
    ctx.fillRect(10, 13, 10, 6);   // front right

    // Aerodynamic Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-22, -12);
    ctx.lineTo(15, -10);
    ctx.lineTo(24, -6);
    ctx.lineTo(24, 6);
    ctx.lineTo(15, 10);
    ctx.lineTo(-22, 12);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Secondary body stripe
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.moveTo(-20, -3);
    ctx.lineTo(20, -2);
    ctx.lineTo(20, 2);
    ctx.lineTo(-20, 3);
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Cockpit / Windshield
    ctx.fillStyle = '#0a3d62';
    ctx.beginPath();
    ctx.roundRect(-2, -6, 12, 12, 4);
    ctx.fill();

    // Rear Spoiler
    ctx.fillStyle = '#222';
    ctx.fillRect(-24, -14, 6, 28);
    ctx.fillStyle = color;
    ctx.fillRect(-22, -14, 4, 28);

    ctx.restore();
}

function drawScenery(item) {
    ctx.save();
    ctx.translate(item.x, item.y);
    if(item.angle !== undefined) ctx.rotate(item.angle);
    else if(item.rotation) ctx.rotate(item.rotation);
    
    ctx.scale(item.scale || 1, item.scale || 1);
    
    if (item.type === 'barrier') {
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.roundRect(-10, -5, 20, 10, 3);
        ctx.fill();
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    } else if (item.type === 'tree') {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath(); ctx.arc(0, 5, 25, 0, Math.PI*2); ctx.fill();

        ctx.fillStyle = '#2ed573';
        ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#26de81';
        ctx.beginPath(); ctx.arc(5, -5, 20, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#5c4033';
        ctx.beginPath(); ctx.arc(0,0, 6, 0, Math.PI*2); ctx.fill();
    } else if (item.type === 'flower') {
        ctx.fillStyle = '#ff6b81';
        for (let a=0; a<Math.PI*2; a+=Math.PI * 0.4) {
            ctx.beginPath(); ctx.arc(Math.cos(a)*10, Math.sin(a)*10, 6, 0, Math.PI*2); ctx.fill();
        }
        ctx.fillStyle = '#eccc68';
        ctx.beginPath(); ctx.arc(0,0, 6, 0, Math.PI*2); ctx.fill();
    } else if (item.type === 'dirt') {
        ctx.fillStyle = '#cfb088';
        ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(0,0, 60, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(-25,20, 45, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1;
    } else if (item.type === 'grandstand') {
        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-65, -35, 130, 70); 
        
        // Tiers
        const tierColors = ['#bdc3c7', '#95a5a6', '#7f8c8d'];
        for(let i=0; i<3; i++) {
            ctx.fillStyle = tierColors[i];
            ctx.fillRect(-60, -30 + i*15, 120, 60 - i*15);
        }

        // Colorful crowd
        const colors = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6', '#fff'];
        for(let i=0; i<60; i++) {
            ctx.fillStyle = colors[Math.floor(Math.random()*colors.length)];
            let px = -55 + Math.random()*110;
            let py = -25 + Math.random()*40;
            ctx.beginPath(); ctx.arc(px, py, 2.5, 0, Math.PI*2); ctx.fill();
        }

        // Awning canopy over the back
        ctx.fillStyle = (Math.random() > 0.5) ? '#e74c3c' : '#3498db';
        ctx.globalAlpha = 0.9;
        ctx.beginPath(); ctx.roundRect(-62, -32, 124, 25, 4); ctx.fill();
        ctx.globalAlpha = 1.0;
        
        ctx.fillStyle = '#ecf0f1';
        for(let x = -50; x < 60; x+=20) {
            ctx.fillRect(x, -32, 10, 25);
        }
    } else if (item.type === 'cow') {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.roundRect(-10, -5, 20, 10, 3); ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(-4, -1, 3, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(4, 2, 4, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.roundRect(8, -4, 6, 8, 2); ctx.fill();
        ctx.fillStyle = '#ffaabb';
        ctx.beginPath(); ctx.roundRect(12, -3, 3, 6, 1); ctx.fill();
    } else if (item.type === 'deer') {
        ctx.fillStyle = '#8B4513';
        ctx.beginPath(); ctx.roundRect(-7, -4, 14, 8, 3); ctx.fill();
        ctx.beginPath(); ctx.arc(9, 0, 4, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = '#5c4033'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(9,-1); ctx.lineTo(13,-5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(9, 1); ctx.lineTo(13, 5); ctx.stroke();
    } else if (item.type === 'mountain') {
        ctx.scale(2.5, 2.5);
        let points = [{x:-20,y:0}, {x:-10,y:-15}, {x:5,y:-20}, {x:20,y:-10}, {x:15,y:15}, {x:-5,y:20}];
        ctx.fillStyle = '#7f8c8d';
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        for(let i=1; i<points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        ctx.fill();
        ctx.fillStyle = '#bdc3c7';
        ctx.beginPath(); ctx.moveTo(-5, -5); ctx.lineTo(0, -10); ctx.lineTo(5, -2); ctx.lineTo(0, 5); ctx.fill();
        ctx.scale(1/2.5, 1/2.5);
    } else if (item.type === 'house') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(-18, -13, 40, 30);
        ctx.fillStyle = item.roofColor || '#c0392b';
        ctx.fillRect(-20, -15, 40, 30);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(-20, 0, 40, 2);
    } else if (item.type === 'windmill') {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath(); ctx.arc(2, 5, 16, 0, Math.PI*2); ctx.fill();
        
        ctx.fillStyle = '#d35400';
        ctx.beginPath(); ctx.arc(0,0, 15, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#e67e22'; 
        ctx.beginPath(); ctx.arc(0,0, 10, 0, Math.PI*2); ctx.fill();
        
        let t = Date.now() / 500;
        ctx.rotate(t);
        for(let i=0; i<4; i++) {
            ctx.rotate(Math.PI/2);
            ctx.fillStyle = '#ecf0f1';
            ctx.fillRect(0, -5, 45, 10);
            ctx.fillStyle = '#bdc3c7';
            ctx.fillRect(5, -5, 35, 10);
        }
    }
    
    ctx.restore();
}

function showCelebration() {
    const el = document.getElementById('celebration');
    el.classList.add('show');
    
    for(let i=0; i<100; i++) {
        confetti.push({
            x: camera.x + (Math.random()-0.5)*canvas.width,
            y: camera.y - canvas.height/2 - 50,
            vx: (Math.random()-0.5)*10,
            vy: Math.random()*10 + 5,
            color: ['#ff4757', '#2ed573', '#1e90ff', '#eccc68', '#ffa502'][Math.floor(Math.random()*5)],
            size: Math.random()*10 + 5,
            life: 2.0
        });
    }

    setTimeout(() => {
        el.classList.remove('show');
    }, 2000);
}

// --- Main Game Loop ---
let lastTime = 0;

function update(dt) {
    // 1. Inputs
    const isLeft = keys.ArrowLeft || keys.KeyA || touch.left;
    const isRight = keys.ArrowRight || keys.KeyD || touch.right;

    let maxTurnSpeed = 0.05;
    let turnSpeed = maxTurnSpeed * (car.speed / 9);
    if (car.speed < 2) turnSpeed = maxTurnSpeed * 0.4;

    if (isLeft) car.angle -= turnSpeed;
    if (isRight) car.angle += turnSpeed;


    // 2. On-Road & Edge collisions
    let minDist = Infinity;
    let closestIndex = 0;
    for (let i = 0; i < trackPoints.length; i++) {
        const pt = trackPoints[i];
        const d = Math.hypot(pt.x - car.x, pt.y - car.y);
        if (d < minDist) {
            minDist = d;
            closestIndex = i;
        }
    }

    const onRoad = minDist < (roadWidth / 2);

    if (minDist > barrierDist - 18) {
        const closestPt = trackPoints[closestIndex];
        const pushDx = closestPt.x - car.x;
        const pushDy = closestPt.y - car.y;
        const pushLen = Math.hypot(pushDx, pushDy);
        
        if (pushLen > 0) {
            car.x += (pushDx / pushLen) * 3;
            car.y += (pushDy / pushLen) * 3;
            car.speed *= 0.8;
            
            if(Math.random() < 0.4) {
                 particles.push({
                    x: car.x, y: car.y,
                    vx: (Math.random()-0.5)*5, vy: (Math.random()-0.5)*5,
                    life: 1.0, color: '#333'
                 });
            }
        }
    }

    // 3. Player Speed
    const currentMaxSpeed = onRoad ? 9.0 : 3.5;
    const acc = onRoad ? 0.2 : 0.1;
    const dec = 0.4;

    if (car.speed < currentMaxSpeed) {
        car.speed += acc;
    } else if (car.speed > currentMaxSpeed) {
        car.speed -= dec;
    }
    if (car.speed < 0) car.speed = 0;

    car.x += Math.cos(car.angle) * car.speed;
    car.y += Math.sin(car.angle) * car.speed;

    // 4. AI Cars Update
    aiCars.forEach(ai => {
        let targetPt = trackPoints[ai.targetIndex];
        let dx = targetPt.x - ai.x;
        let dy = targetPt.y - ai.y;
        let dist = Math.hypot(dx, dy);
        
        let targetAngle = Math.atan2(dy, dx);
        let diff = targetAngle - ai.angle;
        while(diff < -Math.PI) diff += Math.PI * 2;
        while(diff > Math.PI) diff -= Math.PI * 2;
        
        ai.angle += Math.sign(diff) * Math.min(Math.abs(diff), 0.08); 
        
        ai.x += Math.cos(ai.angle) * ai.speed;
        ai.y += Math.sin(ai.angle) * ai.speed;

        if (dist < 120) {
            ai.targetIndex = (ai.targetIndex + 2) % trackPoints.length; 
        }

        // AI vs Player
        let pDist = Math.hypot(ai.x - car.x, ai.y - car.y);
        if (pDist < 45) {
            let angle = Math.atan2(ai.y - car.y, ai.x - car.x);
            car.x -= Math.cos(angle) * 3.5;
            car.y -= Math.sin(angle) * 3.5;
            car.speed *= 0.9;
            ai.x += Math.cos(angle) * 2;
            ai.y += Math.sin(angle) * 2;
            
            particles.push({
                x: (car.x+ai.x)/2, y: (car.y+ai.y)/2,
                vx: (Math.random()-0.5)*6, vy: (Math.random()-0.5)*6,
                life: 1.0, color: '#fff'
            });
        }
    });

    // AI vs AI collision
    for (let i = 0; i < aiCars.length; i++) {
        for (let j = i + 1; j < aiCars.length; j++) {
            let ai1 = aiCars[i]; let ai2 = aiCars[j];
            let dx = ai2.x - ai1.x; let dy = ai2.y - ai1.y;
            let d = Math.hypot(dx, dy);
            if (d < 45) {
                let angle = Math.atan2(dy, dx);
                let push = 1.0;
                ai1.x -= Math.cos(angle) * push; ai1.y -= Math.sin(angle) * push;
                ai2.x += Math.cos(angle) * push; ai2.y += Math.sin(angle) * push;
            }
        }
    }

    // 5. Lap tracking
    const N = trackPoints.length;
    if (car.lastClosestIndex > N - 20 && closestIndex < 20) {
        car.lap++;
        document.getElementById('lap').innerText = car.lap;
        showCelebration();
    } else if (car.lastClosestIndex < 20 && closestIndex > N - 20) {
        if(car.lap > 1) {
            car.lap--;
            document.getElementById('lap').innerText = car.lap;
        }
    }
    car.lastClosestIndex = closestIndex;

    // 6. Camera Follow
    const lookAheadDist = car.speed * 12;
    const targetCamX = car.x + Math.cos(car.angle) * lookAheadDist;
    const targetCamY = car.y + Math.sin(car.angle) * lookAheadDist;

    camera.x += (targetCamX - camera.x) * 0.1;
    camera.y += (targetCamY - camera.y) * 0.1;

    // 7. Particles
    if (!onRoad && car.speed > 2 && Math.random() < 0.6) {
        particles.push({
            x: car.x - Math.cos(car.angle)*15 + (Math.random()-0.5)*10,
            y: car.y - Math.sin(car.angle)*15 + (Math.random()-0.5)*10,
            vx: -Math.cos(car.angle)*2 + (Math.random()-0.5),
            vy: -Math.sin(car.angle)*2 + (Math.random()-0.5),
            life: 1.0, color: '#a4b0be'
        });
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        p.life -= 0.02 * (dt/16);
        p.vx *= 0.95; p.vy *= 0.95;
        if (p.life <= 0) particles.splice(i, 1);
    }
    for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i];
        c.x += c.vx; c.y += c.vy;
        c.life -= 0.01 * (dt/16);
        if (c.life <= 0) confetti.splice(i, 1);
    }
}

function draw() {
    ctx.fillStyle = '#61b849';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2 - camera.x, canvas.height / 2 - camera.y);

    // --- Draw Track ---
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    trackPoints.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = roadWidth + 30;
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = roadWidth + 30;
    ctx.setLineDash([40, 40]);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.strokeStyle = '#747d8c';
    ctx.lineWidth = roadWidth;
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.setLineDash([40, 40]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Start/Finish Line
    const pt0 = trackPoints[0];
    const pt1 = trackPoints[1];
    const startAngle = Math.atan2(pt1.y - pt0.y, pt1.x - pt0.x);
    ctx.save();
    ctx.translate(pt0.x, pt0.y);
    ctx.rotate(startAngle);
    for(let y = -roadWidth/2; y < roadWidth/2; y += 20) {
        ctx.fillStyle = (Math.abs(y)%40 === 0) ? '#000' : '#fff';
        ctx.fillRect(-10, y, 10, 20);
        ctx.fillStyle = (Math.abs(y)%40 === 0) ? '#fff' : '#000';
        ctx.fillRect(0, y, 10, 20);
    }
    ctx.restore();

    // --- Draw Scenery & Cars ---
    // Background scenery
    sceneryElements.forEach(item => {
        // Culling margin
        if (Math.abs(item.x - camera.x) > canvas.width/2 + 400) return;
        if (Math.abs(item.y - camera.y) > canvas.height/2 + 400) return;
        if (item.type !== 'barrier') drawScenery(item);
    });

    particles.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, p.life * 5), 0, Math.PI*2);
        ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // AI Cars
    aiCars.forEach(ai => {
        drawCar(ai.x, ai.y, ai.angle, ai.color);
    });

    // Player Car
    drawCar(car.x, car.y, car.angle, car.color);

    // Foreground scenery (Barriers)
    sceneryElements.forEach(item => {
        if (item.type === 'barrier') {
            if (Math.abs(item.x - camera.x) > canvas.width/2 + 100) return;
            if (Math.abs(item.y - camera.y) > canvas.height/2 + 100) return;
            drawScenery(item);
        }
    });

    confetti.forEach(c => {
        ctx.fillStyle = c.color;
        ctx.globalAlpha = Math.min(1, c.life);
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.fillRect(-c.size/2, -c.size/2, c.size, c.size);
        ctx.restore();
    });
    ctx.globalAlpha = 1.0;

    ctx.restore();
}

function loop(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    update(Math.min(dt, 50));
    draw();
    requestAnimationFrame(loop);
}

requestAnimationFrame((t) => { lastTime = t; loop(t); });
