// ===================== GALNA BILAR - Three.js 3D =====================
const scoreSpan = document.getElementById('score');
const startScreen = document.getElementById('start-screen');
const speedDisplay = document.getElementById('speed-display');
const container = document.getElementById('game-canvas-wrapper');

let isPlaying = false;
let hasWon = false;
let score = 0;
const targetScore = 100;
let startTime = 0;
let speed = 0;
let maxSpeed = 120;
let roadZ = 0;
let currentLane = 1;
let targetX = 0;
let frames = 0;

// Korrekta filpositioner: väg = 12 bred, 3 filer à 4 breda
const ROAD_W = 12;
const LANE_W = ROAD_W / 3; // = 4
const LANE_POSITIONS = [-LANE_W, 0, LANE_W]; // -4, 0, 4
const STRIPE_X = [-LANE_W / 2, LANE_W / 2]; // -2, 2 (mellan filerna)

let items3D = [];
let trees3D = [];
let roadside3D = [];
let aiCars = [];
let lastAiCarTime = 0;
let clouds = [];

// ===================== AUDIO =====================
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;
    osc.connect(gain); gain.connect(audioCtx.destination);

    if (type === 'switch') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(700, now + 0.06);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.06);
        osc.start(now); osc.stop(now + 0.06);
    } else if (type === 'star') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(1600, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'crash') {
        const buf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.3, audioCtx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const noise = audioCtx.createBufferSource(); noise.buffer = buf;
        const filt = audioCtx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.setValueAtTime(500, now);
        filt.frequency.exponentialRampToValueAtTime(50, now + 0.3);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        noise.connect(filt); filt.connect(gain); noise.start(now); return;
    } else if (type === 'honk') {
        // Realistisk biltuta: två tåner samtidigt
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(380, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.setValueAtTime(0.2, now + 0.4);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
        osc.start(now); osc.stop(now + 0.55);
        // Andra tonen
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(475, now);
        osc2.connect(gain2); gain2.connect(audioCtx.destination);
        gain2.gain.setValueAtTime(0.15, now);
        gain2.gain.setValueAtTime(0.15, now + 0.4);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.55);
        osc2.start(now); osc2.stop(now + 0.55);
    } else if (type === 'win') {
        osc.disconnect();
        [523,659,783,1046,783,1046,1318].forEach((f, i) => {
            const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
            o.type = 'triangle'; o.frequency.value = f;
            o.connect(g); g.connect(audioCtx.destination);
            g.gain.setValueAtTime(0, now);
            g.gain.setValueAtTime(0.3, now + i * 0.12);
            g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.12 + 0.3);
            o.start(now + i * 0.12); o.stop(now + i * 0.12 + 0.3);
        }); return;
    }
}

// ===================== THREE.JS SETUP =====================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x66bbff); // Ljus daghimmel
scene.fog = new THREE.FogExp2(0x88ccff, 0.008);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 4, 8);
camera.lookAt(0, 1, -20);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===================== LIGHTING (dagsljus) =====================
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sunLight = new THREE.DirectionalLight(0xffffee, 1.0);
sunLight.position.set(30, 40, -30);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
const sc = sunLight.shadow.camera;
sc.near = 1; sc.far = 100; sc.left = -20; sc.right = 20; sc.top = 20; sc.bottom = -20;
scene.add(sunLight);
scene.add(new THREE.HemisphereLight(0x88ccff, 0x44aa44, 0.4));

// ===================== SOL =====================
const sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(6, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffee88 })
);
sunMesh.position.set(40, 50, -150);
scene.add(sunMesh);

// ===================== MOLN =====================
function createCloud(x, y, z) {
    const g = new THREE.Group();
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    // 3-5 klumpar
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
        const size = 2 + Math.random() * 3;
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), mat);
        sphere.position.set(i * 3 - count, Math.random() * 1.5, Math.random() * 2);
        g.add(sphere);
    }
    g.position.set(x, y, z);
    scene.add(g);
    return g;
}

for (let i = 0; i < 15; i++) {
    const c = createCloud(
        (Math.random() - 0.5) * 200,
        25 + Math.random() * 15,
        -20 - Math.random() * 200
    );
    clouds.push({ mesh: c, speed: 0.01 + Math.random() * 0.02 });
}

