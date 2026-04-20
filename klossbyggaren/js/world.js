import * as THREE from 'three';
import { materials, BLOCKS, BLOCK_MATERIAL } from './textures.js';
import { createNoise2D, createNoise3D } from 'https://unpkg.com/simplex-noise@4.0.1/dist/esm/simplex-noise.js';

// ============================================================
// World constants
// ============================================================
const CHUNK_SIZE = 16;
const CHUNK_HEIGHT = 48;
const WATER_LEVEL = 10;
const CLOUD_LEVEL = 40;

// Biome type constants (used for deterministic biome placement)
const BIOMES = {
    OCEAN: 'OCEAN',
    BEACH: 'BEACH',
    DESERT: 'DESERT',
    PLAINS: 'PLAINS',
    FOREST: 'FOREST',
    HILLS: 'HILLS',
    MOUNTAINS: 'MOUNTAINS'
};

// Shared noise generators (one per World instance below)
let noise2D, noise3D;

// Shared geometry for instanced meshes (avoids GPU memory leak)
const sharedBoxGeo = new THREE.BoxGeometry(1, 1, 1);
sharedBoxGeo.translate(0.5, 0.5, 0.5);

// ============================================================
// Chunk class - represents a CHUNK_SIZE x CHUNK_HEIGHT x CHUNK_SIZE piece of world
// ============================================================
class Chunk {
    constructor(scene, chunkX, chunkZ, world) {
        this.scene = scene;
        this.chunkX = chunkX;
        this.chunkZ = chunkZ;
        this.world = world; // reference to parent world for cross-chunk queries
        this.data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        this.meshes = {};
        this.dirty = true;
        this.generateTerrain();
        this.buildMesh();
    }

    getIndex(x, y, z) {
        return x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_HEIGHT;
    }

    getBlock(x, y, z) {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return BLOCKS.AIR;
        return this.data[this.getIndex(x, y, z)];
    }

