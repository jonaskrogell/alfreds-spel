import * as THREE from 'three';
import { materials, BLOCKS } from './textures.js';
import { createNoise2D, createNoise3D } from 'https://unpkg.com/simplex-noise@4.0.1/dist/esm/simplex-noise.js';

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 48; // Ökad höjd för mer variation
const WATER_LEVEL = 10;
const CLOUD_LEVEL = 40;

const noise2D = createNoise2D();
const noise3D = createNoise3D();

class Chunk {
    constructor(scene, chunkX, chunkZ) {
        this.scene = scene;
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        
        this.data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        this.meshes = {};
        
        this.generateTerrain();
        this.buildMesh();
    }
    
    getIndex(x, y, z) {
        return x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT;
    }
    
    getBlock(x, y, z) {
        if(x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return BLOCKS.AIR;
        return this.data[this.getIndex(x, y, z)];
    }
    
    setBlock(x, y, z, type) {
        if(x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
        this.data[this.getIndex(x, y, z)] = type;
        this.buildMesh();
    }
    
    generateTerrain() {
        const worldXStart = this.chunkX * CHUNK_SIZE;
        const worldZStart = this.chunkZ * CHUNK_SIZE;

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const worldX = worldXStart + x;
                const worldZ = worldZStart + z;
                
                // Grundterräng
                const noiseVal = noise2D(worldX * 0.02, worldZ * 0.02);
                let height = Math.floor(((noiseVal + 1) / 2) * 15) + 8;
                
                // Raviner (Smala djupa dalar)
                const ravineNoise = Math.abs(noise2D(worldX * 0.01, worldZ * 0.01));
                if (ravineNoise < 0.05) {
                    height -= Math.floor((1 - (ravineNoise / 0.05)) * 12);
                }
                
                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    const idx = this.getIndex(x, y, z);
                    
                    // Grottor (3D Noise)
                    const caveNoise = noise3D(worldX * 0.08, y * 0.08, worldZ * 0.08);
                    const isCave = y < height && caveNoise > 0.4;

                    if (isCave) {
                        this.data[idx] = BLOCKS.AIR;
                    } else if (y <= height) {
                        let type = BLOCKS.STONE;
                        if (y === height) {
                            if (y < WATER_LEVEL + 1) {
                                type = BLOCKS.DIRT; // Sandigt/jordigt under vatten
                            } else {
                                type = BLOCKS.GRASS;
                            }
                        } else if (y >= height - 2) {
                            type = BLOCKS.DIRT;
                        }
                        this.data[idx] = type;
                    } else if (y <= WATER_LEVEL) {
                        // Fyll med vatten upp till vattennivån
                        this.data[idx] = BLOCKS.WATER;
                    }
                }
                
                // Moln (Glesa)
                if (noise2D(worldX * 0.1, worldZ * 0.1) > 0.6) {
                    this.data[this.getIndex(x, CLOUD_LEVEL, z)] = BLOCKS.CLOUD;
                }
                
                // Träd och Hus (Endast på gräs)
                const surfaceY = height;
                if (surfaceY > WATER_LEVEL && this.getBlock(x, surfaceY, z) === BLOCKS.GRASS) {
                    const rand = Math.random();
                    if (rand < 0.015) { // Träd
                        this.generateTree(x, surfaceY + 1, z);
                    } else if (rand < 0.017) { // Litet Hus
                        this.generateHouse(x, surfaceY + 1, z);
                    }
                }
            }
        }
    }
    
    generateTree(x, y, z) {
        if (y + 4 >= CHUNK_HEIGHT) return;
        for (let h = 0; h < 4; h++) this.data[this.getIndex(x, y+h, z)] = BLOCKS.WOOD;
        // Lövverk
        for (let lx = -1; lx <= 1; lx++) {
            for (let lz = -1; lz <= 1; lz++) {
                for (let ly = 2; ly <= 4; ly++) {
                    if (this.getBlock(x+lx, y+ly, z+lz) === BLOCKS.AIR) {
                        this.data[this.getIndex(x+lx, y+ly, z+lz)] = BLOCKS.LEAVES;
                    }
                }
            }
        }
    }

    generateHouse(x, y, z) {
        if (x < 2 || x > CHUNK_SIZE - 4 || z < 2 || z > CHUNK_SIZE - 4 || y + 4 >= CHUNK_HEIGHT) return;
        const width = 3, height = 3, depth = 3;
        for (let h = 0; h < height; h++) {
            for (let dx = 0; dx < width; dx++) {
                for (let dz = 0; dz < depth; dz++) {
                    // Väggar och Tak
                    const isWall = dx === 0 || dx === width - 1 || dz === 0 || dz === depth - 1 || h === height - 1;
                    const isDoor = dx === 1 && dz === 0 && h < 2;
                    if (isWall && !isDoor) {
                        this.data[this.getIndex(x + dx, y + h, z + dz)] = BLOCKS.PLANKS;
                    }
                }
            }
        }
    }
    
    buildMesh() {
        for (const type in this.meshes) {
            this.scene.remove(this.meshes[type]);
            if (this.meshes[type].geometry) this.meshes[type].geometry.dispose();
        }
        this.meshes = {};
        
        const counts = {};
        for(let key in BLOCKS) counts[BLOCKS[key]] = 0;
        
        const instances = [];
        
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let y = 0; y < CHUNK_HEIGHT; y++) {
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    const block = this.data[this.getIndex(x, y, z)];
                    if (block !== BLOCKS.AIR) {
                        const isExposed = 
                            this.getBlock(x+1, y, z) === BLOCKS.AIR || this.getBlock(x-1, y, z) === BLOCKS.AIR ||
                            this.getBlock(x, y+1, z) === BLOCKS.AIR || this.getBlock(x, y-1, z) === BLOCKS.AIR ||
                            this.getBlock(x, y, z+1) === BLOCKS.AIR || this.getBlock(x, y, z-1) === BLOCKS.AIR ||
                            block === BLOCKS.WATER; // Vatten renderas alltid (enkelt)
                            
                        if(isExposed) {
                            counts[block]++;
                            instances.push({x, y, z, block});
                        }
                    }
                }
            }
        }
        
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        boxGeo.translate(0.5, 0.5, 0.5); // Fixar alignment mot Math.floor
        
        const matrix = new THREE.Matrix4();
        const offsets = {};
        
        const activeBlockTypes = Object.values(BLOCKS).filter(b => b !== BLOCKS.AIR);
        activeBlockTypes.forEach(bId => {
            if(counts[bId] > 0) {
                let matName = Object.keys(BLOCKS).find(k => BLOCKS[k] === bId).toLowerCase();
                let mat = materials[matName];
                
                const mesh = new THREE.InstancedMesh(boxGeo, mat, counts[bId]);
                mesh.castShadow = bId !== BLOCKS.WATER && bId !== BLOCKS.CLOUD;
                mesh.receiveShadow = bId !== BLOCKS.WATER;
                mesh.position.set(this.chunkX * CHUNK_SIZE, 0, this.chunkZ * CHUNK_SIZE);
                
                this.scene.add(mesh);
                this.meshes[bId] = mesh;
                offsets[bId] = 0;
            }
        });
        
        instances.forEach(inst => {
            matrix.setPosition(inst.x, inst.y, inst.z);
            const mesh = this.meshes[inst.block];
            if(mesh) {
                mesh.setMatrixAt(offsets[inst.block], matrix);
                offsets[inst.block]++;
            }
        });
        
        for(let type in this.meshes) {
            this.meshes[type].instanceMatrix.needsUpdate = true;
        }
    }
    
    destroy() {
        for (const type in this.meshes) {
            this.scene.remove(this.meshes[type]);
            if (this.meshes[type].geometry) this.meshes[type].geometry.dispose();
        }
    }
}