// ===================== VÄGEN =====================
const ROAD_LENGTH = 400;

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(300, ROAD_LENGTH + 60),
    new THREE.MeshLambertMaterial({ color: 0x33aa33 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(0, -0.05, -ROAD_LENGTH / 2 + 25);
ground.receiveShadow = true;
scene.add(ground);

const road = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_W, ROAD_LENGTH + 60),
    new THREE.MeshLambertMaterial({ color: 0x555555 })
);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0, -ROAD_LENGTH / 2 + 25);
road.receiveShadow = true;
scene.add(road);

// Fil-streck (mellan filerna, vid STRIPE_X positionerna)
const stripeGroup = new THREE.Group();
for (let z = 10; z > -ROAD_LENGTH; z -= 4) {
    STRIPE_X.forEach(x => {
        const s = new THREE.Mesh(
            new THREE.PlaneGeometry(0.15, 2),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        s.rotation.x = -Math.PI / 2;
        s.position.set(x, 0.01, z);
        stripeGroup.add(s);
    });
}
// Kantränder (röd/vit)
for (let z = 10; z > -ROAD_LENGTH; z -= 2) {
    const isRed = Math.floor(-z / 2) % 2 === 0;
    [-ROAD_W / 2, ROAD_W / 2].forEach(x => {
        const k = new THREE.Mesh(
            new THREE.PlaneGeometry(0.4, 2),
            new THREE.MeshBasicMaterial({ color: isRed ? 0xff0000 : 0xffffff })
        );
        k.rotation.x = -Math.PI / 2;
        k.position.set(x, 0.01, z);
        stripeGroup.add(k);
    });
}
scene.add(stripeGroup);

// ===================== BERG =====================
[[-40,-140,30,20,0x6688aa],[-15,-150,40,25,0x7799bb],[20,-145,35,18,0x6688aa],
 [50,-140,28,22,0x7799bb],[-50,-135,22,15,0x5577aa],[70,-148,33,20,0x5577aa]
].forEach(([x,z,h,w,c]) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(w,h,6), new THREE.MeshLambertMaterial({color:c}));
    m.position.set(x, h/2, z);
    scene.add(m);
});

// ===================== TRÄD =====================
function createTree(x, z) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.2, 1.5, 6),
        new THREE.MeshLambertMaterial({ color: 0x8B4513 })
    );
    trunk.position.y = 0.75; trunk.castShadow = true; g.add(trunk);
    const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(1.2, 2.5, 8),
        new THREE.MeshLambertMaterial({ color: 0x228B22 })
    );
    leaf.position.y = 2.5; leaf.castShadow = true; g.add(leaf);
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
}

// ===================== HUS =====================
function createHouse(x, z) {
    const g = new THREE.Group();
    // Kropp
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(3, 2.5, 3),
        new THREE.MeshPhongMaterial({ color: 0xddaa66, shininess: 20 })
    );
    body.position.y = 1.25; body.castShadow = true; g.add(body);
    // Tak
    const roof = new THREE.Mesh(
        new THREE.ConeGeometry(2.8, 1.5, 4),
        new THREE.MeshPhongMaterial({ color: 0xcc3333, shininess: 30 })
    );
    roof.position.y = 3.25; roof.rotation.y = Math.PI / 4;
    roof.castShadow = true; g.add(roof);
    // Dörr
    const door = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 1.2, 0.05),
        new THREE.MeshPhongMaterial({ color: 0x664422 })
    );
    door.position.set(0, 0.6, 1.53); g.add(door);
    // Fönster
    [-0.8, 0.8].forEach(fx => {
        const win = new THREE.Mesh(
            new THREE.BoxGeometry(0.5, 0.5, 0.05),
            new THREE.MeshBasicMaterial({ color: 0xaaddff })
        );
        win.position.set(fx, 1.8, 1.53); g.add(win);
    });
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
}

// ===================== BONDGÅRD (variation) =====================
function createBarn(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(4, 3, 5),
        new THREE.MeshPhongMaterial({ color: 0xcc4444, shininess: 20 })
    );
    body.position.y = 1.5; body.castShadow = true; g.add(body);
    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(4.5, 0.3, 5.5),
        new THREE.MeshPhongMaterial({ color: 0x886644 })
    );
    roof.position.y = 3.15; g.add(roof);
    // Stor port
    const door = new THREE.Mesh(
        new THREE.BoxGeometry(2, 2.2, 0.05),
        new THREE.MeshPhongMaterial({ color: 0x553322 })
    );
    door.position.set(0, 1.1, 2.53); g.add(door);
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
}

