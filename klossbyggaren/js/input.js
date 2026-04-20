import * as THREE from 'three';

export class InputManager {
    constructor(camera, domElement, player, document) {
        this.camera = camera;
        this.domElement = domElement;
        this.player = player;
        this.document = document;
        
        // State
        this.keys = {};
        this.isLocked = false;
        
        // Touch State
        this.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        this.joystickActive = false;
        this.joystickId = null;
        this.joystickCenter = {x:0, y:0};
        this.camTouchId = null;
        this.camLastPos = {x:0, y:0};
        
        // Kamera rotation (Pitch = Upp/Ner, Yaw = Vänster/Höger)
        this.yaw = new THREE.Object3D();
        this.pitch = new THREE.Object3D();
        // Koppla kameran till pitch, och pitch till yaw
        this.yaw.add(this.pitch);
        this.pitch.add(this.camera);
        
        // Vi lägger yaw-objektet i världen (scenen) istället för kameran direkt
        
        this.setupKeyboard();
        this.setupMouse();
        if(this.isTouch) {
            this.setupTouch();
            // Visa touch UI
            document.getElementById('touch-ui').style.display = 'block';
        }
    }
    
    addToScene(scene) {
        scene.add(this.yaw);
    }
    
    // Används av player.js via Camera direction
    // Men player.js läser camera.getWorldDirection, vilket funkar perfekt
    // när kameran är barn till pitch som är barn till yaw!
    
    updatePlayerPosition(pos) {
        this.yaw.position.copy(pos);
    }
    
    setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if(e.code === 'Space') this.player.jump();
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }
    
    setupMouse() {
        // Pointer Lock på Desktop (När man klickar i fönstret)
        this.domElement.addEventListener('click', () => {
            if(!this.isTouch && !this.isLocked) {
                this.domElement.requestPointerLock();
            }
        });
        
        document.addEventListener('pointerlockchange', () => {
            this.isLocked = (document.pointerLockElement === this.domElement);
            const menu = document.getElementById('menu');
            if(this.isLocked || this.isTouch) {
                menu.style.display = 'none';
            } else {
                menu.style.display = 'flex';
            }
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isLocked) {
                this.rotateCamera(e.movementX, e.movementY);
            }
        });
        
        // Hantera mus-klick för att bygga (i main.js)
    }
    
    rotateCamera(movementX, movementY) {
        const sensitivity = 0.002;
        this.yaw.rotation.y -= movementX * sensitivity;
        this.pitch.rotation.x -= movementY * sensitivity;
        
        // Begränsa upp/ner titt (Pitch)
        const PI_2 = Math.PI / 2;
        this.pitch.rotation.x = Math.max(-PI_2, Math.min(PI_2, this.pitch.rotation.x));
    }
    
    setupTouch() {
        const zone = document.getElementById('joystick-zone');
        const stick = document.createElement('div');
        stick.id = 'joystick-stick';
        zone.appendChild(stick);
        
        // Dölj startmenyn automatiskt med Startknappen
        document.getElementById('btn-start').addEventListener('click', () => {
            document.getElementById('menu').style.display = 'none';
            this.isLocked = true; // Fake lock för touch
        });

        zone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            this.joystickId = touch.identifier;
            this.joystickActive = true;
            
            const rect = zone.getBoundingClientRect();
            this.joystickCenter = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
            this.updateJoystick(touch.clientX, touch.clientY);
        }, {passive: false});
        
        window.addEventListener('touchmove', (e) => {
            for(let i=0; i<e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                
                // Vänster tumme (Joystick)
                if(touch.identifier === this.joystickId && this.joystickActive) {
                    this.updateJoystick(touch.clientX, touch.clientY);
                }
                
                // Höger tumme (Kamera rotation) - kolla att det inte rör knapparna? Enkelt: övriga skärmen
                if(touch.identifier === this.camTouchId) {
                    const dx = touch.clientX - this.camLastPos.x;
                    const dy = touch.clientY - this.camLastPos.y;
                    this.rotateCamera(dx * 2, dy * 2); // Öka sensitivietet för touch
                    this.camLastPos = {x: touch.clientX, y: touch.clientY};
                }
            }
        }, {passive: false});
        
        // Lyssna på touch start på resten av skärmen för att titta runt
        this.domElement.addEventListener('touchstart', (e) => {
            // Hitta en touch som är på högra halvan
            for(let i=0; i<e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if(touch.clientX > window.innerWidth / 2) {
                    // Starta kamera-roteration
                    if(this.camTouchId === null) {
                        this.camTouchId = touch.identifier;
                        this.camLastPos = {x: touch.clientX, y: touch.clientY};
                    }
                }
            }
        });
        
        window.addEventListener('touchend', (e) => {
            for(let i=0; i<e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if(touch.identifier === this.joystickId) {
                    this.joystickActive = false;
                    this.joystickId = null;
                    stick.style.transform = \`translate(0px, 0px)\`;
                    this.player.input.set(0, 0, 0); // Stanna!
                }
                if(touch.identifier === this.camTouchId) {
                    this.camTouchId = null;
                }
            }
        });
        
        // Knappar
        document.getElementById('btn-jump').addEventListener('touchstart', (e)=>{ e.preventDefault(); this.player.jump(); });
        // Bygg/Bryt delegater hanteras i main.js genom events, så vi skickar ett custom event
        document.getElementById('btn-place').addEventListener('touchstart', (e)=>{ e.preventDefault(); window.dispatchEvent(new Event('touch_build')); });
        document.getElementById('btn-break').addEventListener('touchstart', (e)=>{ e.preventDefault(); window.dispatchEvent(new Event('touch_break')); });
    }
    
    updateJoystick(x, y) {
        const dx = x - this.joystickCenter.x;
        const dy = y - this.joystickCenter.y;
        const maxDist = 50;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        let tx = dx;
        let ty = dy;
        if(dist > maxDist) {
            tx = (dx / dist) * maxDist;
            ty = (dy / dist) * maxDist;
        }
        
        document.getElementById('joystick-stick').style.transform = \`translate(\${tx}px, \${ty}px)\`;
        
        // Normaliserad input (-1 till 1), upp är -Z, ner är +Z
        this.player.input.x = tx / maxDist;
        this.player.input.z = ty / maxDist;
    }
    
    update() {
        if(!this.isLocked && !this.isTouch) return;
        
        if(!this.isTouch || !this.joystickActive) {
            // Skapa vector, W är framåt (-Z)
            let x = 0, z = 0;
            if(this.keys['KeyW']) z -= 1;
            if(this.keys['KeyS']) z += 1;
            if(this.keys['KeyA']) x -= 1;
            if(this.keys['KeyD']) x += 1;
            
            // Normalisera för att inte gå snabbare diagonalt
            if(x !== 0 && z !== 0) {
                const len = Math.sqrt(x*x + z*z);
                x /= len;
                z /= len;
            }
            this.player.input.set(x, 0, z);
        }
    }
}
