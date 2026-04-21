console.log('Klossbyggaren main.js loading...');
import * as THREE from 'three';
import { World, WATER_LEVEL } from './world.js';
import { Player } from './player.js';
import { InputManager } from './input.js';
import { BLOCKS, SOLID_BLOCKS } from './textures.js';
import { AudioManager } from './audio.js';

const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || navigator.maxTouchPoints > 0;

// ============================================================
// Save / Load System (localStorage with cookie fallback)
// ============================================================
const SAVE_KEY = 'klossbyggaren_save_v1';

function saveGameState() {
    try {
        const state = {
            version: 1,
            seed: world.seed,
            player: {
                x: player.position.x, y: player.position.y, z: player.position.z,
                vx: player.velocity.x, vy: player.velocity.y, vz: player.velocity.z,
                isFlying: player.isFlying
            },
            inventory: currentBlockType,
            edits: playerEdits, // map of "x,y,z" -> blockId
            timestamp: Date.now()
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        showToast('Spel sparat! 💾');
    } catch (e) {
        console.warn('Save failed:', e);
        showToast('Kunde inte spara');
    }
}

function loadGameState() {
    try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('Load failed:', e);
        return null;
    }
}

function deleteSavedGame() {
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

function hasSavedGame() {
    try { return localStorage.getItem(SAVE_KEY) !== null; } catch (e) { return false; }
}

// Player-made edits (tracked for save/load)
const playerEdits = {};

// Apply saved edits to the world (called after chunks load)
function applyPlayerEdits() {
    for (const key in playerEdits) {
        const [x, y, z] = key.split(',').map(Number);
        world.setBlock(x, y, z, playerEdits[key]);
    }
}

// Show a temporary UI toast
function showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);color:#fff;padding:10px 20px;border-radius:10px;font-family:inherit;z-index:200;font-size:18px;pointer-events:none;';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.5s'; }, 2000);
}

// ============================================================
// Init audio
// ============================================================
const audio = new AudioManager();

// ============================================================
// Three.js setup
// ============================================================
const container = document.getElementById('game-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 80, 200);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
if (isMobile) {
    renderer.shadowMap.enabled = false;
    scene.fog = new THREE.Fog(0x87CEEB, 60, 140);
} else {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 100, 20);
if (!isMobile) {
    dirLight.castShadow = true;
    dirLight.shadow.camera.left = -50; dirLight.shadow.camera.right = 50;
    dirLight.shadow.camera.top = 50; dirLight.shadow.camera.bottom = -50;
    dirLight.shadow.mapSize.width = 1024; dirLight.shadow.mapSize.height = 1024;
}
scene.add(dirLight);

// ============================================================
// World, Player, Input
// ============================================================
// worldSeed: load or random
const savedState = loadGameState();
const worldSeed = savedState?.seed ?? Math.floor(Math.random() * 1e9);

const world = new World(scene, worldSeed);
await world.ready;
const player = new Player(camera, world, audio);
const input = new InputManager(camera, renderer.domElement, player);
input.addToScene(scene);

// Restore save state
if (savedState) {
    player.position.set(savedState.player.x, savedState.player.y, savedState.player.z);
    player.velocity.set(savedState.player.vx, savedState.player.vy, savedState.player.vz);
    player.isFlying = savedState.player.isFlying || false;
    if (savedState.edits) {
        Object.assign(playerEdits, savedState.edits);
    }
} else {
    // Default start position - more central in first chunk
    player.position.set(24, 40, 24);
}


// ============================================================
// Highlight box for selected block
// ============================================================
const highlightGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
const highlightMat = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.4 });
const highlightBox = new THREE.Mesh(highlightGeo, highlightMat);
scene.add(highlightBox);

// ============================================================
// Animals / Mobs - more common, variety of types
// ============================================================
const mobs = [];