// ===================== VINDSNURRA =====================
function createWindmill(x, z) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.3, 6, 8),
        new THREE.MeshPhongMaterial({ color: 0xcccccc })
    );
    pole.position.y = 3; g.add(pole);
    // Blad-hub
    const hub = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 8, 8),
        new THREE.MeshPhongMaterial({ color: 0x888888 })
    );
    hub.position.set(0, 6, 0.3); g.add(hub);
    // Blad
    for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 3, 0.05),
            new THREE.MeshPhongMaterial({ color: 0xeeeeee })
        );
        blade.position.set(0, 1.5, 0);
        const pivot = new THREE.Group();
        pivot.add(blade);
        pivot.rotation.z = (i * Math.PI * 2) / 3;
        pivot.position.set(0, 6, 0.3);
        pivot.userData.isWindmillBlade = true;
        g.add(pivot);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
}

// ===================== KOSSA =====================
function createCow(x, z) {
    const g = new THREE.Group();
    const matWhite = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const matBlack = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const matPink = new THREE.MeshLambertMaterial({ color: 0xffaaaa });

    // Kropp
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 2.0), matWhite);
    body.position.y = 0.8; body.castShadow = true; g.add(body);

    // Fläckar
    const spot1 = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.6, 0.6), matBlack);
    spot1.position.set(0, 0.8, 0.3); g.add(spot1);
    const spot2 = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.4, 0.5), matBlack);
    spot2.position.set(0, 0.9, -0.5); g.add(spot2);

    // Huvud
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.8), matWhite);
    head.position.set(0, 1.2, 1.0); head.castShadow = true; g.add(head);

    // Mule (rosa)
    const mule = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.4, 0.3), matPink);
    mule.position.set(0, 1.05, 1.3); g.add(mule);

    // Öron
    [-0.4, 0.4].forEach(ex => {
        const ear = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), matWhite);
        ear.position.set(ex, 1.4, 0.8); g.add(ear);
    });

    // Ben
    [[-0.4, 0.6], [0.4, 0.6], [-0.4, -0.6], [0.4, -0.6]].forEach(pos => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), matWhite);
        leg.position.set(pos[0], 0.4, pos[1]); leg.castShadow = true; g.add(leg);
    });

    g.position.set(x, 0, z);
    // Slumpmässig riktning som kossan står åt
    g.rotation.y = Math.random() * Math.PI * 2;
    scene.add(g);
    return g;
}

// Placera objekt längs vägen
for (let z = 0; z > -ROAD_LENGTH; z -= 8) {
    const leftX = -ROAD_W / 2 - 4 - Math.random() * 6;
    const rightX = ROAD_W / 2 + 4 + Math.random() * 6;
    const r = Math.random();

    if (r < 0.5) {
        // Träd (vanligast)
        trees3D.push(createTree(leftX, z + Math.random() * 4));
        trees3D.push(createTree(rightX, z + Math.random() * 4));
    } else if (r < 0.65) {
        // Hus
        const side = Math.random() < 0.5 ? leftX - 2 : rightX + 2;
        roadside3D.push(createHouse(side, z));
        trees3D.push(createTree(Math.random() < 0.5 ? leftX : rightX, z + 4));
    } else if (r < 0.75) {
        // Bondgård
        const side = Math.random() < 0.5 ? leftX - 3 : rightX + 3;
        roadside3D.push(createBarn(side, z));
    } else if (r < 0.85) {
        // Vindsnurra
        const side = Math.random() < 0.5 ? leftX - 5 : rightX + 5;
        roadside3D.push(createWindmill(side, z));
        trees3D.push(createTree(Math.random() < 0.5 ? leftX : rightX, z + 3));
    } else {
        // Kor (Koflock med 2-4 kor)
        const side = Math.random() < 0.5 ? leftX - 3 : rightX + 3;
        const numCows = 2 + Math.floor(Math.random() * 3);
        for (let c = 0; c < numCows; c++) {
            roadside3D.push(createCow(side + (Math.random() - 0.5) * 6, z + (Math.random() - 0.5) * 6));
        }
    }
}