    setBlock(x, y, z, type) {
        if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) return;
        this.data[this.getIndex(x, y, z)] = type;
        this.dirty = true;
        this.buildMesh();
    }

    // Return top non-air block Y within this chunk
    getTopBlockY(lx, lz) {
        for (let y = CHUNK_HEIGHT - 1; y > 0; y--) {
            if (this.getBlock(lx, y, lz) !== BLOCKS.AIR) return y;
        }
        return 0;
    }

    // Deterministic biome at world coords - smooth transitions
    getBiomeInfo(wx, wz) {
        const v = noise2D(wx * 0.002, wz * 0.002);
        // Lower, gentler terrain overall for better playability
        if (v < -0.45) return { type: BIOMES.OCEAN, base: 4, var: 2 };
        if (v < -0.3)  return { type: BIOMES.BEACH, base: 9, var: 2 };
        if (v < -0.1)  return { type: BIOMES.DESERT, base: 11, var: 2 };
        if (v < 0.15)  return { type: BIOMES.PLAINS, base: 12, var: 2 };
        if (v < 0.4)   return { type: BIOMES.FOREST, base: 12, var: 3 };
        if (v < 0.65)  return { type: BIOMES.HILLS, base: 13, var: 5 };
        return { type: BIOMES.MOUNTAINS, base: 14, var: 10 };
    }

    generateTerrain() {
        const worldXStart = this.chunkX * CHUNK_SIZE;
        const worldZStart = this.chunkZ * CHUNK_SIZE;

        // Pass 1: terrain blocks + trees + surface flowers
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const worldX = worldXStart + x;
                const worldZ = worldZStart + z;
                const biome = this.getBiomeInfo(worldX, worldZ);

                const heightNoise = noise2D(worldX * 0.02, worldZ * 0.02);
                let height = Math.floor(((heightNoise + 1) / 2) * biome.var) + biome.base;

                // Flatten certain biomes for easier building and exploration
                if (biome.type === BIOMES.DESERT || biome.type === BIOMES.PLAINS || biome.type === BIOMES.BEACH) {
                    height = biome.base + Math.floor(heightNoise * 1.5);
                }

                for (let y = 0; y < CHUNK_HEIGHT; y++) {
                    const idx = this.getIndex(x, y, z);
                    // Caves much reduced
                    const isCave = y < height - 3 && y > 2 && noise3D(worldX * 0.08, y * 0.08, worldZ * 0.08) > 0.55;
                    if (isCave) {
                        this.data[idx] = BLOCKS.AIR;
                    } else if (y <= height) {
                        let type = BLOCKS.STONE;
                        if (y === height) {
                            // Surface block depends on biome
                            if (biome.type === BIOMES.DESERT) type = BLOCKS.SAND;
                            else if (biome.type === BIOMES.BEACH) type = BLOCKS.SAND;
                            else if (biome.type === BIOMES.OCEAN) type = BLOCKS.SAND;
                            else if (y <= WATER_LEVEL) type = BLOCKS.SAND; // underwater = sand
                            else type = BLOCKS.GRASS;
                        } else if (y >= height - 2) {
                            type = (biome.type === BIOMES.DESERT || biome.type === BIOMES.BEACH) ? BLOCKS.SAND : BLOCKS.DIRT;
                        }
                        this.data[idx] = type;
                    } else if (y <= WATER_LEVEL) {
                        // Water fills above ground up to WATER_LEVEL
                        this.data[idx] = BLOCKS.WATER;
                    }
                }

                // Trees on grass surfaces above water level
                const surfaceY = height;
                if (surfaceY > WATER_LEVEL && this.getBlock(x, surfaceY, z) === BLOCKS.GRASS) {
                    const treeNoise = noise2D(worldX * 0.06, worldZ * 0.06);
                    let forestDensity = 0.01;
                    if (biome.type === BIOMES.FOREST) forestDensity = 0.12;
                    else if (biome.type === BIOMES.HILLS) forestDensity = 0.04;
                    else if (biome.type === BIOMES.MOUNTAINS) forestDensity = 0.02;
                    if (treeNoise > 0.2 && Math.random() < forestDensity) {
                        this.generateTree(x, surfaceY + 1, z);
                    }
                    // Flowers on plains/forest/hills
                    else if (biome.type === BIOMES.PLAINS && Math.random() < 0.04) {
                        const flowerType = Math.random() < 0.5 ? BLOCKS.FLOWER_RED : BLOCKS.FLOWER_YELLOW;
                        if (surfaceY + 1 < CHUNK_HEIGHT) this.data[this.getIndex(x, surfaceY + 1, z)] = flowerType;
                    }
                }

                // Clouds (decorative)
                if (Math.random() < 0.006 && noise2D(worldX * 0.1, worldZ * 0.1) > 0.75) {
                    // Create cloud clusters for bigger clouds
                    this.generateCloud(x, CLOUD_LEVEL, z);
                }
            }
        }

        // Pass 2: villages (only on sufficiently flat plains/forest ground)
        this.tryGenerateVillage();

        // Pass 3: major highways - connect biomes across this chunk
        this.tryGenerateHighway();
    }

    // Generate a large cloud cluster (makes clouds feel bigger / fluffier)
    generateCloud(cx, cy, cz) {
        const radius = 2 + Math.floor(Math.random() * 2);
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                if (Math.sqrt(dx*dx + dz*dz) <= radius) {
                    const px = cx + dx, pz = cz + dz;
                    if (px >= 0 && px < CHUNK_SIZE && pz >= 0 && pz < CHUNK_SIZE && cy < CHUNK_HEIGHT) {
                        if (this.getBlock(px, cy, pz) === BLOCKS.AIR) {
                            this.data[this.getIndex(px, cy, pz)] = BLOCKS.CLOUD;
                        }
                        // Second layer for fluffy appearance
                        if (Math.random() < 0.4 && cy + 1 < CHUNK_HEIGHT) {
                            if (this.getBlock(px, cy+1, pz) === BLOCKS.AIR) {
                                this.data[this.getIndex(px, cy+1, pz)] = BLOCKS.CLOUD;
                            }
                        }
                    }
                }
            }
        }
    }

    generateTree(x, y, z) {
        const trunkH = 4 + Math.floor(Math.random() * 2);
        for (let h = 0; h < trunkH; h++) {
            if (y + h < CHUNK_HEIGHT) this.data[this.getIndex(x, y + h, z)] = BLOCKS.WOOD;
        }
        for (let lx = -2; lx <= 2; lx++) {
            for (let lz = -2; lz <= 2; lz++) {
                for (let ly = trunkH - 2; ly <= trunkH + 1; ly++) {
                    const d = Math.sqrt(lx*lx + lz*lz + (ly-trunkH)*(ly-trunkH));
                    if (d < 2.5) {
                        const wx = x + lx, wy = y + ly, wz = z + lz;
                        if (wx >= 0 && wx < CHUNK_SIZE && wy >= 0 && wy < CHUNK_HEIGHT && wz >= 0 && wz < CHUNK_SIZE) {
                            if (this.getBlock(wx, wy, wz) === BLOCKS.AIR) {
                                this.data[this.getIndex(wx, wy, wz)] = BLOCKS.LEAVES;
                            }
                        }
                    }
                }
            }
        }
    }

    // Check if an area is flat enough for a house (returns true if flat)
    isAreaFlat(startX, startZ, sizeX, sizeZ) {
        if (startX < 0 || startZ < 0 || startX + sizeX >= CHUNK_SIZE || startZ + sizeZ >= CHUNK_SIZE) return false;
        const baseY = this.getTopBlockY(startX, startZ);
        if (baseY <= WATER_LEVEL) return false;
        for (let dx = 0; dx < sizeX; dx++) {
            for (let dz = 0; dz < sizeZ; dz++) {
                const y = this.getTopBlockY(startX + dx, startZ + dz);
                if (y !== baseY) return false;
                const surface = this.getBlock(startX + dx, y, startZ + dz);
                if (surface !== BLOCKS.GRASS && surface !== BLOCKS.DIRT) return false;
            }
        }
        return true;
    }

    // Flatten an area to a given height (fills with dirt below, grass on top)
    flattenArea(startX, startZ, sizeX, sizeZ, targetY) {
        for (let dx = 0; dx < sizeX; dx++) {
            for (let dz = 0; dz < sizeZ; dz++) {
                const x = startX + dx, z = startZ + dz;
                if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) continue;
                // Clear blocks above targetY
                for (let y = targetY + 1; y < CHUNK_HEIGHT; y++) {
                    this.data[this.getIndex(x, y, z)] = BLOCKS.AIR;
                }
                // Fill up to targetY with dirt, grass on top
                for (let y = 0; y <= targetY; y++) {
                    if (this.getBlock(x, y, z) === BLOCKS.AIR || this.getBlock(x, y, z) === BLOCKS.WATER) {
                        this.data[this.getIndex(x, y, z)] = (y === targetY) ? BLOCKS.GRASS : BLOCKS.DIRT;
                    }
                }
                // Ensure surface is grass
                this.data[this.getIndex(x, targetY, z)] = BLOCKS.GRASS;
            }
        }
    }

    // Try to generate a village in this chunk if conditions are right
    tryGenerateVillage() {
        const villageV = noise2D(this.chunkX * 0.05, this.chunkZ * 0.05);
        if (villageV <= 0.7) return;

        const houseSize = 7;
        const padding = 2;
        const houses = [];
        // Grid-based placement to avoid overlap
        const gridCells = 2; // 2x2 grid per chunk max
        const cellSize = Math.floor((CHUNK_SIZE - padding * 2) / gridCells);
        for (let gx = 0; gx < gridCells; gx++) {
            for (let gz = 0; gz < gridCells; gz++) {
                if (Math.random() > 0.6) continue;
                const cellStartX = padding + gx * cellSize;
                const cellStartZ = padding + gz * cellSize;
                const hx = cellStartX + Math.floor((cellSize - houseSize) / 2);
                const hz = cellStartZ + Math.floor((cellSize - houseSize) / 2);
                if (hx + houseSize >= CHUNK_SIZE - 1 || hz + houseSize >= CHUNK_SIZE - 1) continue;

                // Find base height at center of house
                const centerX = hx + Math.floor(houseSize / 2);
                const centerZ = hz + Math.floor(houseSize / 2);
                const baseY = this.getTopBlockY(centerX, centerZ);
                if (baseY <= WATER_LEVEL + 1) continue;

                const surfaceBlock = this.getBlock(centerX, baseY, centerZ);
                if (surfaceBlock !== BLOCKS.GRASS && surfaceBlock !== BLOCKS.DIRT) continue;

                // ALWAYS flatten area first - guarantees house is on flat terrain
                this.flattenArea(hx - 1, hz - 1, houseSize + 2, houseSize + 2, baseY);

                // Generate house on flat ground
                this.generateFineHouse(hx, baseY + 1, hz);
                houses.push({ x: hx + Math.floor(houseSize / 2), z: hz + Math.floor(houseSize / 2), y: baseY });
            }
        }

        // Connect houses with gravel paths
        if (houses.length >= 2) {
            for (let i = 0; i < houses.length - 1; i++) {
                this.createPath(houses[i], houses[i + 1], BLOCKS.GRAVEL);
            }
            // Decorate village center with flowers
            this.addFlowerBeds(houses);
        }
    }

    // Create a simple L-shaped path between two points using a block type
    createPath(p1, p2, blockType) {
        const midX = Math.floor((p1.x + p2.x) / 2);
        // Stretch along X at p1.z
        for (let x = Math.min(p1.x, midX); x <= Math.max(p1.x, midX); x++) {
            this.paintSurface(x, p1.z, blockType);
        }
        // Stretch along Z at midX
        for (let z = Math.min(p1.z, p2.z); z <= Math.max(p1.z, p2.z); z++) {
            this.paintSurface(midX, z, blockType);
        }
        // Final stretch along X at p2.z
        for (let x = Math.min(midX, p2.x); x <= Math.max(midX, p2.x); x++) {
            this.paintSurface(x, p2.z, blockType);
        }
    }

    // Replace the top surface block at (x,z) with the given block type
    paintSurface(x, z, blockType) {
        if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) return;
        const y = this.getTopBlockY(x, z);
        if (y <= WATER_LEVEL) return; // don't paint underwater
        const current = this.getBlock(x, y, z);
        // Only paint over natural ground blocks
        if (current === BLOCKS.GRASS || current === BLOCKS.DIRT || current === BLOCKS.SAND) {
            this.data[this.getIndex(x, y, z)] = blockType;
        }
    }

    addFlowerBeds(houses) {
        houses.forEach(h => {
            for (let dx = -3; dx <= 3; dx++) {
                for (let dz = -3; dz <= 3; dz++) {
                    if (Math.random() > 0.1) continue;
                    const x = h.x + dx, z = h.z + dz;
                    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) continue;
                    const y = this.getTopBlockY(x, z);
                    if (y + 1 >= CHUNK_HEIGHT) continue;
                    if (this.getBlock(x, y, z) !== BLOCKS.GRASS) continue;
                    if (this.getBlock(x, y + 1, z) !== BLOCKS.AIR) continue;
                    const flower = Math.random() < 0.5 ? BLOCKS.FLOWER_RED : BLOCKS.FLOWER_YELLOW;
                    this.data[this.getIndex(x, y + 1, z)] = flower;
                }
            }
        });
    }

    // Major highways: curved 3-block-wide roads laid on certain chunks
    // to connect biomes across this chunk
    // to help the player navigate
    tryGenerateHighway() {
        const centerX = Math.floor(CHUNK_SIZE / 2);
        const centerZ = Math.floor(CHUNK_SIZE / 2);
        const curveFactor = 0.003;
        const roadWidth = 3;
        const halfWidth = Math.floor(roadWidth / 2);

        const placeEW = (this.chunkZ % 8 === 0);
        const placeNS = (this.chunkX % 8 === 0);
        if (!placeEW && !placeNS) return;

        if (placeEW) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
                const deviation = Math.sin(x * curveFactor * CHUNK_SIZE) * 3;
                const zBase = Math.floor(centerZ + deviation);
                for (let dw = -halfWidth; dw <= halfWidth; dw++) {
                    const z = zBase + dw;
                    if (z < 0 || z >= CHUNK_SIZE) continue;
                    this.paintHighway(x, z);
                }
            }
        }
        
        if (placeNS) {
            for (let z = 0; z < CHUNK_SIZE; z++) {
                const deviation = Math.sin(z * curveFactor * CHUNK_SIZE) * 3;
                const xBase = Math.floor(centerX + deviation);
                for (let dw = -halfWidth; dw <= halfWidth; dw++) {
                    const x = xBase + dw;
                    if (x < 0 || x >= CHUNK_SIZE) continue;
                    this.paintHighway(x, z);
                }
            }
        }
    }

    // Paint a highway block - uses PATH (light sandy) for high visibility
    paintHighway(x, z) {
        if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) return;
        const y = this.getTopBlockY(x, z);
        if (y <= WATER_LEVEL) return; // skip underwater
        const current = this.getBlock(x, y, z);
        // Only replace ground blocks (keep buildings)
        if (current === BLOCKS.GRASS || current === BLOCKS.DIRT || current === BLOCKS.SAND || current === BLOCKS.GRAVEL) {
            this.data[this.getIndex(x, y, z)] = BLOCKS.PATH;
            // Clear flowers/grass/entities above
            for (let yy = y + 1; yy < CHUNK_HEIGHT; yy++) {
                const above = this.getBlock(x, yy, z);
                if (above === BLOCKS.AIR) break;
                // Remove all entities and plants
                this.data[this.getIndex(x, yy, z)] = BLOCKS.AIR;
            }
        }
    }

    generateFineHouse(x, y, z) {
        const w = 7, h = 5, d = 7;
        if (x + w > CHUNK_SIZE || z + d > CHUNK_SIZE || y + h + 4 > CHUNK_HEIGHT) return;

        for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
                for (let dz = 0; dz < d; dz++) {
                    const isFloor = dy === 0;
                    const isWall = dx === 0 || dx === w - 1 || dz === 0 || dz === d - 1;
                    const isCorner = (dx === 0 || dx === w - 1) && (dz === 0 || dz === d - 1);
                    const isDoor = (dx === Math.floor(w / 2) && dz === 0 && dy < 3);
                    const isWindow = (dy === 2 && (
                        ((dx === 0 || dx === w - 1) && dz === Math.floor(d / 2)) ||
                        (dz === d - 1 && (dx === 2 || dx === w - 3))
                    ));

                    const bx = x + dx, by = y + dy, bz = z + dz;
                    if (bx < 0 || bx >= CHUNK_SIZE || bz < 0 || bz >= CHUNK_SIZE || by >= CHUNK_HEIGHT) continue;

                    if (isFloor) this.data[this.getIndex(bx, by, bz)] = BLOCKS.PLANKS;
                    else if (isCorner) this.data[this.getIndex(bx, by, bz)] = BLOCKS.WOOD;
                    else if (isWall) {
                        if (isDoor) this.data[this.getIndex(bx, by, bz)] = BLOCKS.AIR;
                        else if (isWindow) this.data[this.getIndex(bx, by, bz)] = BLOCKS.GLASS;
                        else this.data[this.getIndex(bx, by, bz)] = BLOCKS.PLANKS;
                    } else {
                        // Interior air
                        this.data[this.getIndex(bx, by, bz)] = BLOCKS.AIR;
                    }
                }
            }
        }

        // Pitched roof using wood
        for (let ry = 0; ry < 4; ry++) {
            for (let rx = ry - 1; rx < w - ry + 1; rx++) {
                for (let rz = ry - 1; rz < d - ry + 1; rz++) {
                    const bx = x + rx, by = y + h + ry, bz = z + rz;
                    if (bx >= 0 && bx < CHUNK_SIZE && by < CHUNK_HEIGHT && bz >= 0 && bz < CHUNK_SIZE) {
                        // Only top-layer of each ring
                        if (rx === ry - 1 || rx === w - ry || rz === ry - 1 || rz === d - ry) {
                            this.data[this.getIndex(bx, by, bz)] = BLOCKS.WOOD;
                        }
                    }
                }
            }
        }
    }

    buildMesh() {
        // Dispose existing meshes
        for (const type in this.meshes) {
            this.scene.remove(this.meshes[type]);
        }
        this.meshes = {};

        // Count exposed blocks by type
        const counts = {};
        const instances = [];
        for (let x = 0; x < CHUNK_SIZE; x++) {
            for (let y = 0; y < CHUNK_HEIGHT; y++) {
                for (let z = 0; z < CHUNK_SIZE; z++) {
                    const block = this.data[this.getIndex(x, y, z)];
                    if (block === BLOCKS.AIR) continue;
                    const isExposed =
                        this.getBlock(x + 1, y, z) === BLOCKS.AIR ||
                        this.getBlock(x - 1, y, z) === BLOCKS.AIR ||
                        this.getBlock(x, y + 1, z) === BLOCKS.AIR ||
                        this.getBlock(x, y - 1, z) === BLOCKS.AIR ||
                        this.getBlock(x, y, z + 1) === BLOCKS.AIR ||
                        this.getBlock(x, y, z - 1) === BLOCKS.AIR ||
                        block === BLOCKS.WATER || block === BLOCKS.GLASS ||
                        block === BLOCKS.FLOWER_RED || block === BLOCKS.FLOWER_YELLOW ||
                        block === BLOCKS.CLOUD;
                    if (isExposed) {
                        counts[block] = (counts[block] || 0) + 1;
                        instances.push({ x, y, z, block });
                    }
                }
            }
        }

        const matrix = new THREE.Matrix4();
        const offsets = {};

        for (const bId in counts) {
            const blockId = parseInt(bId);
            const mat = BLOCK_MATERIAL[blockId];
            if (!mat) continue; // Unknown block - skip gracefully
            const mesh = new THREE.InstancedMesh(sharedBoxGeo, mat, counts[blockId]);
            mesh.castShadow = blockId !== BLOCKS.WATER && blockId !== BLOCKS.CLOUD && blockId !== BLOCKS.GLASS;
            mesh.receiveShadow = blockId !== BLOCKS.WATER && blockId !== BLOCKS.GLASS;
            mesh.position.set(this.chunkX * CHUNK_SIZE, 0, this.chunkZ * CHUNK_SIZE);
            this.scene.add(mesh);
            this.meshes[blockId] = mesh;
            offsets[blockId] = 0;
        }

        instances.forEach(inst => {
            matrix.setPosition(inst.x, inst.y, inst.z);
            if (this.meshes[inst.block]) {
                this.meshes[inst.block].setMatrixAt(offsets[inst.block], matrix);
                offsets[inst.block]++;
            }
        });

        for (const type in this.meshes) {
            this.meshes[type].instanceMatrix.needsUpdate = true;
        }
        this.dirty = false;
    }

    destroy() {
        for (const type in this.meshes) {
            const mesh = this.meshes[type];
            this.scene.remove(mesh);
            mesh.dispose();
        }
        this.meshes = {};
    }

    // Serialize chunk data for save game
    serialize() {
        return Array.from(this.data);
    }

    // Load chunk data from save (rebuilds mesh)
    loadData(dataArray) {
        if (!Array.isArray(dataArray) || dataArray.length !== this.data.length) return;
        for (let i = 0; i < this.data.length; i++) this.data[i] = dataArray[i];
        this.buildMesh();
    }
}