function createLandMob(x, y, z, type) {
    const group = new THREE.Group();
    let bodyColor = 0xffffff, headColor = 0xffffff, size = 1;
    if (type === 'sheep') { bodyColor = 0xeeeeee; headColor = 0xaa8866; size = 1; }
    else if (type === 'cow') { bodyColor = 0x8b4513; headColor = 0xf5deb3; size = 1.1; }
    else if (type === 'pig') { bodyColor = 0xffb6c1; headColor = 0xff91a4; size = 0.9; }
    else { bodyColor = 0x7cfc00; headColor = 0x5faa00; size = 0.8; } // default green critter

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8 * size, 0.6 * size, 1.2 * size), new THREE.MeshLambertMaterial({ color: bodyColor }));
    body.position.y = 0.3 * size; body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5 * size, 0.5 * size, 0.5 * size), new THREE.MeshLambertMaterial({ color: headColor }));
    head.position.set(0, 0.6 * size, 0.75 * size);
    group.add(head);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeGeo = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const le = new THREE.Mesh(eyeGeo, eyeMat); le.position.set(0.15, 0.7 * size, 1.0 * size); group.add(le);
    const re = new THREE.Mesh(eyeGeo, eyeMat); re.position.set(-0.15, 0.7 * size, 1.0 * size); group.add(re);

    group.position.set(x, y, z);
    scene.add(group);
    mobs.push({ mesh: group, velocity: new THREE.Vector3(), nextMove: 0, phase: Math.random() * Math.PI * 2, kind: 'land' });
}

function createFish(x, y, z) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.8), new THREE.MeshLambertMaterial({ color: 0xffaa00 }));
    group.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshLambertMaterial({ color: 0xff8800 }));
    tail.position.z = -0.5;
    group.add(tail);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeGeo = new THREE.BoxGeometry(0.06, 0.06, 0.06);
    const le = new THREE.Mesh(eyeGeo, eyeMat); le.position.set(0.15, 0.08, 0.3); group.add(le);
    const re = new THREE.Mesh(eyeGeo, eyeMat); re.position.set(-0.15, 0.08, 0.3); group.add(re);

    group.position.set(x, y, z);
    scene.add(group);
    mobs.push({ mesh: group, velocity: new THREE.Vector3(), nextMove: 0, phase: Math.random() * Math.PI * 2, kind: 'fish', anchor: { x, y, z } });
}

function createBird(x, y, z) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.5), new THREE.MeshLambertMaterial({ color: 0xffee44 }));
    group.add(body);
    const wing1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.25), new THREE.MeshLambertMaterial({ color: 0xffcc00 }));
    wing1.position.set(0.3, 0.05, 0); group.add(wing1);
    const wing2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.08, 0.25), new THREE.MeshLambertMaterial({ color: 0xffcc00 }));
    wing2.position.set(-0.3, 0.05, 0); group.add(wing2);

    group.position.set(x, y, z);
    scene.add(group);
    mobs.push({ mesh: group, velocity: new THREE.Vector3(), nextMove: 0, phase: Math.random() * Math.PI * 2, kind: 'bird', anchor: { x, y, z }, wings: [wing1, wing2] });
}

// Spawn a variety of mobs around spawn - reduced counts for better start
function spawnInitialMobs() {
    const types = ['sheep', 'cow', 'pig', 'critter'];
    const landCount = isMobile ? 5 : 10;
    const fishCount = isMobile ? 3 : 6;
    const birdCount = isMobile ? 1 : 3;
    for (let i = 0; i < landCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 10 + Math.random() * 40;
        const x = Math.cos(angle) * dist + player.position.x;
        const z = Math.sin(angle) * dist + player.position.z;
        const y = world.getSurfaceHeight(Math.floor(x), Math.floor(z)) + 1;
        if (y > WATER_LEVEL) createLandMob(x, y, z, types[Math.floor(Math.random() * types.length)]);
    }
    // Fish: 6 in nearby water
    for (let i = 0; i < fishCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 10 + Math.random() * 50;
        const x = Math.cos(angle) * dist + player.position.x;
        const z = Math.sin(angle) * dist + player.position.z;
        if (world.getBlock(x, 9, z) === BLOCKS.WATER) createFish(x, 9.0, z);
    }
    // Birds: 3 flying around
    for (let i = 0; i < birdCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 40;
        const x = Math.cos(angle) * dist + player.position.x;
        const z = Math.sin(angle) * dist + player.position.z;
        createBird(x, 28 + Math.random() * 8, z);
    }
}

