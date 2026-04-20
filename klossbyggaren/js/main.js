import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { InputManager } from './input.js';
import { BLOCKS } from './textures.js';
import { AudioManager } from './audio.js';

// Setup Audio
const audio = new AudioManager();

// Setup Three.js
const container = document.getElementById('game-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 40, 100);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(20, 100, 20);
dirLight.castShadow = true;
dirLight.shadow.camera.left = -50; dirLight.shadow.camera.right = 50;
dirLight.shadow.camera.top = 50; dirLight.shadow.camera.bottom = -50;
dirLight.shadow.mapSize.width = 1024; dirLight.shadow.mapSize.height = 1024;
scene.add(dirLight);

// Värld och Spelare
const world = new World(scene);
const player = new Player(camera, world, audio);
const input = new InputManager(camera, renderer.domElement, player);
input.addToScene(scene);

const highlightGeo = new THREE.BoxGeometry(1.02, 1.02, 1.02);
const highlightMat = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.4 });
const highlightBox = new THREE.Mesh(highlightGeo, highlightMat);
scene.add(highlightBox);

const mobs = [];
function createMob(x, y, z) {
    const color = Math.random() > 0.5 ? 0xffffff : 0x795548;
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 1.2), new THREE.MeshLambertMaterial({ color }));
    body.position.y = 0.3; body.castShadow = true;
    group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshLambertMaterial({ color }));
    head.position.set(0, 0.6, 0.75);
    group.add(head);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat); leftEye.position.set(0.15, 0.7, 1.0); group.add(leftEye);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat); rightEye.position.set(-0.15, 0.7, 1.0); group.add(rightEye);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.1), eyeMat); mouth.position.set(0, 0.55, 1.0); group.add(mouth);
    group.position.set(x, y, z);
    scene.add(group);
    mobs.push({ mesh: group, velocity: new THREE.Vector3(), nextMove: 0, phase: Math.random()*Math.PI*2 });
}
for(let i=0; i<6; i++) createMob(Math.random()*100-50, 40, Math.random()*100-50);

// Inventory (Nu med Sand och Glas!)
let currentBlockType = BLOCKS.GRASS;
const blockChoices = [BLOCKS.GRASS, BLOCKS.DIRT, BLOCKS.SAND, BLOCKS.STONE, BLOCKS.WOOD, BLOCKS.PLANKS, BLOCKS.GLASS];
const slotsContainer = document.getElementById('inventory-ui');
slotsContainer.innerHTML = ''; // Rensa gamla slots
blockChoices.forEach((type, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot' + (i === 0 ? ' active' : '');
    slot.dataset.type = type;
    slot.innerHTML = `<span>${Object.keys(BLOCKS).find(k => BLOCKS[k] === type).charAt(0)}</span>`;
    slotsContainer.appendChild(slot);
    slot.addEventListener('click', () => {
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
        slot.classList.add('active');
        currentBlockType = type;
    });
});
window.addEventListener('block_select', (e) => {
    const slot = document.querySelector(`.slot[data-type="${e.detail}"]`);
    if(slot) slot.click();
});

document.getElementById('btn-start').addEventListener('click', () => { audio.init(); });

function voxelRaycast(origin, direction, maxDist) {
    const dx = direction.x, dy = direction.y, dz = direction.z;
    let x = Math.floor(origin.x), y = Math.floor(origin.y), z = Math.floor(origin.z);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDeltaX = Math.abs(1 / dx), tDeltaY = Math.abs(1 / dy), tDeltaZ = Math.abs(1 / dz);
    let tMaxX = dx > 0 ? (x + 1 - origin.x) * tDeltaX : (origin.x - x) * tDeltaX;
    let tMaxY = dy > 0 ? (y + 1 - origin.y) * tDeltaY : (origin.y - y) * tDeltaY;
    let tMaxZ = dz > 0 ? (z + 1 - origin.z) * tDeltaZ : (origin.z - z) * tDeltaZ;
    let prevX = x, prevY = y, prevZ = z; let dist = 0;
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
    if(!input.isLocked && !input.isTouch) return;
    const hit = voxelRaycast(camera.getWorldPosition(new THREE.Vector3()), camera.getWorldDirection(new THREE.Vector3()), 8);
    if(hit) {
        if (action === 'break') {
            world.setBlock(hit.x, hit.y, hit.z, BLOCKS.AIR);
            audio.playBreak();
        } else if (action === 'build') {
            const px = Math.floor(player.position.x), py = Math.floor(player.position.y), pz = Math.floor(player.position.z);
            if(!(hit.prevX === px && hit.prevZ === pz && (hit.prevY === py || hit.prevY === py + 1))) {
                world.setBlock(hit.prevX, hit.prevY, hit.prevZ, currentBlockType);
                audio.playPlace();
            }
        }
    }
}

window.addEventListener('mousedown', (e) => {
    if(!input.isLocked) return;
    if(e.button === 0) handleInteract('break');
    if(e.button === 2) handleInteract('build');
});
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('touch_build', () => handleInteract('build'));
window.addEventListener('touch_break', () => handleInteract('break'));

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    world.update(player.position.x, player.position.z);
    input.update(); player.update(dt); input.updatePlayerPosition(player.position);
    dirLight.position.set(player.position.x + 20, player.position.y + 100, player.position.z + 20);
    dirLight.target.position.copy(player.position); dirLight.target.updateMatrixWorld();
    mobs.forEach(mob => {
        if (Date.now() > mob.nextMove) {
            mob.velocity.x = (Math.random() - 0.5) * 0.8;
            mob.velocity.z = (Math.random() - 0.5) * 0.8;
            mob.nextMove = Date.now() + 4000 + Math.random() * 6000;
        }
        const isMoving = mob.velocity.lengthSq() > 0.01;
        if (isMoving) {
            mob.phase += dt * 6;
            mob.mesh.position.addScaledVector(mob.velocity, dt);
            mob.mesh.rotation.y = Math.atan2(mob.velocity.x, mob.velocity.z);
        } else { mob.phase = 0; }
        const groundY = world.getSurfaceHeight(mob.mesh.position.x, mob.mesh.position.z);
        mob.mesh.position.y = (groundY + 1) + Math.abs(Math.sin(mob.phase)) * 0.2;
    });
    const hit = voxelRaycast(camera.getWorldPosition(new THREE.Vector3()), camera.getWorldDirection(new THREE.Vector3()), 8);
    if(hit && (input.isLocked || input.isTouch)) {
        highlightBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        highlightBox.visible = true;
    } else { highlightBox.visible = false; }
    renderer.render(scene, camera);
}

world.update(player.position.x, player.position.z);
setTimeout(() => {
    for(let y = 45; y > 0; y--) {
        if(world.getBlock(Math.floor(player.position.x), y, Math.floor(player.position.z)) !== BLOCKS.AIR && world.getBlock(Math.floor(player.position.x), y, Math.floor(player.position.z)) !== BLOCKS.WATER) {
            player.position.y = y + 1; break;
        }
    }
    animate();
}, 200);