// ============================================================
// World class - manages chunks around the player
// ============================================================
export class World {
    constructor(scene, seed) {
        this.scene = scene;
        this.chunks = {};
        this.seed = seed || Math.floor(Math.random() * 1e9);
        // Initialize shared noise with a deterministic seed-like behaviour
        // simplex-noise's createNoise2D accepts a random function; we derive one from the seed
        const rand = mulberry32(this.seed);
        noise2D = createNoise2D(rand);
        noise3D = createNoise3D(rand);
    }

    getChunkKey(cx, cz) { return cx + ',' + cz; }

    update(playerX, playerZ) {
        const pCx = Math.floor(playerX / CHUNK_SIZE);
        const pCz = Math.floor(playerZ / CHUNK_SIZE);
        const renderDistance = 6;

        // Load chunks within render distance
        for (let x = -renderDistance; x <= renderDistance; x++) {
            for (let z = -renderDistance; z <= renderDistance; z++) {
                const cx = pCx + x, cz = pCz + z;
                const key = this.getChunkKey(cx, cz);
                if (!this.chunks[key]) this.chunks[key] = new Chunk(this.scene, cx, cz, this);
            }
        }

        // Unload chunks far from player
        for (const key in this.chunks) {
            const chunk = this.chunks[key];
            if (Math.abs(chunk.chunkX - pCx) > renderDistance + 1 || Math.abs(chunk.chunkZ - pCz) > renderDistance + 1) {
                chunk.destroy();
                delete this.chunks[key];
            }
        }
    }

