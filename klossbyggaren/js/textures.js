import * as THREE from 'three';

// Funktion för att skapa proceduriska texturer via Canvas2D
function createTexture(type) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;  // Minecraft upplösning (16x16)
    canvas.height = 16;
    const ctx = canvas.getContext('2d');

    // Hjälpfunktion för noise
    const noise = (x, y) => Math.random() * 0.2 - 0.1;

    // Fyll med basfärg och noise
    const fillArea = (baseColor, xStart, yStart, width, height) => {
        ctx.fillStyle = baseColor;
        ctx.fillRect(xStart, yStart, width, height);
        
        // Pseudo-noise för lite struktur (Minecraft-stil)
        for(let py = yStart; py < yStart + height; py++) {
            for(let px = xStart; px < xStart + width; px++) {
                if (Math.random() > 0.5) {
                    ctx.fillStyle = \`rgba(0,0,0,\${Math.random()*0.15})\`;
                } else {
                    ctx.fillStyle = \`rgba(255,255,255,\${Math.random()*0.15})\`;
                }
                ctx.fillRect(px, py, 1, 1);
            }
        }
    };

    switch(type) {
        case 'grass_top':
            fillArea('#559944', 0, 0, 16, 16);
            break;
        case 'grass_side':
            fillArea('#795548', 0, 0, 16, 16); // Jord i botten
            fillArea('#559944', 0, 0, 16, 4); // Gräskant upptill
            // Hackig övergång
            for(let i=0; i<16; i++) {
                if(Math.random() > 0.3) {
                    ctx.fillStyle = '#559944';
                    ctx.fillRect(i, 4, 1, Math.floor(Math.random()*3));
                }
            }
            break;
        case 'dirt':
            fillArea('#795548', 0, 0, 16, 16);
            break;
        case 'stone':
            fillArea('#9E9E9E', 0, 0, 16, 16);
            break;
        case 'wood_side':
            fillArea('#6D4C41', 0, 0, 16, 16);
            // Bark-linjer
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            for(let i=1; i<16; i+=3) {
                ctx.fillRect(i, 0, Math.random()*2, 16);
            }
            break;
        case 'wood_top':
            fillArea('#A1887F', 0, 0, 16, 16);
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.beginPath();
            ctx.arc(8, 8, 2, 0, Math.PI*2);
            ctx.arc(8, 8, 4, 0, Math.PI*2);
            ctx.arc(8, 8, 6, 0, Math.PI*2);
            ctx.stroke();
            break;
        case 'leaves':
            fillArea('#2E7D32', 0, 0, 16, 16);
            // Genomskinliga hål
            for(let py = 0; py < 16; py++) {
                for(let px = 0; px < 16; px++) {
                    if (Math.random() > 0.7) {
                        ctx.clearRect(px, py, 1, 1);
                    }
                }
            }
            break;
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter; // Skarp pixel art-look!
    tex.minFilter = THREE.NearestFilter;
    return tex;
}

export const materials = {
    grass: [
        new THREE.MeshLambertMaterial({ map: createTexture('grass_side') }), // right
        new THREE.MeshLambertMaterial({ map: createTexture('grass_side') }), // left
        new THREE.MeshLambertMaterial({ map: createTexture('grass_top') }), // top
        new THREE.MeshLambertMaterial({ map: createTexture('dirt') }), // bottom
        new THREE.MeshLambertMaterial({ map: createTexture('grass_side') }), // front
        new THREE.MeshLambertMaterial({ map: createTexture('grass_side') }), // back
    ],
    dirt: new THREE.MeshLambertMaterial({ map: createTexture('dirt') }),
    stone: new THREE.MeshLambertMaterial({ map: createTexture('stone') }),
    wood: [
        new THREE.MeshLambertMaterial({ map: createTexture('wood_side') }),
        new THREE.MeshLambertMaterial({ map: createTexture('wood_side') }),
        new THREE.MeshLambertMaterial({ map: createTexture('wood_top') }),
        new THREE.MeshLambertMaterial({ map: createTexture('wood_top') }),
        new THREE.MeshLambertMaterial({ map: createTexture('wood_side') }),
        new THREE.MeshLambertMaterial({ map: createTexture('wood_side') }),
    ],
    leaves: new THREE.MeshLambertMaterial({ map: createTexture('leaves'), transparent: true, alphaTest: 0.5 }),
    highlight: new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 })
};

export const BLOCKS = {
    AIR: 0,
    GRASS: 1,
    DIRT: 2,
    STONE: 3,
    WOOD: 4,
    LEAVES: 5
};