// Dynamic spawning: spawns a mob further away as player moves
let lastMobSpawn = 0;
let lastMobCleanup = 0;
function updateDynamicMobs(dt) {
    const now = Date.now();
    // Cleanup mobs > 120 units away
    if (now - lastMobCleanup > 5000) {
        lastMobCleanup = now;
        for (let i = mobs.length - 1; i >= 0; i--) {
            const dSq = mobs[i].mesh.position.distanceToSquared(player.position);
            if (dSq > 120 * 120) {
                scene.remove(mobs[i].mesh);
                mobs.splice(i, 1);
            }
        }
    }

    // Spawn new mobs if count is low
    const maxMobs = isMobile ? 15 : 30;
    if (mobs.length < maxMobs && now - lastMobSpawn > 3000) {
        lastMobSpawn = now;
        const angle = Math.random() * Math.PI * 2;
        const dist = 70 + Math.random() * 30; // spawn at distance
        const x = Math.cos(angle) * dist + player.position.x;
        const z = Math.sin(angle) * dist + player.position.z;
        
        const r = Math.random();
        if (r < 0.6) { // Land animal
            const y = world.getSurfaceHeight(Math.floor(x), Math.floor(z)) + 1;
            if (y > WATER_LEVEL + 1) {
                const types = ['sheep', 'cow', 'pig', 'critter'];
                createLandMob(x, y, z, types[Math.floor(Math.random() * types.length)]);
            }
        } else if (r < 0.85) { // Bird
             createBird(x, 25 + Math.random() * 15, z);
        } else { // Fish
            if (world.getBlock(x, 9, z) === BLOCKS.WATER) createFish(x, 9.0, z);
        }
    }
}

// ============================================================
// Inventory
// ============================================================
let currentBlockType = savedState ? (savedState.inventory || BLOCKS.GRASS) : BLOCKS.GRASS;
const blockChoices = [
    { id: BLOCKS.GRASS, label: 'Gräs' },
    { id: BLOCKS.DIRT, label: 'Jord' },
    { id: BLOCKS.SAND, label: 'Sand' },
    { id: BLOCKS.STONE, label: 'Sten' },
    { id: BLOCKS.WOOD, label: 'Trä' },
    { id: BLOCKS.PLANKS, label: 'Plank' },
    { id: BLOCKS.GLASS, label: 'Glas' },
    { id: BLOCKS.GRAVEL, label: 'Grus' },
    { id: BLOCKS.LEAVES, label: 'Löv' },
];

const slotsContainer = document.getElementById('inventory-ui');
slotsContainer.innerHTML = '';
blockChoices.forEach((choice, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot' + (choice.id === currentBlockType ? ' active' : '');
    slot.dataset.type = choice.id;
    slot.innerHTML = '<span>' + choice.label + '</span>';
    slotsContainer.appendChild(slot);
    slot.addEventListener('click', () => {
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
        slot.classList.add('active');
        currentBlockType = choice.id;
    });
});
window.addEventListener('block_select', (e) => {
    const slot = document.querySelector('.slot[data-type="' + e.detail + '"]');
    if (slot) slot.click();
});

// ============================================================
// Menu / Save / New map buttons
// ============================================================
document.getElementById('btn-start').addEventListener('click', () => { audio.init(); });

const btnSave = document.getElementById('btn-save');
if (btnSave) btnSave.addEventListener('click', (e) => { e.stopPropagation(); saveGameState(); });

const btnNewMap = document.getElementById('btn-new-map');
if (btnNewMap) btnNewMap.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm('Starta en ny karta? Ditt nuvarande spel kommer att raderas.')) {
        deleteSavedGame();
        location.reload();
    }
});

// Hide new map button if nothing is saved
if (btnNewMap && !hasSavedGame()) {
    btnNewMap.style.display = 'none';
}

// ============================================================
// Voxel Raycast for block interaction
// ============================================================
function voxelRaycast(origin, direction, maxDist) {
    const dx = direction.x, dy = direction.y, dz = direction.z;
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    const tDeltaZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
    let tMaxX = dx !== 0 ? (dx > 0 ? (x + 1 - origin.x) : (origin.x - x)) * tDeltaX : Infinity;
    let tMaxY = dy !== 0 ? (dy > 0 ? (y + 1 - origin.y) : (origin.y - y)) * tDeltaY : Infinity;
    let tMaxZ = dz !== 0 ? (dz > 0 ? (z + 1 - origin.z) : (origin.z - z)) * tDeltaZ : Infinity;
    let prevX = x, prevY = y, prevZ = z, dist = 0;
    while (dist < maxDist) {
        const block = world.getBlock(x, y, z);
        if (block !== BLOCKS.AIR && block !== BLOCKS.WATER && block !== BLOCKS.CLOUD) {
            return { x, y, z, block, prevX, prevY, prevZ };
        }
        prevX = x; prevY = y; prevZ = z;
        if (tMaxX < tMaxY) {
            if (tMaxX < tMaxZ) { x += stepX; dist = tMaxX; tMaxX += tDeltaX; }
            else { z += stepZ; dist = tMaxZ; tMaxZ += tDeltaZ; }
        } else {
            if (tMaxY < tMaxZ) { y += stepY; dist = tMaxY; tMaxY += tDeltaY; }
            else { z += stepZ; dist = tMaxZ; tMaxZ += tDeltaZ; }
        }
    }
    return null;
}

