import * as THREE from 'three';
import { createGroundTexture } from './utils';

// --- Pre-created Geometries & Materials for Instancing ---
export const leafGeometry = new THREE.BoxGeometry(2, 2, 2);
export const leafMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
export const bushLeafGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);

export const groundTopGeo = new THREE.BoxGeometry(2, 0.5, 2);
export const groundBaseGeo = new THREE.BoxGeometry(2, 3, 2);
const grassTexture = createGroundTexture('#7CFC00');
const dirtTexture = createGroundTexture('#8B4513');
export const grassMaterial = new THREE.MeshLambertMaterial({ map: grassTexture });
export const dirtMaterial = new THREE.MeshLambertMaterial({ map: dirtTexture });

export const nestMaterial = new THREE.MeshLambertMaterial({ color: 0x8B5F47 });
export const nestTwigGeo = new THREE.BoxGeometry(0.2, 0.2, 1.5);

// --- Flora Geometries & Materials ---
export const flowerStemGeo = new THREE.BoxGeometry(0.1, 0.5, 0.1);
export const flowerHeadGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
export const flowerStemMat = new THREE.MeshLambertMaterial({ color: 0x006400 });
export const flowerMaterials = {
    red: new THREE.MeshLambertMaterial({ color: 0xFF0000 }),
    yellow: new THREE.MeshLambertMaterial({ color: 0xFFFF00 }),
    blue: new THREE.MeshLambertMaterial({ color: 0x4169E1 }),
};

export const mushroomStalkGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.6, 6);
export const mushroomCapGeo = new THREE.SphereGeometry(0.4, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
export const mushroomMaterials = {
    redCap: new THREE.MeshLambertMaterial({ color: 0xB22222 }),
    brownCap: new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
    stalk: new THREE.MeshLambertMaterial({ color: 0xF5F5DC }),
};

export const grassBladeGeo = new THREE.BoxGeometry(0.1, 1.2, 0.1);
export const grassMaterialGeneric = new THREE.MeshLambertMaterial({ color: 0x2E8B57 });


// --- Bird Component Geometries & Materials ---
export const birdBodyGeo = new THREE.BufferGeometry();
const bodyVertices = new Float32Array([0, 0.2, 0.3, 0.3, 0, 0, -0.3, 0, 0, 0, 0.25, -0.4, 0, -0.2, 0.5, 0, -0.25, -0.2]);
birdBodyGeo.setAttribute('position', new THREE.BufferAttribute(bodyVertices, 3));
const bodyIndices = [0, 1, 2,  3, 2, 1,  0, 2, 4, 0, 4, 1,  3, 1, 5,  3, 5, 2, 2, 5, 4,  1, 4, 5];
birdBodyGeo.setIndex(bodyIndices);
birdBodyGeo.addGroup(0, 18, 0); // Blue material for top
birdBodyGeo.addGroup(18, 6, 1); // Yellow material for bottom
birdBodyGeo.computeVertexNormals();

export const birdWingGeo = new THREE.BufferGeometry();
const wingVertices = new Float32Array([0, 0, 0, 1.2, 0, -0.2, 0.8, 0.05, 0.5, 0.5, 0.0, 0.8, 0.2, -0.05, 0.4]);
birdWingGeo.setAttribute('position', new THREE.BufferAttribute(wingVertices, 3));
const wingIndices = [0, 1, 2, 0, 2, 4, 2, 3, 4];
const reversedWingIndices = [0, 2, 1, 0, 4, 2, 2, 4, 3];
birdWingGeo.setIndex(wingIndices.concat(reversedWingIndices));
birdWingGeo.addGroup(0, 9, 0); // Blue top
birdWingGeo.addGroup(9, 9, 1); // Yellow bottom
birdWingGeo.computeVertexNormals();

export const beakGeo = new THREE.ConeGeometry(0.1, 0.4, 4);

export const birdBlueMat = new THREE.MeshLambertMaterial({ color: 0x2196F3, side: THREE.DoubleSide, transparent: true, opacity: 0, fog: false });
export const birdYellowMat = new THREE.MeshLambertMaterial({ color: 0xFFEB3B, side: THREE.DoubleSide, transparent: true, opacity: 0, fog: false });
export const birdDarkMat = new THREE.MeshLambertMaterial({ color: 0x424242, side: THREE.DoubleSide, transparent: true, opacity: 0, fog: false });
export const allBirdMaterials = [birdBlueMat, birdYellowMat, birdDarkMat];

// --- Villager & Village Component Geometries & Materials ---
export const villagerSkinMat = new THREE.MeshLambertMaterial({ color: 0xD2A679 });
export const villagerEyeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
export const villagerMouthMat = new THREE.MeshLambertMaterial({ color: 0x9c5959 });

export const villagerHairMaterials = {
    brown: new THREE.MeshLambertMaterial({ color: 0x5C4033 }),
    black: new THREE.MeshLambertMaterial({ color: 0x1E1E1E }),
    blonde: new THREE.MeshLambertMaterial({ color: 0xD2B48C }),
    grey: new THREE.MeshLambertMaterial({ color: 0x808080 }),
};
export const hairColors = Object.keys(villagerHairMaterials);
export const flatTopHairGeo = new THREE.BoxGeometry(1.9, 0.5, 1.9);
export const sidePartHairGeo = new THREE.BoxGeometry(1.9, 0.5, 1.9);
export const bowlCutHairGeo = new THREE.BoxGeometry(2.0, 0.8, 2.0);
export const apronGeo = new THREE.BoxGeometry(1.5, 1.8, 0.2);
export const beltGeo = new THREE.BoxGeometry(2.1, 0.4, 1.6);
export const hatBrimGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.2, 12);
export const hatTopGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.8, 12);

export const villagerHeadGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
export const villagerNoseGeo = new THREE.BoxGeometry(0.4, 0.8, 0.6);
export const villagerBodyGeo = new THREE.BoxGeometry(2, 2.5, 1.5);
export const villagerArmGeo = new THREE.BoxGeometry(0.8, 2.5, 0.8);
export const villagerLegGeo = new THREE.BoxGeometry(0.8, 1.5, 1);
export const villagerProfessionMaterials = {
    farmer: new THREE.MeshLambertMaterial({ color: 0xDAA520 }), // Brown/Yellow
    librarian: new THREE.MeshLambertMaterial({ color: 0xFFFFFF }), // White
    blacksmith: new THREE.MeshLambertMaterial({ color: 0x36454F }), // Dark Grey
    nitwit: new THREE.MeshLambertMaterial({ color: 0x50C878 }), // Green
};

export const woodPlankMat = new THREE.MeshLambertMaterial({ color: 0x8B5A2B });
export const woodLogMat = new THREE.MeshLambertMaterial({ color: 0x654321 });
export const cobblestoneMat = new THREE.MeshLambertMaterial({ color: 0x808080 });
export const farmlandMat = new THREE.MeshLambertMaterial({ color: 0x6B4226 });
export const waterMat = new THREE.MeshLambertMaterial({ color: 0x4682B4, transparent: true, opacity: 0.8 });
export const cropMat = new THREE.MeshLambertMaterial({ color: 0x00FF00 });
