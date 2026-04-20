import * as THREE from 'three';

export class InputManager {
    constructor(camera, domElement, player) {
        this.camera = camera;
        this.domElement = domElement;
        this.player = player;
        
        // State
        this.keys = {};
        this.isLocked = false;
        this.isStarted = false;
        
        // Touch State
        this.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        this.joystickActive = false;
        this.joystickId = null;
        this.joystickCenter = {x:0, y:0};
        this.camTouchId = null;
        this.camLastPos = {x:0, y:0};
        this.isJumpHeld = false;
        
        // Kamera rotation (Pitch = Upp/Ner, Yaw = Vänster/Höger)
        this.yaw = new THREE.Object3D();
        this.pitch = new THREE.Object3D();
        // Koppla kameran till pitch, och pitch till yaw
        this.yaw.add(this.pitch);
        this.pitch.add(this.camera);
        
        this.setupKeyboard();
        this.setupMouse();
        this.setupStartButton();

        if(this.isTouch) {
            this.setupTouch();
            // Visa touch UI
            document.getElementById('touch-ui').style.display = 'block';
        }
    }
    
    addToScene(scene) {
        scene.add(this.yaw);
    }
    
    updatePlayerPosition(pos) {
        this.yaw.position.set(pos.x, pos.y + 1.5, pos.z);
    }
    
    setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if(e.code === 'Space') {
                e.preventDefault();
                this.player.jump();
            }
            // Inventory snabbval (1-5)
            if(e.code >= 'Digit1' && e.code <= 'Digit5') {
                const idx = parseInt(e.code.replace('Digit', '')) - 1;
                const slots = document.querySelectorAll('.slot');
                if(slots[idx]) {
                    slots.forEach(s => s.classList.remove('active'));
                    slots[idx].classList.add('active');
                    window.dispatchEvent(new CustomEvent('block_select', { detail: parseInt(slots[idx].dataset.type) }));
                }
            }
            if(e.code === 'KeyK') {
                this.player.superJump();
            }
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }
    
    setupMouse() {
        // Pointer Lock på Desktop (När man klickar i fönstret)
        this.domElement.addEventListener('click', () => {
            if(!this.isTouch && this.isStarted && !this.isLocked) {
                this.domElement.requestPointerLock();
            }
        });
        
        document.addEventListener('pointerlockchange', () => {
            this.isLocked = (document.pointerLockElement === this.domElement);
            this.updateMenuVisibility();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (this.isLocked) {
                this.rotateCamera(e.movementX, e.movementY);
            }
        });
    }

    setupStartButton() {
        const btnStart = document.getElementById('btn-start');
        btnStart.addEventListener('click', (e) => {
            e.stopPropagation();
            this.isStarted = true;
            this.updateMenuVisibility();
            
            if (!this.isTouch) {
                this.domElement.requestPointerLock();
            }
        });
    }

    updateMenuVisibility() {
        const menu = document.getElementById('menu');
        if (this.isStarted && (this.isLocked || this.isTouch)) {
            menu.style.display = 'none';
        } else {
            menu.style.display = 'flex';
        }
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
        
        // Startknappen hanteras nu av setupStartButton globalt

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
                
                // Höger tumme (Kamera rotation)
                if(touch.identifier === this.camTouchId) {
                    const dx = touch.clientX - this.camLastPos.x;
                    const dy = touch.clientY - this.camLastPos.y;
                    this.rotateCamera(dx * 2, dy * 2);
                    this.camLastPos = {x: touch.clientX, y: touch.clientY};
                }
            }
        }, {passive: false});
        
        // Lyssna på touch start på resten av skärmen för att titta runt
        this.domElement.addEventListener('touchstart', (e) => {
            for(let i=0; i<e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if(touch.clientX > window.innerWidth / 2) {
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
                    stick.style.transform = 'translate(0px, 0px)';
                    this.player.input.set(0, 0, 0);
                }
                if(touch.identifier === this.camTouchId) {
                    this.camTouchId = null;
                }
            }
        });
        
        // Knappar
        const btnJump = document.getElementById('btn-jump');
        btnJump.addEventListener('touchstart', (e) => { 
            e.preventDefault(); 
            this.isJumpHeld = true;
            this.player.jump(); 
        });
        btnJump.addEventListener('touchend', (e) => { 
            e.preventDefault(); 
            this.isJumpHeld = false;
        });

        const btnSuper = document.getElementById('btn-super-jump');
        btnSuper.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.player.superJump();
        });

        document.getElementById('btn-place').addEventListener('touchstart', (e) => { e.preventDefault(); window.dispatchEvent(new Event('touch_build')); });
        document.getElementById('btn-break').addEventListener('touchstart', (e) => { e.preventDefault(); window.dispatchEvent(new Event('touch_break')); });
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
        
        const stickEl = document.getElementById('joystick-stick');
        if (stickEl) {
            stickEl.style.transform = 'translate(' + tx + 'px, ' + ty + 'px)';
        }
        
        // Normaliserad input (-1 till 1)
        this.player.input.x = tx / maxDist;
        this.player.input.z = ty / maxDist;
    }
    
    update() {
        if(!this.isLocked && !this.isTouch) return;
        
        // Track jump button state for swimming
        const jumpKey = this.keys['Space'];
        this.player.input.y = (jumpKey || this.isJumpHeld) ? 1 : 0;

        if(!this.isTouch || !this.joystickActive) {
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