export class World {
    constructor(scene) {
        this.scene = scene;
        this.chunks = {};
    }
    
    getChunkKey(cx, cz) {
        return cx + ',' + cz;
    }
    
    update(playerX, playerZ) {
        const pCx = Math.floor(playerX / CHUNK_SIZE);
        const pCz = Math.floor(playerZ / CHUNK_SIZE);
        const renderDistance = 3;
        
        for (let x = -renderDistance; x <= renderDistance; x++) {
            for (let z = -renderDistance; z <= renderDistance; z++) {
                const cx = pCx + x;
                const cz = pCz + z;
                const key = this.getChunkKey(cx, cz);
                if (!this.chunks[key]) {
                    this.chunks[key] = new Chunk(this.scene, cx, cz);
                }
            }
        }
        
        for(let key in this.chunks) {
            const chunk = this.chunks[key];
            if(Math.abs(chunk.chunkX - pCx) > renderDistance + 1 || 
               Math.abs(chunk.chunkZ - pCz) > renderDistance + 1) {
                chunk.destroy();
                delete this.chunks[key];
            }
        }
    }
    
    getBlock(wx, wy, wz) {
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cz = Math.floor(wz / CHUNK_SIZE);
        const key = this.getChunkKey(cx, cz);
        if(!this.chunks[key]) return BLOCKS.AIR;
        let lx = ((Math.floor(wx) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        let lz = ((Math.floor(wz) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return this.chunks[key].getBlock(lx, Math.floor(wy), lz);
    }
    
    setBlock(wx, wy, wz, type) {
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cz = Math.floor(wz / CHUNK_SIZE);
        const key = this.getChunkKey(cx, cz);
        if(!this.chunks[key]) return;
        let lx = ((Math.floor(wx) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        let lz = ((Math.floor(wz) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        this.chunks[key].setBlock(lx, Math.floor(wy), lz, type);
    }

    getSurfaceHeight(wx, wz) {
        for(let y = CHUNK_HEIGHT - 1; y > 0; y--) {
            const block = this.getBlock(wx, y, wz);
            if(block !== BLOCKS.AIR && block !== BLOCKS.WATER && block !== BLOCKS.CLOUD) {
                return y;
            }
        }
        return 0;
    }
}