// ===================== SPELARENS BIL =====================
function createPlayerCar() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.6, 4),
        new THREE.MeshPhongMaterial({ color: 0xe74c3c, shininess: 100 })
    );
    body.position.y = 0.5; body.castShadow = true; g.add(body);
    const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.6, 0.5, 2),
        new THREE.MeshPhongMaterial({ color: 0xc0392b, shininess: 80 })
    );
    cabin.position.set(0, 1.05, -0.3); cabin.castShadow = true; g.add(cabin);
    const ws = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 0.5),
        new THREE.MeshPhongMaterial({ color: 0x88ccff, transparent: true, opacity: 0.6, shininess: 200 })
    );
    ws.position.set(0, 1.05, 0.72); ws.rotation.x = -0.3; g.add(ws);
    const wGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
    const wMat = new THREE.MeshPhongMaterial({ color: 0x222222, shininess: 30 });
    [[-1,0.35,1.2],[1,0.35,1.2],[-1,0.35,-1.2],[1,0.35,-1.2]].forEach(p => {
        const w = new THREE.Mesh(wGeo, wMat);
        w.position.set(...p); w.rotation.z = Math.PI/2; w.castShadow = true; g.add(w);
    });
    [-0.7,0.7].forEach(x => {
        const hl = new THREE.Mesh(new THREE.SphereGeometry(0.15,8,8), new THREE.MeshBasicMaterial({color:0xffffcc}));
        hl.position.set(x, 0.5, 2.01); g.add(hl);
    });
    [-0.7,0.7].forEach(x => {
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.15,0.05), new THREE.MeshBasicMaterial({color:0xff0000}));
        tl.position.set(x, 0.5, -2.01); g.add(tl);
    });
    scene.add(g);
    return g;
}
const car = createPlayerCar();

// ===================== AI-BIL =====================
const AI_CAR_COLORS = [0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xff6699];
function createAiCar(lane, speedFactor) {
    const g = new THREE.Group();
    const color = AI_CAR_COLORS[Math.floor(Math.random() * AI_CAR_COLORS.length)];
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.55, 3.5),
        new THREE.MeshPhongMaterial({ color, shininess: 80 })
    );
    body.position.y = 0.48; body.castShadow = true; g.add(body);
    const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.45, 1.8),
        new THREE.MeshPhongMaterial({ color: new THREE.Color(color).multiplyScalar(0.7), shininess: 60 })
    );
    cabin.position.set(0, 0.98, -0.2); cabin.castShadow = true; g.add(cabin);
    const ws = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 0.45),
        new THREE.MeshPhongMaterial({ color: 0x88ccff, transparent: true, opacity: 0.5, shininess: 200 })
    );
    ws.position.set(0, 0.98, 0.72); ws.rotation.x = -0.3; g.add(ws);
    const wGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.25, 10);
    const wMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
    [[-0.9,0.3,1],[0.9,0.3,1],[-0.9,0.3,-1],[0.9,0.3,-1]].forEach(p => {
        const w = new THREE.Mesh(wGeo, wMat);
        w.position.set(...p); w.rotation.z = Math.PI/2; g.add(w);
    });
    [-0.6,0.6].forEach(x => {
        const tl = new THREE.Mesh(new THREE.BoxGeometry(0.25,0.12,0.05), new THREE.MeshBasicMaterial({color:0xff4444}));
        tl.position.set(x, 0.45, -1.76); g.add(tl);
    });
    g.position.set(LANE_POSITIONS[lane], 0, -130);
    scene.add(g);
    return { mesh: g, lane, passed: false, speedFactor };
}

// ===================== STJÄRNOR (riktig stjärnform) =====================
function createStarGeometry() {
    const shape = new THREE.Shape();
    const outer = 0.7, inner = 0.28;
    for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outer : inner;
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        if (i === 0) shape.moveTo(Math.cos(angle)*r, Math.sin(angle)*r);
        else shape.lineTo(Math.cos(angle)*r, Math.sin(angle)*r);
    }
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
        depth: 0.25, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2
    });
}
const starGeo = createStarGeometry();

function createStar3D() {
    const mesh = new THREE.Mesh(starGeo, new THREE.MeshPhongMaterial({
        color: 0xFFD700, emissive: 0xcc9900, shininess: 200, specular: 0xffffff
    }));
    mesh.castShadow = true;
    return mesh;
}

