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
    
    getIndex(x, y, z) { return x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT; }
    getBlock(x, y, z) {
        if(x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return BLOCKS.AIR;
        return this.data[this.getIndex(x, y, z)];
    }
    setBlock(x, y, z, type) {
        if(x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
        this.data[this.getIndex(x, y, z)] = type; this.buildMesh();
    }
    
    generateTerrain() {
        const worldXStart = this.chunkX * CHUNK_SIZE;
        const worldZStart = this.chunkZ * CHUNK_SIZE;

        const getBiomeInfo = (wx, wz) => {
            const v = noise2D(wx * 0.002, wz * 0.002);
            if (v < -0.4) return { type: 'DESERT', base: 8, var: 4 };
            if (v < -0.1) return { type: 'ISLANDS', base: 7, var: 8 };
            if (v < 0.2) return { type: 'PLAINS', base: 12, var: 4 };
            if (v < 0.5) return { type: 'FOREST', base: 11, var: 7 };
            return { type: 'MOUNTAINS', base: 10, var: 30 };
        };

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const worldX = worldXStart + x;
                const worldZ = worldZStart + z;
                const biome = getBiomeInfo(worldX, worldZ);
                
                const heightNoise = noise2D(worldX * 0.02, worldZ * 0.02);
                let height = Math.floor(((heightNoise + 1) / 2) * biome.var) + biome.base;
                
                // Mycket jämnare terräng i öken och fält
                if (biome.type === 'DESERT' || biome.type === 'PLAINS') {
                    height = Math.floor(biome.base + (heightNoise * 2));
                }

                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    const idx = this.getIndex(x, y, z);
                    const isCave = y < height - 2 && noise3D(worldX * 0.08, y * 0.08, worldZ * 0.08) > 0.45;
                    if (isCave) { this.data[idx] = BLOCKS.AIR; }
                    else if (y <= height) {
                        let type = BLOCKS.STONE;
                        if (y === height) {
                            if (biome.type === 'DESERT') type = BLOCKS.SAND;
                            else if (y < WATER_LEVEL + 1) type = BLOCKS.DIRT;
                            else type = BLOCKS.GRASS;
                        } else if (y >= height - 2) {
                            type = (biome.type === 'DESERT') ? BLOCKS.SAND : BLOCKS.DIRT;
                        }
                        this.data[idx] = type;
                    } else if (y <= WATER_LEVEL) {
                        this.data[idx] = BLOCKS.WATER;
                    }
                }
                
                // Vegetations-logik
                const surfaceY = height;
                if (surfaceY > WATER_LEVEL && this.getBlock(x, surfaceY, z) === BLOCKS.GRASS) {
                    const treeNoise = noise2D(worldX * 0.06, worldZ * 0.06);
                    const forestDensity = (biome.type === 'FOREST') ? 0.2 : (biome.type === 'MOUNTAINS' ? 0.03 : 0.01);
                    if (treeNoise > 0.2 && Math.random() < forestDensity) {
                        this.generateTree(x, surfaceY + 1, z);
                    }
                }
                
                if (Math.random() < 0.01 && noise2D(worldX * 0.1, worldZ * 0.1) > 0.8) {
                    this.data[this.getIndex(x, CLOUD_LEVEL, z)] = BLOCKS.CLOUD;
                }
            }
        }

        // Hus och Byar (Rare)
        const villageV = noise2D(this.chunkX * 0.05, this.chunkZ * 0.05);
        if (villageV > 0.75) {
            // I en by, placera hus oftaare på jämna ytor
            const numHouses = Math.floor(Math.random() * 3) + 2;
            for(let i=0; i<numHouses; i++) {
                const vx = 6 + Math.floor(Math.random() * 5);
                const vz = 6 + Math.floor(Math.random() * 5);
                const vy = this.getTopBlockY(vx, vz);
                // Bara bygg om på jämna ytor (dirt eller grass)
                const surfaceBlock = this.getBlock(vx, vy-1, vz);
                if (surfaceBlock === BLOCKS.DIRT || surfaceBlock === BLOCKS.GRASS) {
                    this.generateFineHouse(vx, vy, vz);
                }
            }
            // Bygrupper: skapa platser med flera hus och dekorationer
            if (villageV > 0.85) {
                const groupX = 30 + Math.floor(Math.random() * 40);
                const groupZ = 30 + Math.floor(Math.random() * 40);
                const groupHouses = 3 + Math.floor(Math.random() * 2);
                for(let g=0; g<groupHouses; g++) {
                    const hx = groupX + (g%2)*8;
                    const hz = groupZ + Math.floor(g/2)*8;
                    const hv = this.getTopBlockY(hx, hz);
                    const surfaceBlock = this.getBlock(hx, hv-1, hz);
                    if (surfaceBlock === BLOCKS.DIRT || surfaceBlock === BLOCKS.GRASS) {
                        this.generateFineHouse(hx, hv, hz);
                        // Lägg till blomsterdekorationer runt huset
                        this.placeVillageDecorations(hx, hv, hz);
                    }
                }
            }
            
            // Placera enskilda hus med dekorationer
            if (villageV > 0.75 && numHouses <= 2) {
                // Lägg till blomsterdekorationer runt enskilda hus
                const houseX = 6 + Math.floor(Math.random() * 5);
                const houseZ = 6 + Math.floor(Math.random() * 5);
                const houseY = this.getTopBlockY(houseX, houseZ);
                const surfaceBlock = this.getBlock(houseX, houseY-1, houseZ);
                if (surfaceBlock === BLOCKS.DIRT || surfaceBlock === BLOCKS.GRASS) {
                    this.placeVillageDecorations(houseX, houseY, houseZ);
                }
            }
        }
    }

    getTopBlockY(lx, lz) {
        for(let y = CHUNK_HEIGHT - 1; y > 0; y--) if (this.getBlock(lx, y, lz) !== BLOCKS.AIR) return y;
        return 0;
    }
    
    generateTree(x, y, z) {
        const trunkH = 4 + Math.floor(Math.random() * 2);
        for (let h = 0; h < trunkH; h++) {
            if (y+h < CHUNK_HEIGHT) this.data[this.getIndex(x, y+h, z)] = BLOCKS.WOOD;
        }
        for (let lx = -2; lx <= 2; lx++) {
            for (let lz = -2; lz <= 2; lz++) {
                for (let ly = trunkH - 2; ly <= trunkH + 1; ly++) {
                    const d = Math.sqrt(lx*lx + lz*lz + (ly-trunkH)*(ly-trunkH));
                    if (d < 2.5) {
                        const wx = x+lx, wy = y+ly, wz = z+lz;
                        if (wx >= 0 && wx < CHUNK_SIZE && wy >= 0 && wy < CHUNK_HEIGHT && wz >= 0 && wz < CHUNK_SIZE) {
                            if (this.getBlock(wx, wy, wz) === BLOCKS.AIR) this.data[this.getIndex(wx, wy, wz)] = BLOCKS.LEAVES;
                        }
                    }
                }
            }
        }
    }

    generateFineHouse(x, y, z) {
        const w = 7, h = 5, d = 7;
        // Bounds check
        if (x + w >= CHUNK_SIZE || z + d >= CHUNK_SIZE || y + h + 4 >= CHUNK_HEIGHT) return;
        
        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                for (let dz = 0; dz < d; dz++) {
                    const isFloor = dy === 0;
                    const isWall = dx === 0 || dx === w - 1 || dz === 0 || dz === d - 1;
                    const isCorner = (dx === 0 || dx === w-1) && (dz === 0 || dz === d-1);
                    const isDoor = (dx === Math.floor(w/2) && dz === 0 && dy < 3);
                    const isWindow = (dy === 2 && ((dx === 0 || dx === w-1) && dz === Math.floor(d/2) || (dz === d-1 && dx === 2 || dx === w-3)));
                    
                    const blockX = x + dx;
                    const blockY = y + dy;
                    const blockZ = z + dz;
                    
                    if (isFloor) this.data[this.getIndex(blockX, blockY, blockZ)] = BLOCKS.STONE;
                    else if (isCorner) this.data[this.getIndex(blockX, blockY, blockZ)] = BLOCKS.WOOD;
                    else if (isWall) {
                        if (isDoor) this.data[this.getIndex(blockX, blockY, blockZ)] = BLOCKS.AIR;
                        else if (isWindow) this.data[this.getIndex(blockX, blockY, blockZ)] = BLOCKS.GLASS;
                        else this.data[this.getIndex(blockX, blockY, blockZ)] = BLOCKS.PLANKS;
                    }
                }
            }
        }
        // Pitched Roof
        for (let ry = 0; ry < 4; ry++) {
            for (let rx = ry - 1; rx < w - ry + 1; rx++) {
                for (let rz = ry - 1; rz < d - ry + 1; rz++) {
                    const blockX = x + rx;
                    const blockY = y + h + ry;
                    const blockZ = z + rz;
                    if (blockX >= 0 && blockX < CHUNK_SIZE && blockY < CHUNK_HEIGHT && blockZ >= 0 && blockZ < CHUNK_SIZE) {
                        this.data[this.getIndex(blockX, blockY, blockZ)] = BLOCKS.WOOD;
                    }
                }
            }
        }
    }
    
    buildMesh() {
        for (const type in this.meshes) { this.scene.remove(this.meshes[type]); if (this.meshes[type].geometry) this.meshes[type].geometry.dispose(); }
        this.meshes = {};
        const counts = {}; for(let key in BLOCKS) counts[BLOCKS[key]] = 0;
        const instances = [];
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let y = 0; y < CHUNK_HEIGHT; y++) {
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    const block = this.data[this.getIndex(x, y, z)];
                    if (block !== BLOCKS.AIR) {
                        const isExposed = this.getBlock(x+1,y,z)===BLOCKS.AIR || this.getBlock(x-1,y,z)===BLOCKS.AIR || this.getBlock(x,y+1,z)===BLOCKS.AIR || this.getBlock(x,y-1,z)===BLOCKS.AIR || this.getBlock(x,y,z+1)===BLOCKS.AIR || this.getBlock(x,y,z-1)===BLOCKS.AIR || block===BLOCKS.WATER || block===BLOCKS.GLASS;
                        if(isExposed) { counts[block]++; instances.push({x, y, z, block}); }
                    }
                }
            }
        }
        const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0.5, 0.5, 0.5);
        const matrix = new THREE.Matrix4(); const offsets = {};
        const activeBlockTypes = Object.values(BLOCKS).filter(b => b !== BLOCKS.AIR);
        activeBlockTypes.forEach(bId => {
            if(counts[bId] > 0) {
                let matName = Object.keys(BLOCKS).find(k => BLOCKS[k] === bId).toLowerCase();
                let mat = materials[matName];
                const mesh = new THREE.InstancedMesh(boxGeo, mat, counts[bId]);
                mesh.castShadow = bId !== BLOCKS.WATER && bId !== BLOCKS.CLOUD && bId !== BLOCKS.GLASS;
                mesh.receiveShadow = bId !== BLOCKS.WATER && bId !== BLOCKS.GLASS;
                mesh.position.set(this.chunkX * CHUNK_SIZE, 0, this.chunkZ * CHUNK_SIZE);
                this.scene.add(mesh); this.meshes[bId] = mesh; offsets[bId] = 0;
            }
        });
        instances.forEach(inst => {
            matrix.setPosition(inst.x, inst.y, inst.z);
            if(this.meshes[inst.block]) { this.meshes[inst.block].setMatrixAt(offsets[inst.block], matrix); offsets[inst.block]++; }
        });
        for(let type in this.meshes) this.meshes[type].instanceMatrix.needsUpdate = true;
    }
    destroy() { for (const type in this.meshes) { this.scene.remove(this.meshes[type]); if (this.meshes[type].geometry) this.meshes[type].geometry.dispose(); } }
}

