import * as THREE from 'three';
import { materials, BLOCKS } from './textures.js';
import { createNoise2D } from 'https://unpkg.com/simplex-noise@4.0.1/dist/esm/simplex-noise.js';

const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 32;

const noise2D = createNoise2D();

class Chunk {
    constructor(scene, chunkX, chunkZ) {
        this.scene = scene;
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        
        // 1D array för voxel data (x, y, z)
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
        this.buildMesh(); // Rebuild heela chunken
    }
    
    generateTerrain() {
        const worldXStart = this.chunkX * CHUNK_SIZE;
        const worldZStart = this.chunkZ * CHUNK_SIZE;
        
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; x < CHUNK_SIZE; z++) { // BUG Varning: loopen ska avslutas vid CHUNK_SIZE
                break; // Skriver om nedan
            }
        }

        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const worldX = worldXStart + x;
                const worldZ = worldZStart + z;
                
                // Generera höjd med Simplex Noise
                const noiseVal = noise2D(worldX * 0.03, worldZ * 0.03);
                // Mappa noise (-1 till 1) till höjd (ex. 5 till 15)
                const height = Math.floor(((noiseVal + 1) / 2) * 10) + 5;
                
                for (let y = 0; y <= height; y++) {
                    let type = BLOCKS.STONE;
                    if (y === height) {
                        type = BLOCKS.GRASS;
                        
                        // Generera lite träd, 2% risk per gräsblock
                        if(Math.random() < 0.02 && x > 2 && x < CHUNK_SIZE-2 && z > 2 && z < CHUNK_SIZE-2) {
                            if(y + 4 < CHUNK_HEIGHT) {
                                // Stam
                                this.data[this.getIndex(x, y+1, z)] = BLOCKS.WOOD;
                                this.data[this.getIndex(x, y+2, z)] = BLOCKS.WOOD;
                                this.data[this.getIndex(x, y+3, z)] = BLOCKS.WOOD;
                                // Lövverk kors
                                this.data[this.getIndex(x, y+4, z)] = BLOCKS.LEAVES;
                                this.data[this.getIndex(x+1, y+3, z)] = BLOCKS.LEAVES;
                                this.data[this.getIndex(x-1, y+3, z)] = BLOCKS.LEAVES;
                                this.data[this.getIndex(x, y+3, z+1)] = BLOCKS.LEAVES;
                                this.data[this.getIndex(x, y+3, z-1)] = BLOCKS.LEAVES;
                            }
                        }
                    } else if (y >= height - 2) {
                        type = BLOCKS.DIRT;
                    }
                    
                    // Skriv inte över träd om det redan skapats (if type == AIR etc, men nu bygger vi botten upp)
                    if(this.data[this.getIndex(x, y, z)] === BLOCKS.AIR) {
                        this.data[this.getIndex(x, y, z)] = type;
                    }
                }
            }
        }
    }
    
    buildMesh() {
        // Ta bort gamla meshes
        for (const type in this.meshes) {
            this.scene.remove(this.meshes[type]);
            this.meshes[type].dispose();
        }
        this.meshes = {};
        
        // Räkna instanser per material
        const counts = {};
        for(let key in BLOCKS) counts[BLOCKS[key]] = 0;
        
        const instances = [];
        
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let y = 0; y < CHUNK_HEIGHT; y++) {
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    const block = this.data[this.getIndex(x, y, z)];
                    if (block !== BLOCKS.AIR) {
                        // Optimering: rita bara om grannen är luft (enkel culling, kollar ej grann-chunks just nu)
                        const isExposed = 
                            this.getBlock(x+1, y, z) === BLOCKS.AIR ||
                            this.getBlock(x-1, y, z) === BLOCKS.AIR ||
                            this.getBlock(x, y+1, z) === BLOCKS.AIR ||
                            this.getBlock(x, y-1, z) === BLOCKS.AIR ||
                            this.getBlock(x, y, z+1) === BLOCKS.AIR ||
                            this.getBlock(x, y, z-1) === BLOCKS.AIR;
                            
                        if(isExposed) {
                            counts[block]++;
                            instances.push({x, y, z, block});
                        }
                    }
                }
            }
        }
        
        // Skapa InstancedMeshes
        const boxGeo = new THREE.BoxGeometry(1, 1, 1);
        const matrix = new THREE.Matrix4();
        
        const offsets = {};
        
        // Initiera Instanced meshes
        const activeBlockTypes = [BLOCKS.GRASS, BLOCKS.DIRT, BLOCKS.STONE, BLOCKS.WOOD, BLOCKS.LEAVES];
        activeBlockTypes.forEach(bId => {
            if(counts[bId] > 0) {
                let matName = Object.keys(BLOCKS).find(k => BLOCKS[k] === bId).toLowerCase();
                let mat = materials[matName];
                
                const mesh = new THREE.InstancedMesh(boxGeo, mat, counts[bId]);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                
                // Positionen för denna chunk
                mesh.position.set(this.chunkX * CHUNK_SIZE, 0, this.chunkZ * CHUNK_SIZE);
                
                this.scene.add(mesh);
                this.meshes[bId] = mesh;
                offsets[bId] = 0;
            }
        });
        
        // Applicera matriser
        instances.forEach(inst => {
            matrix.setPosition(inst.x, inst.y, inst.z);
            const mesh = this.meshes[inst.block];
            if(mesh) {
                mesh.setMatrixAt(offsets[inst.block], matrix);
                offsets[inst.block]++;
            }
        });
        
        // Uppdatera instanser
        for(let type in this.meshes) {
            this.meshes[type].instanceMatrix.needsUpdate = true;
        }
    }
    
    destroy() {
        for (const type in this.meshes) {
            this.scene.remove(this.meshes[type]);
            this.meshes[type].dispose();
        }
    }
}