// ===================== HINDER =====================
function createObstacle3D() {
    const g = new THREE.Group();
    const block = new THREE.Mesh(
        new THREE.BoxGeometry(2.5, 1.8, 1.5, 2, 2, 2),
        new THREE.MeshPhongMaterial({ color: 0xbb3333, shininess: 30, specular: 0x444444 })
    );
    block.position.y = 0.9; block.castShadow = true; g.add(block);
    [0.3, -0.3].forEach((dy, i) => {
        const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(2.55, 0.2, 1.55),
            new THREE.MeshBasicMaterial({ color: i === 0 ? 0xffcc00 : 0x111111 })
        );
        stripe.position.y = 0.9 + dy * 2; g.add(stripe);
    });
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2,12,12), new THREE.MeshBasicMaterial({color:0xff4400}));
    lamp.position.set(0, 2.0, 0); g.add(lamp);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.35,8,8), new THREE.MeshBasicMaterial({color:0xff2200,transparent:true,opacity:0.3}));
    glow.position.copy(lamp.position); g.add(glow);
    return g;
}

function spawnItem() {
    // Spawna inte medan det finns opasserade AI-bilar på vägen
    if (aiCars.some(ai => !ai.passed)) return;
    const lane = Math.floor(Math.random() * 3);
    const isStar = Math.random() < 0.85;
    let mesh;
    if (isStar) {
        mesh = createStar3D();
        mesh.position.set(LANE_POSITIONS[lane], 1.2, -100 - Math.random() * 20);
    } else {
        mesh = createObstacle3D();
        mesh.position.set(LANE_POSITIONS[lane], 0, -100 - Math.random() * 20);
    }
    scene.add(mesh);
    items3D.push({ mesh, lane, isStar, collected: false });
}

// ===================== PARTICLES =====================
let particleSystems = [];
function createExplosion(x, y, z, color) {
    const count = 25;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vels = [];
    for (let i = 0; i < count; i++) {
        pos[i*3]=x; pos[i*3+1]=y; pos[i*3+2]=z;
        vels.push({ vx:(Math.random()-0.5)*0.5, vy:Math.random()*0.4+0.1, vz:(Math.random()-0.5)*0.5 });
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size: 0.35 }));
    scene.add(pts);
    particleSystems.push({ points: pts, velocities: vels, life: 40, geo });
}

function updateParticles() {
    for (let i = particleSystems.length - 1; i >= 0; i--) {
        const ps = particleSystems[i];
        ps.life--;
        const p = ps.geo.attributes.position.array;
        for (let j = 0; j < ps.velocities.length; j++) {
            p[j*3] += ps.velocities[j].vx;
            p[j*3+1] += ps.velocities[j].vy;
            p[j*3+2] += ps.velocities[j].vz;
            ps.velocities[j].vy -= 0.012;
        }
        ps.geo.attributes.position.needsUpdate = true;
        ps.points.material.opacity = ps.life / 40;
        ps.points.material.transparent = true;
        if (ps.life <= 0) {
            scene.remove(ps.points); ps.geo.dispose(); ps.points.material.dispose();
            particleSystems.splice(i, 1);
        }
    }
}

// ===================== SPELLOGIK =====================
function winGame() {
    isPlaying = false;
    hasWon = true;
    playSound('win');
    const finalTime = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(finalTime / 60);
    const seconds = finalTime % 60;
    const timeStr = minutes > 0 ? `${minutes} minuter och ${seconds} sekunder` : `${seconds} sekunder`;
    const timeDisplay = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
    let praise;
    if (finalTime <= 90) praise = 'Otroligt snabbt! Du är en mästare!';
    else if (finalTime <= 120) praise = 'Jättefint! Du körde som ett proffs!';
    else if (finalTime <= 180) praise = 'Bra kört! Riktigt duktigt!';
    else praise = 'Bra jobbat! Du klarade det!';

    const msg = `Grattis! Du samlade ${targetScore} stjärnor på ${timeStr}. ${praise}`;
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(msg);
        u.lang = 'sv-SE'; u.rate = 1.0;
        window.speechSynthesis.speak(u);
    }
    startScreen.style.display = 'flex';
    startScreen.innerHTML = `<h1 style="font-size: clamp(30px, 8vw, 60px); margin-bottom: 10px; text-align: center;">🏆 DU VANN! 🏆</h1><h2 style="font-size: clamp(14px, 4vw, 24px); text-align: center;">Du samlade alla ${targetScore} stjärnor på ${timeDisplay}!<br>${praise}</h2><button id="replay-btn" style="margin-top: 20px; font-size: clamp(18px, 5vw, 30px); padding: 15px 40px; border-radius: 15px; border: 3px solid #FFD700; background: #e74c3c; color: white; cursor: pointer; font-family: inherit; font-weight: bold; box-shadow: 0 4px 15px rgba(0,0,0,0.4);">🏁 Kör igen!</button>`;
    document.getElementById('replay-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        startGame();
    });
}

