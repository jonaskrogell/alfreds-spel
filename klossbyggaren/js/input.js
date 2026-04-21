import * as THREE from 'three';

// InputManager - handles keyboard, mouse and touch input
export class InputManager {
    constructor(camera, domElement, player) {
        this.camera = camera;
        this.domElement = domElement;
        this.player = player;

        // State
        this.keys = {};
        this.isLocked = false;
        this.isStarted = false;
        this.isLooking = false;

        // Touch state
        this.isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
        this.joystickActive = false;
        this.joystickId = null;
        this.joystickCenter = { x: 0, y: 0 };
        this.camTouchId = null;
        this.camLastPos = { x: 0, y: 0 };
        this.isJumpHeld = false;

        // Camera rotation rig (pitch + yaw)
        this.yaw = new THREE.Object3D();
        this.pitch = new THREE.Object3D();
        this.yaw.add(this.pitch);
        this.pitch.add(this.camera);

        this.setupKeyboard();
        this.setupMouse();
        this.setupStartButton();

        if (this.isTouch) {
            this.setupTouch();
            const touchUI = document.getElementById('touch-ui');
            if (touchUI) touchUI.style.display = 'block';
        }
    }

    addToScene(scene) { scene.add(this.yaw); }

    updatePlayerPosition(pos) { this.yaw.position.set(pos.x, pos.y + 1.5, pos.z); }

    setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;

            if (e.code === 'Space') {
                e.preventDefault();
                this.player.jump();
            }

            // Inventory hotkeys 1-7
            if (e.code.startsWith('Digit')) {
                const n = parseInt(e.code.replace('Digit', ''));
                if (n >= 1 && n <= 9) {
                    const slots = document.querySelectorAll('.slot');
                    const idx = n - 1;
                    if (slots[idx]) {
                        slots.forEach(s => s.classList.remove('active'));
                        slots[idx].classList.add('active');
                        window.dispatchEvent(new CustomEvent('block_select', { detail: parseInt(slots[idx].dataset.type) }));
                    }
                }
            }

            // Super jump
            if (e.code === 'KeyE') {
                this.player.superJump();
            }