    getBlock(wx, wy, wz) {
        const cx = Math.floor(wx / CHUNK_SIZE), cz = Math.floor(wz / CHUNK_SIZE);
        const key = this.getChunkKey(cx, cz);
        if (!this.chunks[key]) return BLOCKS.AIR;
        const lx = ((Math.floor(wx) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((Math.floor(wz) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return this.chunks[key].getBlock(lx, Math.floor(wy), lz);
    }

    setBlock(wx, wy, wz, type) {
        const cx = Math.floor(wx / CHUNK_SIZE), cz = Math.floor(wz / CHUNK_SIZE);
        const key = this.getChunkKey(cx, cz);
        if (!this.chunks[key]) return;
        const lx = ((Math.floor(wx) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((Math.floor(wz) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        this.chunks[key].setBlock(lx, Math.floor(wy), lz, type);
    }

    getSurfaceHeight(wx, wz) {
        for (let y = CHUNK_HEIGHT - 1; y > 0; y--) {
            const block = this.getBlock(wx, y, wz);
            if (block !== BLOCKS.AIR && block !== BLOCKS.WATER && block !== BLOCKS.CLOUD) return y;
        }
        return 0;
    }

    // Save diffs from procedural generation to localStorage (player modifications only)
    getPlayerEdits() {
        // We implement edits via a separate map stored in save data; simplest is to record changes
        return this.edits || {};
    }
}

// ============================================================
// Utilities
// ============================================================

// Deterministic RNG from seed (for noise)
function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
        t += 0x6D2B79F5;
        let r = t;
        r = Math.imul(r ^ (r >>> 15), r | 1);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

// Export constants used elsewhere
export { CHUNK_SIZE, CHUNK_HEIGHT, WATER_LEVEL, CLOUD_LEVEL, BIOMES };
