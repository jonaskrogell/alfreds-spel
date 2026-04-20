import * as THREE from 'three';
import { materials, BLOCKS } from './textures.js';
import { createNoise2D, createNoise3D } from 'https://unpkg.com/simplex-noise@4.0.1/dist/esm/simplex-noise.js';

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 48;
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

        // Biome-brus (Långsamt varierat)
        const getBiome = (wx, wz) => {
            const v = noise2D(wx * 0.005, wz * 0.005);
            if (v < -0.3) return 'ISLANDS';
            if (v < 0) return 'PLAINS';
            if (v < 0.4) return 'FOREST';
            return 'LAKES';
        };

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const worldX = worldXStart + x;
                const worldZ = worldZStart + z;
                
                const biome = getBiome(worldX, worldZ);
                
                // Grundterräng
                let heightNoise = noise2D(worldX * 0.02, worldZ * 0.02);
                let baseHeight = 12;
                let heightScale = 12;

                if (biome === 'ISLANDS') {
                    baseHeight = 6;
                    heightScale = 10;
                } else if (biome === 'PLAINS') {
                    baseHeight = 12;
                    heightScale = 5; // Flattare
                } else if (biome === 'LAKES') {
                    baseHeight = 8;
                    heightScale = 12;
                }

                let height = Math.floor(((heightNoise + 1) / 2) * heightScale) + baseHeight;
                
                // Raviner (Gör dem mindre extrema)
                const ravineNoise = Math.abs(noise2D(worldX * 0.015, worldZ * 0.015));
                if (ravineNoise < 0.03) {
                    height -= Math.floor((1 - (ravineNoise / 0.03)) * 6);
                }
                
                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    const idx = this.getIndex(x, y, z);
                    
                    const caveNoise = noise3D(worldX * 0.08, y * 0.08, worldZ * 0.08);
                    const isCave = y < height && caveNoise > 0.45;

                    if (isCave) {
                        this.data[idx] = BLOCKS.AIR;
                    } else if (y <= height) {
                        let type = BLOCKS.STONE;
                        if (y === height) {
                            type = (y < WATER_LEVEL + 1) ? BLOCKS.DIRT : BLOCKS.GRASS;
                        } else if (y >= height - 2) {
                            type = BLOCKS.DIRT;
                        }
                        this.data[idx] = type;
                    } else if (y <= WATER_LEVEL) {
                        this.data[idx] = BLOCKS.WATER;
                    }
                }
                
                // Moln
                if (noise2D(worldX * 0.05, worldZ * 0.05) > 0.5) {
                    this.data[this.getIndex(x, CLOUD_LEVEL + Math.floor(Math.random()*2), z)] = BLOCKS.CLOUD;
                }
                
                // Vegetations-logik
                const surfaceY = height;
                if (surfaceY > WATER_LEVEL && this.getBlock(x, surfaceY, z) === BLOCKS.GRASS) {
                    // Skogar (Grouped trees)
                    const treeNoise = noise2D(worldX * 0.05, worldZ * 0.05);
                    const isForestZone = biome === 'FOREST' ? treeNoise > 0 : treeNoise > 0.4;
                    
                    if (isForestZone && Math.random() < 0.12) {
                        this.generateTree(x, surfaceY + 1, z);
                    }
                }
            }
        }

        // Byar (Villages) - Sällsynta men placerade i grupp
        const villageNoise = noise2D(worldXStart * 0.01, worldZStart * 0.01);
        if (villageNoise > 0.7) {
            // Placera 1-2 stora hus per chunk i en "by-zon"
            for (let i = 0; i < 1; i++) {
                const vx = 4 + Math.floor(Math.random() * 8);
                const vz = 4 + Math.floor(Math.random() * 8);
                const vy = this.getTopBlockY(vx, vz);
                if (vy > WATER_LEVEL) {
                    this.generateBigHouse(vx, vy + 1, vz);
                }
            }
        }
    }

    getTopBlockY(lx, lz) {
        for(let y = CHUNK_HEIGHT - 1; y > 0; y--) {
            if (this.getBlock(lx, y, lz) !== BLOCKS.AIR) return y;
        }
        return 0;
    }
    
    generateTree(x, y, z) {
        if (y + 5 >= CHUNK_HEIGHT) return;
        const trunkHeight = 4 + Math.floor(Math.random() * 2);
        for (let h = 0; h < trunkHeight; h++) this.data[this.getIndex(x, y+h, z)] = BLOCKS.WOOD;
        for (let lx = -2; lx <= 2; lx++) {
            for (let lz = -2; lz <= 2; lz++) {
                for (let ly = trunkHeight - 2; ly <= trunkHeight; ly++) {
                    const dist = Math.sqrt(lx*lx + lz*lz + (ly-trunkHeight)*(ly-trunkHeight));
                    if (dist < 2.2 && this.getBlock(x+lx, y+ly, z+lz) === BLOCKS.AIR) {
                        this.data[this.getIndex(x+lx, y+ly, z+lz)] = BLOCKS.LEAVES;
                    }
                }
            }
        }
    }

    generateBigHouse(x, y, z) {
        // En 5x5x4 stuga man kan gå in i
        const w = 5, h = 4, d = 5;
        if (x + w >= CHUNK_SIZE || z + d >= CHUNK_SIZE || y + h >= CHUNK_HEIGHT) return;
        
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                for (let dz = 0; dz < d; dz++) {
                    const isFloor = dy === 0;
                    const isCeiling = dy === h - 1;
                    const isWall = dx === 0 || dx === w - 1 || dz === 0 || dz === d - 1;
                    const isDoor = (dx === 2 && dz === 0 && dy < 3);
                    const isWindow = ((dx === 0 || dx === w-1) && dz === 2 && dy === 1);

                    if ((isFloor || isCeiling || isWall) && !isDoor && !isWindow) {
                        this.data[this.getIndex(x + dx, y + dy, z + dz)] = BLOCKS.PLANKS;
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
                            block === BLOCKS.WATER;
                            
                        if(isExposed) {
                            counts[block]++;
                            instances.push({x, y, z, block});
                        }
                    }
                }
            }
        }
        
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        boxGeo.translate(0.5, 0.5, 0.5);
        
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
    
    getChunkKey(cx, cz) { return cx + ',' + cz; }
    
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
            if(Math.abs(chunk.chunkX - pCx) > renderDistance + 1 || Math.abs(chunk.chunkZ - pCz) > renderDistance + 1) {
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
            if(block !== BLOCKS.AIR && block !== BLOCKS.WATER && block !== BLOCKS.CLOUD) return y;
        }
        return 0;
    }
}