function resetGame() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    score = 0; frames = 0; speed = 40; currentLane = 1; roadZ = 0;
    hasWon = false;
    startTime = Date.now();
    lastAiCarTime = Date.now();
    targetX = LANE_POSITIONS[1];
    car.position.x = targetX;
    items3D.forEach(item => scene.remove(item.mesh));
    items3D.length = 0;
    aiCars.forEach(ai => scene.remove(ai.mesh));
    aiCars.length = 0;
    particleSystems.forEach(ps => scene.remove(ps.points));
    particleSystems.length = 0;
    scoreSpan.innerText = `0 / ${targetScore}`;
    speedDisplay.innerText = '40 km/h';
}

function gameLoop() {
    if (!isPlaying) { renderer.render(scene, camera); return; }

    // Acceleration (snabbare under 50 km/h)
    if (speed < 50) {
        speed = Math.min(maxSpeed, speed + 0.25);
    } else {
        speed = Math.min(maxSpeed, speed + 0.06);
    }
    const moveSpeed = speed * 0.004;
    roadZ += moveSpeed;

    stripeGroup.position.z = (roadZ % 4);

    // Moln
    clouds.forEach(c => {
        c.mesh.position.x += c.speed;
        if (c.mesh.position.x > 120) c.mesh.position.x = -120;
    });

    // Vindsnurror
    scene.traverse(obj => {
        if (obj.userData.isWindmillBlade) {
            obj.rotation.z += 0.02;
        }
    });

    // Träd + vägkants-objekt (loop)
    trees3D.forEach(tree => {
        tree.position.z += moveSpeed;
        if (tree.position.z > 15) tree.position.z -= ROAD_LENGTH;
    });
    roadside3D.forEach(obj => {
        obj.position.z += moveSpeed;
        if (obj.position.z > 15) obj.position.z -= ROAD_LENGTH;
    });

    // Bil smooth lerp
    targetX = LANE_POSITIONS[currentLane];
    car.position.x += (targetX - car.position.x) * 0.12;
    const dx = targetX - car.position.x;
    car.rotation.z = -dx * 0.08;
    car.rotation.y = dx * 0.04;

    // =========== AI-bilar ===========
    const now = Date.now();
    if (aiCars.length === 0 && now - lastAiCarTime > 20000) {
        // Spawna 2-10 AI-bilar i rader (max 2 per rad = alltid 1 fri fil)
        const numCars = 2 + Math.floor(Math.random() * 9); // 2-10
        let carsPlaced = 0;
        let rowZ = -130;

        while (carsPlaced < numCars) {
            const remaining = numCars - carsPlaced;
            const inThisRow = Math.min(remaining, Math.random() < 0.5 ? 1 : 2);

            const availableLanes = [0, 1, 2];
            const rowLanes = [];
            for (let c = 0; c < inThisRow; c++) {
                const idx = Math.floor(Math.random() * availableLanes.length);
                rowLanes.push(availableLanes.splice(idx, 1)[0]);
            }

            rowLanes.forEach(lane => {
                // Absolut hastighet: 35-70 km/h
                const aiAbsSpeed = 35 + Math.random() * 35;
                const ai = createAiCar(lane, 0);
                ai.absSpeed = aiAbsSpeed;
                ai.originalSpeed = aiAbsSpeed; // Spara original-farten
                ai.mesh.position.z = rowZ + (Math.random() - 0.5) * 4;
                aiCars.push(ai);
                carsPlaced++;
            });

            rowZ -= 14 - Math.random() * 4; // 10-14 enheter mellan rader
        }
    }

    for (let i = aiCars.length - 1; i >= 0; i--) {
        const ai = aiCars[i];

        // AI-bilen decelererar gradvis tillbaka till sin original-fart efter krock
        if (ai.hitOnce && ai.absSpeed > ai.originalSpeed) {
            ai.absSpeed -= 0.3; // Saktar ner ~18 km/h per sekund
            if (ai.absSpeed < ai.originalSpeed) ai.absSpeed = ai.originalSpeed;
        }

        // Relativ rörelse baserad på absoluta hastigheter
        const relativeSpeed = (speed - ai.absSpeed) * 0.004;
        ai.mesh.position.z += relativeSpeed;

        // Första krock: SWAP hastigheter
        if (!ai.passed && !ai.hitOnce && ai.lane === currentLane &&
            ai.mesh.position.z > -2 && ai.mesh.position.z < 5) {
            playSound('crash');
            createExplosion(car.position.x, 1, ai.mesh.position.z, 0xff6600);

            // Swap: vi får AI:ns fart, AI:n får vår fart (men decelererar sedan)
            const ourOldSpeed = speed;
            speed = ai.absSpeed;       // Vi saktas ner
            ai.absSpeed = ourOldSpeed;  // AI:n skjuts framåt (tillfälligt!)
            ai.hitOnce = true;
            ai.hitOnce = true;
        }

        // Krock mellan AI-bilar (om denna bil ligger bakom en annan bil i samma fil och är snabbare)
        for (let j = 0; j < aiCars.length; j++) {
            if (i !== j) {
                const otherAi = aiCars[j];
                // otherAi är framför ai (mindre z i vår värld där mer negativ är längre bort framför oss)
                // Det vill säga otherAi.mesh.position.z < ai.mesh.position.z (other är framför)
                // Men om vi kör z från -130 fram mot oss, så är otherAi framför om den har mindre z.
                // Vänta, bilar spawnas vid -130 och rör sig MOT oss (z ökar mot 0).
                // Så en bil är FRAMFÖR (närmare horisonten) om dess z-värde är LÄGRE än vår.
                if (otherAi.lane === ai.lane && 
                    otherAi.mesh.position.z < ai.mesh.position.z &&
                    otherAi.mesh.position.z > ai.mesh.position.z - 6) {
                    
                    // Om bilen bakom vill åka fortare än bilen framför
                    if (ai.absSpeed > otherAi.absSpeed) {
                        playSound('crash');
                        createExplosion(LANE_POSITIONS[ai.lane], 1, otherAi.mesh.position.z, 0xaaaaaa);
                        
                        // Swap farten för att ge samma effekt
                        const aiOldSpeed = ai.absSpeed;
                        ai.absSpeed = otherAi.absSpeed; // bromsar in
                        otherAi.absSpeed = aiOldSpeed; // bilen framför får en skjuts
                        otherAi.hitOnce = true; // startar ev deceleration
                    }
                }
            }
        }

        // Kontinuerlig blockering: kan inte köra igenom i samma fil
        if (ai.hitOnce && !ai.passed && ai.lane === currentLane &&
            ai.mesh.position.z > -3 && ai.mesh.position.z < 8) {
            if (speed > ai.absSpeed) {
                speed = ai.absSpeed;
            }
        }

        // Passerad
        if (!ai.passed && ai.mesh.position.z > 6) {
            ai.passed = true;
        }

        // Ta bort
        if (ai.mesh.position.z > 40) {
            scene.remove(ai.mesh);
            aiCars.splice(i, 1);
            if (aiCars.length === 0) {
                lastAiCarTime = Date.now();
            }
        }
    }

    // Spawna stjärnor/hinder
    const spawnRate = Math.max(25, 50 - Math.floor(score / 5));
    if (frames % spawnRate === 0) spawnItem();

    // Uppdatera objekt
    for (let i = items3D.length - 1; i >= 0; i--) {
        const item = items3D[i];
        item.mesh.position.z += moveSpeed;

        if (item.isStar) {
            item.mesh.rotation.y += 0.04;
            item.mesh.rotation.x += 0.015;
            item.mesh.position.y = 1.2 + Math.sin(frames * 0.04 + i) * 0.3;
        }

        if (!item.collected && item.mesh.position.z > -1 && item.mesh.position.z < 3) {
            if (item.lane === currentLane) {
                item.collected = true;
                if (item.isStar) {
                    playSound('star');
                    score++;
                    scoreSpan.innerText = `${score} / ${targetScore}`;
                    speed = Math.min(maxSpeed, speed + 3);
                    createExplosion(item.mesh.position.x, 1.2, item.mesh.position.z, 0xFFD700);
                    if (score >= targetScore) setTimeout(winGame, 500);
                } else {
                    playSound('crash');
                    speed = 5;
                    score = Math.max(0, score - 2);
                    scoreSpan.innerText = `${score} / ${targetScore}`;
                    createExplosion(item.mesh.position.x, 0.5, item.mesh.position.z, 0xff4400);
                }
                scene.remove(item.mesh);
                items3D.splice(i, 1);
                continue;
            }
        }
        if (item.mesh.position.z > 15) {
            scene.remove(item.mesh);
            items3D.splice(i, 1);
        }
    }

    updateParticles();

    // Kamera
    const shake = speed > 100 ? (speed - 100) * 0.001 : 0;
    camera.position.x = car.position.x * 0.3 + (Math.random()-0.5) * shake;
    camera.position.y = 4 + (Math.random()-0.5) * shake * 0.5;
    camera.lookAt(car.position.x * 0.5, 1, -20);

    speedDisplay.innerText = `${Math.floor(speed)} km/h`;
    frames++;
    renderer.render(scene, camera);
    requestAnimationFrame(gameLoop);
}

