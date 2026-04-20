import * as THREE from 'three';
import { BLOCKS, SOLID_BLOCKS } from './textures.js';

// Player class - handles movement, collision, jumping, flying
export class Player {
    constructor(camera, world, audio) {
        this.camera = camera;
        this.world = world;
        this.audio = audio;

        // Position & velocity
        this.position = new THREE.Vector3(16, 35, 16);
        this.velocity = new THREE.Vector3(0, 0, 0);

        // Collider
        this.height = 1.6;
        this.width = 0.6;

        // State flags
        this.onGround = false;
        this.inWater = false;
        this.isFlying = false;

        // Movement tuning
        this.speed = 5.0;
        this.waterSpeed = 2.5;
        this.flySpeed = 25.0; // 5x normal speed
        this.jumpForce = 9.0;
        this.gravity = 25.0;
        this.flyGravity = 0.0; // No gravity while flying - controlled vertical motion

        // Input vector (x: strafe, y: vertical intent, z: forward)
        this.input = new THREE.Vector3();
        this.stepTimer = 0;
    }

    // Axis-aligned box collision check
    checkCollision(x, y, z) {
        const hw = this.width / 2;
        const minX = Math.floor(x - hw);
        const maxX = Math.floor(x + hw);
        const minY = Math.floor(y);
        const maxY = Math.floor(y + this.height);
        const minZ = Math.floor(z - hw);
        const maxZ = Math.floor(z + hw);

        for (let bx = minX; bx <= maxX; bx++) {
            for (let by = minY; by <= maxY; by++) {
                for (let bz = minZ; bz <= maxZ; bz++) {
                    const block = this.world.getBlock(bx, by, bz);
                    if (SOLID_BLOCKS.has(block)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    jump() {
        if (this.isFlying) {
            this.velocity.y = this.flySpeed * 0.4; // hold space to fly up
            return;
        }
        if (this.onGround) {
            this.velocity.y = this.jumpForce;
            this.onGround = false;
            if (this.audio) this.audio.playJump();
        }
    }

    superJump() {
        if (this.isFlying) return;
        if (this.onGround || this.inWater) {
            this.velocity.y = this.jumpForce * 2.2;
            this.onGround = false;
            if (this.audio) {
                this.audio.playJump();
                setTimeout(() => this.audio && this.audio.playJump(), 100);
            }
        }
    }

    toggleFlying() {
        this.isFlying = !this.isFlying;
        if (this.isFlying) {
            // Cancel any downward velocity when entering fly mode
            this.velocity.y = 0;
        }
    }

    update(dt) {
        // Check water state
        const footBlock = this.world.getBlock(
            Math.floor(this.position.x),
            Math.floor(this.position.y + 0.1),
            Math.floor(this.position.z)
        );
        this.inWater = (footBlock === BLOCKS.WATER);

        // FLYING MODE: full 3-axis movement controlled by input
        if (this.isFlying) {
            const forward = new THREE.Vector3();
            this.camera.getWorldDirection(forward);
            forward.y = 0; forward.normalize();
            const right = new THREE.Vector3();
            right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

            const vx = (forward.x * (-this.input.z) + right.x * this.input.x) * this.flySpeed;
            const vz = (forward.z * (-this.input.z) + right.z * this.input.x) * this.flySpeed;
            // Vertical: use input.y (space = up)
            let vy = 0;
            if (this.input.y > 0) vy = this.flySpeed * 0.6; // up
            // Downward when shift is held is not currently bound - player can land by toggling off fly
            this.velocity.set(vx, vy, vz);

            // Apply motion with collision
            this.moveWithCollision(dt);
            return;
        }

        // Swimming: hold jump to rise in water
        if (this.inWater && this.input.y > 0) {
            this.velocity.y = 4.0;
        }

        // Gravity (reduced in water)
        const gForce = this.inWater ? this.gravity * 0.2 : this.gravity;
        this.velocity.y -= gForce * dt;

        // Terminal velocity in water
        if (this.inWater && this.velocity.y < -2) this.velocity.y = -2;

        // Compute forward/right from camera
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0; forward.normalize();
        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        const curSpeed = this.inWater ? this.waterSpeed : this.speed;
        this.velocity.x = (forward.x * (-this.input.z) + right.x * this.input.x) * curSpeed;
        this.velocity.z = (forward.z * (-this.input.z) + right.z * this.input.x) * curSpeed;

        // Footsteps sfx
        if (this.onGround && (Math.abs(this.velocity.x) > 0.01 || Math.abs(this.velocity.z) > 0.01)) {
            this.stepTimer += dt;
            if (this.stepTimer > 0.35) {
                if (this.audio) this.audio.playStep();
                this.stepTimer = 0;
            }
        }

        this.moveWithCollision(dt);

        // Fail-safe: if player falls too far, teleport up
        if (this.position.y < -10) {
            this.position.y = 40;
            this.velocity.y = 0;
        }
    }

    // Apply velocity with axis-separated collision
    moveWithCollision(dt) {
        // X axis
        const nextX = this.position.x + this.velocity.x * dt;
        if (!this.checkCollision(nextX, this.position.y, this.position.z)) {
            this.position.x = nextX;
        } else if (!this.isFlying) {
            this.velocity.x = 0;
        }

        // Z axis
        const nextZ = this.position.z + this.velocity.z * dt;
        if (!this.checkCollision(this.position.x, this.position.y, nextZ)) {
            this.position.z = nextZ;
        } else if (!this.isFlying) {
            this.velocity.z = 0;
        }

        // Y axis (with ground detection)
        this.onGround = false;
        const nextY = this.position.y + this.velocity.y * dt;
        if (this.checkCollision(this.position.x, nextY, this.position.z)) {
            if (this.velocity.y < 0) {
                this.onGround = true;
                this.position.y = Math.floor(this.position.y);
            }
            this.velocity.y = 0;
        } else {
            this.position.y = nextY;
        }
    }
}