export class World {
    constructor(scene) { this.scene = scene; this.chunks = {}; }
    getChunkKey(cx, cz) { return cx + ',' + cz; }
    update(playerX, playerZ) {
        const pCx = Math.floor(playerX / CHUNK_SIZE); const pCz = Math.floor(playerZ / CHUNK_SIZE); 
        const renderDistance = 6; // Tidigare 3
        for (let x = -renderDistance; x <= renderDistance; x++) { for (let z = -renderDistance; z <= renderDistance; z++) {
            const cx = pCx+x, cz = pCz+z, key = this.getChunkKey(cx, cz);
            if (!this.chunks[key]) this.chunks[key] = new Chunk(this.scene, cx, cz);
        } }
        for(let key in this.chunks) {
            const chunk = this.chunks[key];
            if(Math.abs(chunk.chunkX - pCx) > renderDistance + 1 || Math.abs(chunk.chunkZ - pCz) > renderDistance + 1) { chunk.destroy(); delete this.chunks[key]; }
        }
    }
    getBlock(wx, wy, wz) {
        const cx = Math.floor(wx / CHUNK_SIZE), cz = Math.floor(wz / CHUNK_SIZE), key = this.getChunkKey(cx, cz);
        if(!this.chunks[key]) return BLOCKS.AIR;
        let lx = ((Math.floor(wx) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE, lz = ((Math.floor(wz) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return this.chunks[key].getBlock(lx, Math.floor(wy), lz);
    }
    setBlock(wx, wy, wz, type) {
        const cx = Math.floor(wx / CHUNK_SIZE), cz = Math.floor(wz / CHUNK_SIZE), key = this.getChunkKey(cx, cz);
        if(!this.chunks[key]) return;
        let lx = ((Math.floor(wx) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE, lz = ((Math.floor(wz) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        this.chunks[key].setBlock(lx, Math.floor(wy), lz, type);
    }
    getSurfaceHeight(wx, wz) {
        for(let y = CHUNK_HEIGHT - 1; y > 0; y--) { const block = this.getBlock(wx, y, wz); if(block !== BLOCKS.AIR && block !== BLOCKS.WATER && block !== BLOCKS.CLOUD) return y; }
        return 0;
    }
}