function handleInteract(action) {
    if (!input.isLocked && !input.isTouch) return;
    const hit = voxelRaycast(
        camera.getWorldPosition(new THREE.Vector3()),
        camera.getWorldDirection(new THREE.Vector3()),
        8
    );
    if (!hit) return;
    if (action === 'break') {
        world.setBlock(hit.x, hit.y, hit.z, BLOCKS.AIR);
        playerEdits[hit.x + ',' + hit.y + ',' + hit.z] = BLOCKS.AIR;
        audio.playBreak();
    } else if (action === 'build') {
        const hw = player.width / 2;
        const minX = Math.floor(player.position.x - hw);
        const maxX = Math.floor(player.position.x + hw);
        const minY = Math.floor(player.position.y);
        const maxY = Math.floor(player.position.y + player.height);
        const minZ = Math.floor(player.position.z - hw);
        const maxZ = Math.floor(player.position.z + hw);
        // Don't place inside player's full AABB
        if (hit.prevX >= minX && hit.prevX <= maxX && hit.prevZ >= minZ && hit.prevZ <= maxZ && hit.prevY >= minY && hit.prevY <= maxY) return;
        world.setBlock(hit.prevX, hit.prevY, hit.prevZ, currentBlockType);
        playerEdits[hit.prevX + ',' + hit.prevY + ',' + hit.prevZ] = currentBlockType;
        audio.playPlace();
    }
}

window.addEventListener('mousedown', (e) => {
    if (!input.isLocked) return;
    if (e.button === 0) handleInteract('break');
    if (e.button === 2) handleInteract('build');
});
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('touch_build', () => handleInteract('build'));
window.addEventListener('touch_break', () => handleInteract('break'));

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
// Minimap - shows more of the world with better colors
// ============================================================
const minimapCanvas = document.getElementById('minimap');
const mmCtx = minimapCanvas.getContext('2d');
let mmFrame = 0;

// Range is now larger - shows much more of the map
const MINIMAP_RANGE = 40; // was 100 - reduced to eliminate freezes

function getBlockColor(block) {
    switch (block) {
        case BLOCKS.GRASS: return '#6ab04c';
        case BLOCKS.WATER: return '#2196F3';
        case BLOCKS.SAND: return '#F4A460';
        case BLOCKS.STONE: return '#9E9E9E';
        case BLOCKS.PLANKS:
        case BLOCKS.WOOD: return '#BCAAA4';
        case BLOCKS.LEAVES: return '#2E7D32';
        case BLOCKS.GRAVEL: return '#8a8577';
        case BLOCKS.PATH: return '#D2B48C';
        case BLOCKS.DIRT: return '#795548';
        case BLOCKS.CLOUD: return '#ffffff';
        case BLOCKS.FLOWER_RED: return '#E53935';
        case BLOCKS.FLOWER_YELLOW: return '#FFD54F';
        case BLOCKS.GLASS: return '#ADD8E6';
        default: return '#888888';
    }
}

function updateMinimap() {
    const size = minimapCanvas.width;
    const half = size / 2;
    mmCtx.clearRect(0, 0, size, size);

    // Clipping to circle
    mmCtx.save();
    mmCtx.beginPath();
    mmCtx.arc(half, half, half - 2, 0, Math.PI * 2);
    mmCtx.clip();

    // Background
    mmCtx.fillStyle = 'rgba(0,0,0,0.25)';
    mmCtx.fillRect(0, 0, size, size);

    const scale = size / (MINIMAP_RANGE * 2);
    const step = Math.max(1, Math.floor(1 / scale));

    for (let dx = -MINIMAP_RANGE; dx <= MINIMAP_RANGE; dx += step) {
        for (let dz = -MINIMAP_RANGE; dz <= MINIMAP_RANGE; dz += step) {
            const wx = Math.floor(player.position.x) + dx;
            const wz = Math.floor(player.position.z) + dz;
            const sy = world.getSurfaceHeight(wx, wz);
            const block = world.getBlock(wx, sy, wz);
            if (block !== BLOCKS.AIR) {
                mmCtx.fillStyle = getBlockColor(block);
                const px = half + dx * scale;
                const pz = half + dz * scale;
                const s = Math.max(1, scale * step);
                mmCtx.fillRect(px, pz, s, s);
            }
        }
    }

    mmCtx.restore();

    // Player dot
    mmCtx.fillStyle = '#ff0000';
    mmCtx.beginPath();
    mmCtx.arc(half, half, 4, 0, Math.PI * 2);
    mmCtx.fill();

    // Player facing direction
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    mmCtx.strokeStyle = '#ffffff';
    mmCtx.lineWidth = 2;
    mmCtx.beginPath();
    mmCtx.moveTo(half, half);
    mmCtx.lineTo(half + dir.x * 12, half + dir.z * 12);
    mmCtx.stroke();
}

