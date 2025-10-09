import * as THREE from 'three';

// --- Procedural Texture Generators ---
export const createGroundTexture = (baseColor: string): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    const size = 32;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d')!;

    const baseR = parseInt(baseColor.slice(1, 3), 16);
    const baseG = parseInt(baseColor.slice(3, 5), 16);
    const baseB = parseInt(baseColor.slice(5, 7), 16);

    const imageData = context.createImageData(size, size);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const variation = (Math.random() - 0.5) * 40;
        data[i] = Math.max(0, Math.min(255, baseR + variation));
        data[i + 1] = Math.max(0, Math.min(255, baseG + variation));
        data[i + 2] = Math.max(0, Math.min(255, baseB + variation));
        data[i + 3] = 255;
    }

    context.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
};


export const createMoonTexture = (): THREE.CanvasTexture => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(0, 0, size, size);

    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const variation = (Math.random() - 0.5) * 20;
        data[i] += variation;
        data[i + 1] += variation;
        data[i + 2] += variation;
    }
    ctx.putImageData(imageData, 0, 0);

    for (let i = 0; i < 7; i++) {
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.1 + 0.1})`;
        ctx.beginPath();
        ctx.ellipse(
            Math.random() * size,
            Math.random() * size,
            Math.random() * size * 0.2 + size * 0.1,
            Math.random() * size * 0.2 + size * 0.1,
            Math.random() * Math.PI * 2,
            0, Math.PI * 2
        );
        ctx.fill();
    }

    const drawCrater = (x: number, y: number, r: number) => {
        const angle = Math.random() * Math.PI * 2;
        const highlightOffset = 0.2 * r;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.arc(x + Math.cos(angle) * highlightOffset, y + Math.sin(angle) * highlightOffset, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
    };

    for (let i = 0; i < 300; i++) {
        drawCrater(
            Math.random() * size,
            Math.random() * size,
            Math.random() * size * 0.04 + 2
        );
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
};

export const createCloudTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d')!;
    const centerX = 128;
    const centerY = 128;
    const gradient = context.createRadialGradient(centerX, centerY, 20, centerX, centerY, 128);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.5)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(canvas);
}

export const createParticleTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.2, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.6, 'rgba(255,255,255,0.5)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
};


export const pseudoRandom = (seed: number) => {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

// Simple Noise function for flora density
export const createNoise2D = (seed: number) => {
    const perm: number[] = [];
    for (let i = 0; i < 256; i++) {
        perm.push(Math.floor(pseudoRandom(seed + i * 1.1) * 256));
    }
    const p = perm.concat(perm);
    
    const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
    const lerp = (t: number, a: number, b: number) => a + t * (b - a);
    const grad = (hash: number, x: number, y: number) => {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 8 ? y : x;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    };

    return (x: number, y: number) => {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        const u = fade(x);
        const v = fade(y);
        const aa = p[p[X] + Y];
        const ab = p[p[X] + Y + 1];
        const ba = p[p[X + 1] + Y];
        const bb = p[p[X + 1] + Y + 1];
        
        return lerp(v, lerp(u, grad(p[aa], x, y), grad(p[ba], x - 1, y)),
                       lerp(u, grad(p[ab], x, y - 1), grad(p[bb], x - 1, y - 1)));
    };
};
export const floraNoise = createNoise2D(12345);


// --- Terrain Generation ---
export const getHeight = (x: number, z: number): number => {
    const scale = 80;
    const roughness = 0.6;
    const amplitude = 15;
    let height = Math.sin(x / scale) * Math.cos(z / scale) * amplitude;
    height += (Math.sin(x / (scale * 0.5)) * Math.cos(z / (scale * 0.5))) * amplitude * roughness;
    return height;
};

export const findNewLandingSpot = (tree: THREE.Group): THREE.Vector3 => {
    const instancedLeaves = tree.children.find(c => c instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
    if (!instancedLeaves || instancedLeaves.count === 0) {
      return new THREE.Vector3(0, tree.userData.height, 0);
    }
    const leafIndex = Math.floor(Math.random() * instancedLeaves.count);
    const matrix = new THREE.Matrix4();
    instancedLeaves.getMatrixAt(leafIndex, matrix);
    const leafPosition = new THREE.Vector3().setFromMatrixPosition(matrix);
    leafPosition.y -= 0.8;
    return leafPosition;
};