// ===================== INPUT =====================
function getInputLane(e) {
    const rect = container.getBoundingClientRect();
    let clientX;
    if (e.touches && e.touches.length > 0) clientX = e.touches[0].clientX;
    else clientX = e.clientX;
    const relX = (clientX - rect.left) / rect.width;
    if (relX < 0.33) return 0;
    if (relX < 0.66) return 1;
    return 2;
}

function handleInput(e) {
    if (e.target.id === 'help-btn' || (e.target.closest && e.target.closest('#help-btn'))) return;
    if (e.target.id === 'back-btn' || (e.target.closest && e.target.closest('#back-btn'))) return;

    if (e.type === 'keydown') {
        if (e.repeat) return;
        if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
            if (e.cancelable) e.preventDefault();
            if (!isPlaying && !hasWon) { startGame(); return; }
            if (currentLane > 0) { currentLane--; playSound('switch'); }
            return;
        } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
            if (e.cancelable) e.preventDefault();
            if (!isPlaying && !hasWon) { startGame(); return; }
            if (currentLane < 2) { currentLane++; playSound('switch'); }
            return;
        } else if (e.code === 'Space') {
            if (e.cancelable) e.preventDefault();
            if (!isPlaying && !hasWon) { startGame(); return; }
            if (isPlaying) playSound('honk'); // Tuta!
            return;
        }
        return;
    }

    if (e.type === 'touchstart' || e.type === 'mousedown') {
        if (e.cancelable) e.preventDefault();
        if (!isPlaying && !hasWon) { startGame(); return; }
        const newLane = getInputLane(e);
        if (newLane !== currentLane) { currentLane = newLane; playSound('switch'); }
    }
}

function startGame() {
    initAudio();
    if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    startScreen.style.display = 'none';
    isPlaying = true;
    resetGame();
    gameLoop();
}

window.addEventListener('keydown', handleInput);
window.addEventListener('touchstart', handleInput, { passive: false });
window.addEventListener('mousedown', handleInput);

// Knappar
document.getElementById('help-btn').addEventListener('click', (e) => {
    e.stopPropagation(); initAudio();
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(
            'Välkommen till Galna Bilar! ' +
            'Tryck på vänster sida av skärmen för att svänga vänster. ' +
            'Tryck på höger sida för att svänga höger. ' +
            'Tryck i mitten för att köra rakt fram. ' +
            'Samla gula stjärnor för att få poäng. ' +
            'Undvik betongblock, de stoppar dig helt! ' +
            'Ibland dyker det upp andra bilar som du kan köra om. ' +
            'Samla hundra stjärnor för att vinna.'
        );
        msg.lang = 'sv-SE'; msg.rate = 0.9;
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

renderer.render(scene, camera);
