import * as THREE from 'three';
import { BLOCKS } from './textures.js';

export class Player {
    constructor(camera, world, audio) {
        this.camera = camera;
        this.world = world;
        this.audio = audio;
        
        this.position = new THREE.Vector3(16, 35, 16);
        this.velocity = new THREE.Vector3(0, 0, 0);
        
        this.height = 1.6;
        this.width = 0.6;
        
        this.onGround = false;
        this.inWater = false;
        
        this.speed = 5.0;
        this.waterSpeed = 2.5;
        this.jumpForce = 9.0;
        this.gravity = 25.0;
        
        this.input = new THREE.Vector3();
        this.jumpPressed = false;
        this.stepTimer = 0;
    }
    
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
                    if (block !== BLOCKS.AIR && block !== BLOCKS.WATER && block !== BLOCKS.CLOUD) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    jump() {
        if (this.onGround) {
            this.velocity.y = this.jumpForce;
            this.onGround = false;
            if (this.audio) this.audio.playJump();
        }
    }
    
    update(dt) {
        // Kontrollera om vi är i vatten
        const footBlock = this.world.getBlock(this.position.x, this.position.y + 0.1, this.position.z);
        this.inWater = (footBlock === BLOCKS.WATER);

        // Simning: Håll in hopp för att stiga i vatten
        if (this.inWater && this.input.y > 0) {
            this.velocity.y = 4.0;
        }

        // Gravitation
        const currentGravity = this.inWater ? this.gravity * 0.2 : this.gravity;
        this.velocity.y -= currentGravity * dt;
        
        if (this.inWater && this.velocity.y < -2) this.velocity.y = -2;
        
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0; forward.normalize();
        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
        
        const currentSpeed = this.inWater ? this.waterSpeed : this.speed;
        const velocityX = (forward.x * (-this.input.z) + right.x * this.input.x) * currentSpeed;
        const velocityZ = (forward.z * (-this.input.z) + right.z * this.input.x) * currentSpeed;
        
        if (this.onGround && (velocityX !== 0 || velocityZ !== 0)) {
            this.stepTimer += dt;
            if (this.stepTimer > 0.35) {
                if (this.audio) this.audio.playStep(); 
                this.stepTimer = 0;
            }
        }
        
        if(velocityX !== 0) {
            const nextX = this.position.x + velocityX * dt;
            if (!this.checkCollision(nextX, this.position.y, this.position.z)) this.position.x = nextX;
        }
        if(velocityZ !== 0) {
            const nextZ = this.position.z + velocityZ * dt;
            if (!this.checkCollision(this.position.x, this.position.y, nextZ)) this.position.z = nextZ;
        }
        
        this.onGround = false;
        const nextY = this.position.y + this.velocity.y * dt;
        if (this.checkCollision(this.position.x, nextY, this.position.z)) {
            if(this.velocity.y < 0) {
                this.onGround = true;
                this.position.y = Math.floor(this.position.y);
            }
            this.velocity.y = 0;
        } else {
            this.position.y = nextY;
        }
        
        if(this.position.y < -10) { this.position.y = 40; this.velocity.y = 0; }
    }
}