export class World {
    constructor(scene) {
        this.scene = scene;
        this.chunks = {}; // "x,z" -> Chunk
    }
    
    getChunkKey(cx, cz) {
        return \`\${cx},\${cz}\`;
    }
    
    update(playerX, playerZ) {
        // Räkna ut vilken chunk spelaren står i
        const pCx = Math.floor(playerX / CHUNK_SIZE);
        const pCz = Math.floor(playerZ / CHUNK_SIZE);
        
        const renderDistance = 3; // 3 chunks åt varje håll (7x7 rutnät = 49 chunks)
        
        // Ladda in nya chunks
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
        
        // TODO: Ta bort chunks som är för långt bort för att spara minne (Memory Management)
        for(let key in this.chunks) {
            const chunk = this.chunks[key];
            if(Math.abs(chunk.chunkX - pCx) > renderDistance + 1 || 
               Math.abs(chunk.chunkZ - pCz) > renderDistance + 1) {
                chunk.destroy();
                delete this.chunks[key];
            }
        }
    }
    
    // Konvertera världs-koordinat till intern chunk/voxel-koordinat
    getBlock(wx, wy, wz) {
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cz = Math.floor(wz / CHUNK_SIZE);
        const key = this.getChunkKey(cx, cz);
        
        if(!this.chunks[key]) return BLOCKS.AIR;
        
        // Hantera modulos för negativa världen rätt
        let lx = wx % CHUNK_SIZE;
        if(lx < 0) lx += CHUNK_SIZE;
        let lz = wz % CHUNK_SIZE;
        if(lz < 0) lz += CHUNK_SIZE;
        
        return this.chunks[key].getBlock(lx, wy, lz);
    }
    
    setBlock(wx, wy, wz, type) {
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cz = Math.floor(wz / CHUNK_SIZE);
        const key = this.getChunkKey(cx, cz);
        
        if(!this.chunks[key]) return;
        
        let lx = wx % CHUNK_SIZE;
        if(lx < 0) lx += CHUNK_SIZE;
        let lz = wz % CHUNK_SIZE;
        if(lz < 0) lz += CHUNK_SIZE;
        
        this.chunks[key].setBlock(lx, wy, lz, type);
    }
}