// ============================================================
// Main game loop
// ============================================================
const clock = new THREE.Clock();
let lastAutoSave = Date.now();

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    // Throttle world updates - only update every 2 frames to reduce CPU load
    const frameN = Math.floor(performance.now() / 16);
    const throttleRate = isMobile ? 3 : 2;
    if (frameN % throttleRate === 0) {
        world.update(player.position.x, player.position.z);
    }
    input.update();
    player.update(dt);
    input.updatePlayerPosition(player.position);

    mmFrame++;
    const mmThrottle = isMobile ? 120 : 180;
    if (mmFrame % mmThrottle === 0) updateMinimap();

    // Update sun to follow player
    dirLight.position.set(player.position.x + 20, player.position.y + 100, player.position.z + 20);
    dirLight.target.position.copy(player.position);
    dirLight.target.updateMatrixWorld();

    // Animate mobs - reduce update frequency to every 2 frames
    const mobThrottle = isMobile ? 4 : 2;
    if (frameN % mobThrottle === 0) {
        updateDynamicMobs(dt);
        mobs.forEach(mob => {
            if (mob.kind === 'land') {
                if (Date.now() > mob.nextMove) {
                    mob.velocity.x = (Math.random() - 0.5) * 0.8;
                    mob.velocity.z = (Math.random() - 0.5) * 0.8;
                    mob.nextMove = Date.now() + 4000 + Math.random() * 6000;
                }
                const isMoving = mob.velocity.lengthSq() > 0.01;
                if (isMoving) {
                    mob.phase += dt * 6;
                    mob.mesh.position.addScaledVector(mob.velocity, dt);
                    mob.mesh.position.y = world.getSurfaceHeight(mob.mesh.position.x, mob.mesh.position.z) + 1 + Math.abs(Math.sin(mob.phase)) * 0.1;
                    mob.mesh.rotation.y = Math.atan2(mob.velocity.x, mob.velocity.z);
                } else { mob.phase = 0; }
            } else if (mob.kind === 'fish') {
                mob.phase += dt;
                mob.mesh.position.x += Math.cos(mob.phase * 0.5) * 0.03;
                mob.mesh.position.z += Math.sin(mob.phase * 0.5) * 0.03;
                mob.mesh.position.y = 9.0 + Math.sin(mob.phase * 2) * 0.2;
                mob.mesh.rotation.y = mob.phase * 0.5 + Math.PI;
            } else if (mob.kind === 'bird') {
                mob.phase += dt;
                mob.mesh.position.x += Math.cos(mob.phase * 0.3) * 0.15;
                mob.mesh.position.z += Math.sin(mob.phase * 0.3) * 0.15;
                mob.mesh.position.y += Math.sin(mob.phase * 1.5) * 0.05;
                mob.mesh.rotation.y = mob.phase * 0.3 + Math.PI / 2;
                if (mob.wings) {
                    mob.wings[0].rotation.z = Math.sin(mob.phase * 10) * 0.8;
                    mob.wings[1].rotation.z = -Math.sin(mob.phase * 10) * 0.8;
                }
            }
        });
    }
    // Highlight hovered block
    const hit = voxelRaycast(
        camera.getWorldPosition(new THREE.Vector3()),
        camera.getWorldDirection(new THREE.Vector3()),
        8
    );
    // Simplify: skip expensive raycast checks when not actively looking
    if (hit && (input.isLocked || input.isTouch) && input.isLooking) {
        highlightBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        highlightBox.visible = true;
    } else {
        highlightBox.visible = false;
    }

    // Auto-save every 30 seconds while playing
    if (input.isStarted && Date.now() - lastAutoSave > 30000) {
        saveGameState();
        lastAutoSave = Date.now();
    }

    renderer.render(scene, camera);
}

// Startup sequence
try {
    console.log('Initializing world...');
    world.update(player.position.x, player.position.z);

    // Wait slightly for chunks, then start
    setTimeout(() => {
        console.log('Running final init...');
        applyPlayerEdits();

        if (!savedState) {
            // Find ground or safe height
            player.position.y = 40; 
        }

        spawnInitialMobs();
        
        console.log('Entering animate loop');
        animate();
    }, 500);
} catch (err) {
    console.error('CRITICAL STARTUP ERROR:', err);
}
