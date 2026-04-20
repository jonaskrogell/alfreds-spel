import * as THREE from 'three';

function createTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    const fillArea = (baseColor, xStart, yStart, width, height, noise = 0.15) => {
        ctx.fillStyle = baseColor;
        ctx.fillRect(xStart, yStart, width, height);
        for(let py = yStart; py < yStart + height; py++) {
            for(let px = xStart; px < xStart + width; px++) {
                const shade = (Math.random() - 0.5) * 2 * noise;
                if (shade > 0) ctx.fillStyle = `rgba(255,255,255,${shade})`;
                else ctx.fillStyle = `rgba(0,0,0,${-shade})`;
                ctx.fillRect(px, py, 1, 1);
            }
        }
    };

    switch(type) {
        case 'grass_top': fillArea('#559944', 0, 0, 16, 16); break;
        case 'grass_side':
            fillArea('#795548', 0, 0, 16, 16);
            fillArea('#559944', 0, 0, 16, 4);
            for(let i=0; i<16; i++) if(Math.random()>0.3) { ctx.fillStyle='#559944'; ctx.fillRect(i,4,1,Math.floor(Math.random()*3)); }
            break;
        case 'dirt': fillArea('#795548', 0, 0, 16, 16); break;
        case 'stone': fillArea('#9E9E9E', 0, 0, 16, 16); break;
        case 'sand': fillArea('#F4A460', 0, 0, 16, 16, 0.1); break;
        case 'wood_side':
            fillArea('#6D4C41', 0, 0, 16, 16);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            for(let i=1; i<16; i+=3) ctx.fillRect(i, 0, 1, 16);
            break;
        case 'wood_top':
            fillArea('#A1887F', 0, 0, 16, 16);
            ctx.strokeStyle = 'rgba(0,0,0,0.2)';
            ctx.beginPath(); ctx.arc(8, 8, 3, 0, Math.PI*2); ctx.stroke();
            ctx.beginPath(); ctx.arc(8, 8, 6, 0, Math.PI*2); ctx.stroke();
            break;
        case 'leaves':
            fillArea('#2E7D32', 0, 0, 16, 16, 0.3);
            for(let i=0; i<40; i++) if(Math.random()>0.5) ctx.clearRect(Math.random()*16, Math.random()*16, 1, 1);
            break;
        case 'water': fillArea('#2196F3', 0, 0, 16, 16, 0.1); break;
        case 'glass':
            ctx.fillStyle = 'rgba(173, 216, 230, 0.3)';
            ctx.fillRect(0,0,16,16);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(1,1,14,14);
            ctx.beginPath(); ctx.moveTo(4,4); ctx.lineTo(12,12); ctx.stroke();
            break;
case 'planks':
            fillArea('#BCAAA4', 0, 0, 16, 16);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(0, 7, 16, 1); ctx.fillRect(0, 15, 16, 1);
            ctx.fillRect(8, 0, 1, 7); ctx.fillRect(4, 8, 1, 7);
            // Add decorative wood grain
            ctx.fillStyle = 'rgba(139,119,72,0.3)';
            for(let i=0;i<8;i++){ ctx.fillRect(2+i*2, 2, 1, 3+Math.floor(Math.random()*2)); }
            break;
        case 'cloud': fillArea('#FFFFFF', 0, 0, 16, 16, 0.05); break;
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    return tex;
}

export const materials = {
    grass: [
        new THREE.MeshLambertMaterial({ map: createTexture('grass_side') }),
        new THREE.MeshLambertMaterial({ map: createTexture('grass_side') }),
        new THREE.MeshLambertMaterial({ map: createTexture('grass_top') }),
        new THREE.MeshLambertMaterial({ map: createTexture('dirt') }),
        new THREE.MeshLambertMaterial({ map: createTexture('grass_side') }),
        new THREE.MeshLambertMaterial({ map: createTexture('grass_side') }),
    ],
    dirt: new THREE.MeshLambertMaterial({ map: createTexture('dirt') }),
    stone: new THREE.MeshLambertMaterial({ map: createTexture('stone') }),
    sand: new THREE.MeshLambertMaterial({ map: createTexture('sand') }),
    wood: [
        new THREE.MeshLambertMaterial({ map: createTexture('wood_side') }),
        new THREE.MeshLambertMaterial({ map: createTexture('wood_side') }),
        new THREE.MeshLambertMaterial({ map: createTexture('wood_top') }),
        new THREE.MeshLambertMaterial({ map: createTexture('wood_top') }),
        new THREE.MeshLambertMaterial({ map: createTexture('wood_side') }),
        new THREE.MeshLambertMaterial({ map: createTexture('wood_side') }),
    ],
    leaves: new THREE.MeshLambertMaterial({ map: createTexture('leaves'), transparent: true, alphaTest: 0.5 }),
    water: new THREE.MeshLambertMaterial({ map: createTexture('water'), transparent: true, opacity: 0.6 }),
    glass: new THREE.MeshLambertMaterial({ map: createTexture('glass'), transparent: true }),
    planks: new THREE.MeshLambertMaterial({ map: createTexture('planks') }),
    cloud: new THREE.MeshLambertMaterial({ map: createTexture('cloud'), transparent: true, opacity: 0.8 }),
};

export const BLOCKS = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    WOOD: 4,
    LEAVES: 5,
    WATER: 6,
    SAND: 7,
    GLASS: 8,
    PLANKS: 9,
    CLOUD: 10
};