            // Flying toggle (admin/debug)
            if (e.code === 'KeyX') {
                this.player.toggleFlying();
                const ind = document.getElementById('fly-indicator');
                if (ind) ind.style.display = this.player.isFlying ? 'block' : 'none';
            }
        });

        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
        });
    }

    setupMouse() {
        this.domElement.addEventListener('click', () => {
            if (!this.isTouch && this.isStarted && !this.isLocked) {
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
        if (btnStart) {
            btnStart.addEventListener('click', (e) => {
                e.stopPropagation();
                this.isStarted = true;
                // Force hide immediately
                const menu = document.getElementById('menu');
                if (menu) menu.style.display = 'none';
                
                if (!this.isTouch) this.domElement.requestPointerLock();
            });
        }
    }

    updateMenuVisibility() {
        const menu = document.getElementById('menu');
        if (!menu) return;
        
        // At start, hide menu immediately if started
        // If we want to pause, we rely on the pointerlockchange event
        if (this.isStarted && (this.isLocked || this.isTouch)) {
            menu.style.display = 'none';
        } else if (!this.isStarted) {
            menu.style.display = 'flex';
        } else if (this.isStarted && !this.isLocked && !this.isTouch) {
            // This is the "Paused" state
            menu.style.display = 'flex';
            const btnStart = document.getElementById('btn-start');
            if (btnStart) btnStart.textContent = 'Fortsätt';
        }
    }

    rotateCamera(movementX, movementY) {
        const sensitivity = 0.002;
        this.yaw.rotation.y -= movementX * sensitivity;
        this.pitch.rotation.x -= movementY * sensitivity;
        const PI_2 = Math.PI / 2;
        this.pitch.rotation.x = Math.max(-PI_2, Math.min(PI_2, this.pitch.rotation.x));
    }

    setupTouch() {
        const zone = document.getElementById('joystick-zone');
        if (!zone) return;
        const stick = document.createElement('div');
        stick.id = 'joystick-stick';
        zone.appendChild(stick);

        zone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.changedTouches[0];
            this.joystickId = touch.identifier;
            this.joystickActive = true;
            const rect = zone.getBoundingClientRect();
            this.joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
            this.updateJoystick(touch.clientX, touch.clientY);
        }, { passive: false });

        window.addEventListener('touchmove', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === this.joystickId && this.joystickActive) {
                    this.updateJoystick(touch.clientX, touch.clientY);
                }
                if (touch.identifier === this.camTouchId) {
                    const dx = touch.clientX - this.camLastPos.x;
                    const dy = touch.clientY - this.camLastPos.y;
                    this.rotateCamera(dx * 2, dy * 2);
                    this.camLastPos = { x: touch.clientX, y: touch.clientY };
                }
            }
        }, { passive: false });

        this.domElement.addEventListener('touchstart', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.clientX > window.innerWidth / 2 && this.camTouchId === null) {
                    this.camTouchId = touch.identifier;
                    this.camLastPos = { x: touch.clientX, y: touch.clientY };
                }
            }
        }, { passive: true });

        window.addEventListener('touchend', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === this.joystickId) {
                    this.joystickActive = false;
                    this.joystickId = null;
                    stick.style.transform = 'translate(0px, 0px)';
                    this.player.input.set(0, 0, 0);
                }
                if (touch.identifier === this.camTouchId) {
                    this.camTouchId = null;
                }
            }
        });

        const btnJump = document.getElementById('btn-jump');
        if (btnJump) {
            btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); this.isJumpHeld = true; this.player.jump(); });
            btnJump.addEventListener('touchend', (e) => { e.preventDefault(); this.isJumpHeld = false; });
        }

        const btnSuper = document.getElementById('btn-super-jump');
        if (btnSuper) btnSuper.addEventListener('touchstart', (e) => { e.preventDefault(); this.player.superJump(); });

        const btnPlace = document.getElementById('btn-place');
        if (btnPlace) btnPlace.addEventListener('touchstart', (e) => { e.preventDefault(); window.dispatchEvent(new Event('touch_build')); });

        const btnBreak = document.getElementById('btn-break');
        if (btnBreak) btnBreak.addEventListener('touchstart', (e) => { e.preventDefault(); window.dispatchEvent(new Event('touch_break')); });

        this.setupTapToInteract();
    }

    setupTapToInteract() {
        let tapStartTime = 0;
        let tapStartPos = { x: 0, y: 0 };
        let tapTouchId = null;

        this.domElement.addEventListener('touchstart', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.clientX <= window.innerWidth / 2) continue;
                if (this.camTouchId !== null && touch.identifier !== this.camTouchId) continue;
                tapStartTime = Date.now();
                tapStartPos = { x: touch.clientX, y: touch.clientY };
                tapTouchId = touch.identifier;
            }
        }, { passive: true });

        this.domElement.addEventListener('touchmove', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier !== tapTouchId) continue;
                const dx = touch.clientX - tapStartPos.x;
                const dy = touch.clientY - tapStartPos.y;
                if (Math.sqrt(dx * dx + dy * dy) > 15) {
                    tapTouchId = null;
                }
            }
        }, { passive: true });

        this.domElement.addEventListener('touchend', (e) => {
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier !== tapTouchId) continue;
                const elapsed = Date.now() - tapStartTime;
                if (elapsed < 300) {
                    window.dispatchEvent(new Event('touch_build'));
                }
                tapTouchId = null;
            }
        }, { passive: true });

        this.domElement.addEventListener('touchcancel', () => {
            tapTouchId = null;
        }, { passive: true });
    }
    updateJoystick(x, y) {
        const dx = x - this.joystickCenter.x;
        const dy = y - this.joystickCenter.y;
        const maxDist = 50;
        const dist = Math.sqrt(dx*dx + dy*dy);
        let tx = dx, ty = dy;
        if (dist > maxDist) {
            tx = (dx / dist) * maxDist;
            ty = (dy / dist) * maxDist;
        }
        const stickEl = document.getElementById('joystick-stick');
        if (stickEl) stickEl.style.transform = 'translate(' + tx + 'px, ' + ty + 'px)';
        this.player.input.x = tx / maxDist;
        this.player.input.z = ty / maxDist;
    }

    update() {
        if (!this.isLocked && !this.isTouch) return;

        // Track if mouse is actively moving (looking)
        this.isLooking = this.isLocked || this.joystickActive;

        // Track jump button (space) for vertical input (swim/fly up)
        const jumpKey = this.keys['Space'];
        this.player.input.y = (jumpKey || this.isJumpHeld) ? 1 : 0;

        if (!this.isTouch || !this.joystickActive) {
            let x = 0, z = 0;
            if (this.keys['KeyW']) z -= 1;
            if (this.keys['KeyS']) z += 1;
            if (this.keys['KeyA']) x -= 1;
            if (this.keys['KeyD']) x += 1;
            if (x !== 0 && z !== 0) {
                const len = Math.sqrt(x*x + z*z);
                x /= len;
                z /= len;
            }
            this.player.input.set(x, this.player.input.y, z);
        }
    }
}
