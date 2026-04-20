import * as THREE from 'three';
import { World } from './world.js';
import { Player } from './player.js';
import { InputManager } from './input.js';
import { BLOCKS } from './textures.js';

// Setup Three.js
const container = document.getElementById('game-container');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB); // Himmel
scene.fog = new THREE.Fog(0x87CEEB, 20, 50); // Mjuk dimma som matchar himlen (gömmer laddningen av chunks)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ antialias: false }); // Pixel-perfekt!
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// Ljus
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
dirLight.position.set(20, 50, 20);
dirLight.castShadow = true;
// Större shadow map area för chunks
dirLight.shadow.camera.left = -30;
dirLight.shadow.camera.right = 30;
dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = -30;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
scene.add(dirLight);

// Skapa Värld och Spelare
const world = new World(scene);
const player = new Player(camera, world);
const input = new InputManager(camera, renderer.domElement, player, document);
input.addToScene(scene);

// Highlight för blocket man tittar på
const highlightGeo = new THREE.BoxGeometry(1.001, 1.001, 1.001);
const highlightMat = new THREE.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.2 });
const highlightBox = new THREE.Mesh(highlightGeo, highlightMat);
scene.add(highlightBox);

// Inventory System
let currentBlockType = BLOCKS.GRASS;
document.querySelectorAll('.slot').forEach(slot => {
    slot.addEventListener('click', (e) => {
        document.querySelectorAll('.slot').forEach(s => s.classList.remove('active'));
        slot.classList.add('active');
        currentBlockType = parseInt(slot.dataset.type);
    });
});

// UI Eventlyssnare för Start
document.getElementById('btn-start').addEventListener('click', () => {
    if(!input.isTouch) {
        renderer.domElement.requestPointerLock();
    }
});

// Interaction (Bygga / Bryta)
const raycaster = new THREE.Raycaster();
raycaster.far = 8; // Räckvidd
const center = new THREE.Vector2(0, 0);

function getTargetBlock() {
    raycaster.setFromCamera(center, camera);
    
    // Testa raycast mot alla meshes i scenen
    const intersects = raycaster.intersectObjects(scene.children);
    
    for (let i = 0; i < intersects.length; i++) {
        // Ignorera Highlight-boxen
        if (intersects[i].object === highlightBox) continue;
        
        // Hitta den första InstancedMeshen
        if (intersects[i].object.isInstancedMesh) {
            return intersects[i];
        }
    }
    return null;
}

function handleInteract(action) { // action = 'build' | 'break'
    if(!input.isLocked && !input.isTouch) return;
    
    const hit = getTargetBlock();
    if(hit) {
        const obj = hit.object;
        const instanceId = hit.instanceId;
        
        // Hämta positionen för just denna instansen
        const matrix = new THREE.Matrix4();
        obj.getMatrixAt(instanceId, matrix);
        const position = new THREE.Vector3();
        position.setFromMatrixPosition(matrix);
        
        let targetX = Math.round(position.x);
        let targetY = Math.round(position.y);
        let targetZ = Math.round(position.z);
        
        if (action === 'break') {
            world.setBlock(targetX, targetY, targetZ, BLOCKS.AIR);
        } else if (action === 'build') {
            // Lägg till block längs normalen
            targetX += Math.round(hit.face.normal.x);
            targetY += Math.round(hit.face.normal.y);
            targetZ += Math.round(hit.face.normal.z);
            
            // Säkerställ att man inte bygger inuti sig själv
            const px = Math.floor(player.position.x);
            const py = Math.floor(player.position.y);
            const pz = Math.floor(player.position.z);
            
            // Lite slarvig AABB - kolla om kuben är där spelaren är
            const distSq = (px-targetX)**2 + (py-targetY)**2 + (pz-targetZ)**2;
            if(distSq > 1 || (py !== targetY && py+1 !== targetY)) {
                world.setBlock(targetX, targetY, targetZ, currentBlockType);
            }
        }
    }
}

// Mus-händelser
window.addEventListener('mousedown', (e) => {
    if(!input.isLocked) return;
    if(e.button === 0) handleInteract('break'); // Vänsterklick
    if(e.button === 2) handleInteract('build'); // Högerklick
});
window.addEventListener('contextmenu', e => e.preventDefault()); // Förhindra meny vid högerklick

// Touch-händelser från knapparna
window.addEventListener('touch_build', () => handleInteract('build'));
window.addEventListener('touch_break', () => handleInteract('break'));

// Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Game Loop
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    
    const dt = Math.min(clock.getDelta(), 0.1); // Max delta för att undvika noclip i lagg
    
    // Hantera Fysik & Spelare
    world.update(player.position.x, player.position.z);
    input.update();
    player.update(dt);
    
    // Följ spelarens position med Input manager
    input.updatePlayerPosition(player.position);
    
    // Solens/Ljusets rörelse - Uppdatera DirLight till att vara nära spelaren (Skuggor!)
    dirLight.position.set(player.position.x + 20, player.position.y + 50, player.position.z + 20);
    dirLight.target.position.copy(player.position);
    dirLight.target.updateMatrixWorld();
    
    // Highlight Block Logic
    const hit = getTargetBlock();
    if(hit && (input.isLocked || input.isTouch)) {
        const matrix = new THREE.Matrix4();
        hit.object.getMatrixAt(hit.instanceId, matrix);
        const position = new THREE.Vector3();
        position.setFromMatrixPosition(matrix);
        highlightBox.position.copy(position);
        highlightBox.visible = true;
    } else {
        highlightBox.visible = false;
    }
    
    renderer.render(scene, camera);
}

// Låt spelaren stå stilla med en första init innan loopen för att förhindra att man faller av kartan direkt
world.update(player.position.x, player.position.z);
setTimeout(() => {
    // Sätt spelaren på högsta blocket direkt!
    for(let y = Math.floor(player.position.y); y > 0; y--) {
        if(world.getBlock(Math.floor(player.position.x), y, Math.floor(player.position.z)) !== BLOCKS.AIR) {
            player.position.y = y + 1;
            break;
        }
    }
    animate();
}, 200); // Låt världen fyllas
