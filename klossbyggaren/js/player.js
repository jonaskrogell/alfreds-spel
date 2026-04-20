import * as THREE from 'three';
import { BLOCKS } from './textures.js';

export class Player {
    constructor(camera, world) {
        this.camera = camera;
        this.world = world;
        
        // Fysik-variabler (AABB = Bounding Box)
        this.position = new THREE.Vector3(8, 20, 8); // Start lite högt
        this.velocity = new THREE.Vector3(0, 0, 0);
        
        this.height = 1.6;
        this.width = 0.6;
        this.depth = 0.6;
        
        this.onGround = false;
        this.speed = 5.0; // Gånghastighet
        this.jumpForce = 7.0;
        this.gravity = 20.0;
        
        // Indata
        this.input = new THREE.Vector3();
    }
    
    // Hanterar kollisioner med världen via AABBs
    // Enkel Swept AABB är för komplext, vi checkar de 8 hörnen + mittpunkter
    checkCollision(x, y, z) {
        const minX = Math.floor(x - this.width/2);
        const maxX = Math.floor(x + this.width/2);
        const minY = Math.floor(y);
        const maxY = Math.floor(y + this.height);
        const minZ = Math.floor(z - this.depth/2);
        const maxZ = Math.floor(z + this.depth/2);
        
        for (let bx = minX; bx <= maxX; bx++) {
            for (let by = minY; by <= maxY; by++) {
                for (let bz = minZ; bz <= maxZ; bz++) {
                    if (this.world.getBlock(bx, by, bz) !== BLOCKS.AIR) {
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
        }
    }
    
    update(dt) {
        // Applikera gravitation
        this.velocity.y -= this.gravity * dt;
        
        // Beräkna riktning baserat på kamerans vinkel (enbart horisontellt, Y = 0)
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();
        
        const right = new THREE.Vector3();
        right.crossVectors(forward, this.camera.up).normalize();
        
        // Målkraft för X/Z
        const desiredVelocity = new THREE.Vector3();
        desiredVelocity.addScaledVector(forward, -this.input.z * this.speed); // Minska input Z betyder gå framåt
        desiredVelocity.addScaledVector(right, this.input.x * this.speed);
        
        // Dela upp förflyttning per axel för att glida längs väggar
        // Testa X
        if(desiredVelocity.x !== 0) {
            const nextX = this.position.x + desiredVelocity.x * dt;
            if (!this.checkCollision(nextX, this.position.y, this.position.z)) {
                this.position.x = nextX;
            }
        }
        
        // Testa Z
        if(desiredVelocity.z !== 0) {
            const nextZ = this.position.z + desiredVelocity.z * dt;
            if (!this.checkCollision(this.position.x, this.position.y, nextZ)) {
                this.position.z = nextZ;
            }
        }
        
        // Testa Y (Gravitation / Hopp)
        this.onGround = false;
        if(this.velocity.y !== 0) {
            const nextY = this.position.y + this.velocity.y * dt;
            if (this.checkCollision(this.position.x, nextY, this.position.z)) {
                if(this.velocity.y < 0) {
                    this.onGround = true; // Landat!
                } else if(this.velocity.y > 0) {
                    // Slog i taket
                }
                this.velocity.y = 0; // Stanna Y
                
                // Måste flytta till exakt heltal så man inte svävar
                this.position.y = Math.round(this.position.y);
            } else {
                this.position.y = nextY;
            }
        }
        
        // Hindra att rymma ner i voiden (Safety net för barn)
        if(this.position.y < -10) {
            this.position.y = 20; // Teleport högt upp
            this.velocity.y = 0;
        }
        
        // Uppdatera kamerans position (ögonhöjd = position.y + 1.5)
        this.camera.position.set(this.position.x, this.position.y + 1.5, this.position.z);
    }
}
