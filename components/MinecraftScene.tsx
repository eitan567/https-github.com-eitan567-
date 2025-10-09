import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { MoveVector, CameraMode, CharacterAppearance } from '../App';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';


// --- World Generation Constants ---
const CHUNK_SIZE = 32;
const RENDER_DISTANCE_IN_CHUNKS = 5; 
const TREE_DENSITY = 0.1; 
const BUSH_DENSITY = 0.08;
const DIRT_PATCH_DENSITY = 0.15;
const FLOWER_DENSITY = 0.15;
const MUSHROOM_DENSITY = 0.08;
const GRASS_DENSITY = 0.3;
const BIRD_TREE_CHANCE = 0.4;
const NEST_CHANCE = 0.3;
const VILLAGE_DENSITY = 0.04; 

// --- Game Constants ---
const PLAYER_SPEED = 9;
const PLAYER_RUN_MULTIPLIER = 2;
const PLAYER_ROTATION_SPEED = 3;
const GRAVITY = 30;
const JUMP_FORCE = 10;
const CAMERA_OFFSET = new THREE.Vector3(0, 12, -28);
const DAY_NIGHT_CYCLE_SECONDS = 300;
const START_TIME_OFFSET = DAY_NIGHT_CYCLE_SECONDS * 0.35;
const MOON_LAYER = 1;
const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
const MOUSE_SENSITIVITY = 0.002;
const FIRST_PERSON_PITCH_LIMIT = Math.PI / 2 - 0.1;


// --- Bird AI Constants ---
const BIRD_MAX_SPEED = 4.0;
const BIRD_PERCEPTION_RADIUS = 20;
const BIRD_SEPARATION_DISTANCE = 5;
const BIRD_ALIGNMENT_WEIGHT = 1.0;
const BIRD_COHESION_WEIGHT = 1.0;
const BIRD_SEPARATION_WEIGHT = 1.5;

// --- Villager AI Constants ---
const VILLAGER_SPEED = 1.5;
const VILLAGER_INTERACTION_RADIUS = 8;
type VillagerProfession = 'farmer' | 'librarian' | 'blacksmith' | 'nitwit';


// --- Day/Night Cycle Colors & Intensities ---
const keyframes = [
    { time: 0,    sky: new THREE.Color(0x00001a), fog: new THREE.Color(0x00001a), sun: 0.0, ambient: 0.05 }, // Midnight
    { time: 0.23, sky: new THREE.Color(0x00001a), fog: new THREE.Color(0x00001a), sun: 0.0, ambient: 0.05 }, // Pre-dawn
    { time: 0.25, sky: new THREE.Color(0xff8c00), fog: new THREE.Color(0xffa500), sun: 0.5, ambient: 0.3 }, // Sunrise
    { time: 0.30, sky: new THREE.Color(0x87CEEB), fog: new THREE.Color(0x87CEEB), sun: 0.9, ambient: 0.6 }, // Morning
    { time: 0.70, sky: new THREE.Color(0x87CEEB), fog: new THREE.Color(0x87CEEB), sun: 0.9, ambient: 0.6 }, // Afternoon
    { time: 0.75, sky: new THREE.Color(0xff8c00), fog: new THREE.Color(0xffa500), sun: 0.5, ambient: 0.3 }, // Sunset
    { time: 0.77, sky: new THREE.Color(0x00001a), fog: new THREE.Color(0x00001a), sun: 0.0, ambient: 0.05 }, // Post-dusk
    { time: 1.0,  sky: new THREE.Color(0x00001a), fog: new THREE.Color(0x00001a), sun: 0.0, ambient: 0.05 }  // Midnight
];

// --- Procedural Texture Generators ---
const createGroundTexture = (baseColor: string): THREE.CanvasTexture => {
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


const createMoonTexture = (): THREE.CanvasTexture => {
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

const createCloudTexture = (): THREE.CanvasTexture => {
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

const createParticleTexture = (): THREE.CanvasTexture => {
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

// --- Pre-created Geometries & Materials for Instancing ---
const leafGeometry = new THREE.BoxGeometry(2, 2, 2);
const leafMaterial = new THREE.MeshLambertMaterial({ color: 0x228B22 });
const bushLeafGeo = new THREE.BoxGeometry(1.5, 1.5, 1.5);

const groundTopGeo = new THREE.BoxGeometry(2, 0.5, 2);
const groundBaseGeo = new THREE.BoxGeometry(2, 3, 2);
const grassTexture = createGroundTexture('#7CFC00');
const dirtTexture = createGroundTexture('#8B4513');
const grassMaterial = new THREE.MeshLambertMaterial({ map: grassTexture });
const dirtMaterial = new THREE.MeshLambertMaterial({ map: dirtTexture });

const nestMaterial = new THREE.MeshLambertMaterial({ color: 0x8B5F47 });
const nestTwigGeo = new THREE.BoxGeometry(0.2, 0.2, 1.5);

// --- Flora Geometries & Materials ---
const flowerStemGeo = new THREE.BoxGeometry(0.1, 0.5, 0.1);
const flowerHeadGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
const flowerStemMat = new THREE.MeshLambertMaterial({ color: 0x006400 });
const flowerMaterials = {
    red: new THREE.MeshLambertMaterial({ color: 0xFF0000 }),
    yellow: new THREE.MeshLambertMaterial({ color: 0xFFFF00 }),
    blue: new THREE.MeshLambertMaterial({ color: 0x4169E1 }),
};

const mushroomStalkGeo = new THREE.CylinderGeometry(0.15, 0.2, 0.6, 6);
const mushroomCapGeo = new THREE.SphereGeometry(0.4, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
const mushroomMaterials = {
    redCap: new THREE.MeshLambertMaterial({ color: 0xB22222 }),
    brownCap: new THREE.MeshLambertMaterial({ color: 0x8B4513 }),
    stalk: new THREE.MeshLambertMaterial({ color: 0xF5F5DC }),
};

const grassBladeGeo = new THREE.BoxGeometry(0.1, 1.2, 0.1);
const grassMaterialGeneric = new THREE.MeshLambertMaterial({ color: 0x2E8B57 });


// --- Bird Component Geometries & Materials ---
const birdBodyGeo = new THREE.BufferGeometry();
const bodyVertices = new Float32Array([0, 0.2, 0.3, 0.3, 0, 0, -0.3, 0, 0, 0, 0.25, -0.4, 0, -0.2, 0.5, 0, -0.25, -0.2]);
birdBodyGeo.setAttribute('position', new THREE.BufferAttribute(bodyVertices, 3));
const bodyIndices = [0, 1, 2,  3, 2, 1,  0, 2, 4, 0, 4, 1,  3, 1, 5,  3, 5, 2, 2, 5, 4,  1, 4, 5];
birdBodyGeo.setIndex(bodyIndices);
birdBodyGeo.addGroup(0, 18, 0); // Blue material for top
birdBodyGeo.addGroup(18, 6, 1); // Yellow material for bottom
birdBodyGeo.computeVertexNormals();

const birdWingGeo = new THREE.BufferGeometry();
const wingVertices = new Float32Array([0, 0, 0, 1.2, 0, -0.2, 0.8, 0.05, 0.5, 0.5, 0.0, 0.8, 0.2, -0.05, 0.4]);
birdWingGeo.setAttribute('position', new THREE.BufferAttribute(wingVertices, 3));
const wingIndices = [0, 1, 2, 0, 2, 4, 2, 3, 4];
const reversedWingIndices = [0, 2, 1, 0, 4, 2, 2, 4, 3];
birdWingGeo.setIndex(wingIndices.concat(reversedWingIndices));
birdWingGeo.addGroup(0, 9, 0); // Blue top
birdWingGeo.addGroup(9, 9, 1); // Yellow bottom
birdWingGeo.computeVertexNormals();

const beakGeo = new THREE.ConeGeometry(0.1, 0.4, 4);

const birdBlueMat = new THREE.MeshLambertMaterial({ color: 0x2196F3, side: THREE.DoubleSide, transparent: true, opacity: 0, fog: false });
const birdYellowMat = new THREE.MeshLambertMaterial({ color: 0xFFEB3B, side: THREE.DoubleSide, transparent: true, opacity: 0, fog: false });
const birdDarkMat = new THREE.MeshLambertMaterial({ color: 0x424242, side: THREE.DoubleSide, transparent: true, opacity: 0, fog: false });
const allBirdMaterials = [birdBlueMat, birdYellowMat, birdDarkMat];

// --- Villager & Village Component Geometries & Materials ---
const villagerSkinMat = new THREE.MeshLambertMaterial({ color: 0xD2A679 });
const villagerEyeMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
const villagerMouthMat = new THREE.MeshLambertMaterial({ color: 0x9c5959 });

const villagerHairMaterials = {
    brown: new THREE.MeshLambertMaterial({ color: 0x5C4033 }),
    black: new THREE.MeshLambertMaterial({ color: 0x1E1E1E }),
    blonde: new THREE.MeshLambertMaterial({ color: 0xD2B48C }),
    grey: new THREE.MeshLambertMaterial({ color: 0x808080 }),
};
const hairColors = Object.keys(villagerHairMaterials);
const flatTopHairGeo = new THREE.BoxGeometry(1.9, 0.5, 1.9);
const sidePartHairGeo = new THREE.BoxGeometry(1.9, 0.5, 1.9);
const bowlCutHairGeo = new THREE.BoxGeometry(2.0, 0.8, 2.0);
const apronGeo = new THREE.BoxGeometry(1.5, 1.8, 0.2);
const beltGeo = new THREE.BoxGeometry(2.1, 0.4, 1.6);
const hatBrimGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.2, 12);
const hatTopGeo = new THREE.CylinderGeometry(1.0, 1.0, 0.8, 12);

const villagerHeadGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8);
const villagerNoseGeo = new THREE.BoxGeometry(0.4, 0.8, 0.6);
const villagerBodyGeo = new THREE.BoxGeometry(2, 2.5, 1.5);
const villagerArmGeo = new THREE.BoxGeometry(0.8, 2.5, 0.8);
const villagerLegGeo = new THREE.BoxGeometry(0.8, 1.5, 1);
const villagerProfessionMaterials = {
    farmer: new THREE.MeshLambertMaterial({ color: 0xDAA520 }), // Brown/Yellow
    librarian: new THREE.MeshLambertMaterial({ color: 0xFFFFFF }), // White
    blacksmith: new THREE.MeshLambertMaterial({ color: 0x36454F }), // Dark Grey
    nitwit: new THREE.MeshLambertMaterial({ color: 0x50C878 }), // Green
};

const woodPlankMat = new THREE.MeshLambertMaterial({ color: 0x8B5A2B });
const woodLogMat = new THREE.MeshLambertMaterial({ color: 0x654321 });
const cobblestoneMat = new THREE.MeshLambertMaterial({ color: 0x808080 });
const farmlandMat = new THREE.MeshLambertMaterial({ color: 0x6B4226 });
const waterMat = new THREE.MeshLambertMaterial({ color: 0x4682B4, transparent: true, opacity: 0.8 });
const cropMat = new THREE.MeshLambertMaterial({ color: 0x00FF00 });

// --- Particle System ---
interface Particle {
    active: boolean;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    size: number;
    startSize: number;
    endSize: number;
    color: THREE.Color;
    startColor: THREE.Color;
    endColor: THREE.Color;
    rotation: number;
    rotationSpeed: number;
}

interface ParticleEmitterOptions {
    position: THREE.Vector3;
    count: number;
    color?: THREE.Color | [THREE.Color, THREE.Color];
    velocity?: THREE.Vector3;
    velocityRandomness?: number;
    size?: number | [number, number];
    life?: number | [number, number];
    gravity?: number;
    rotationSpeed?: number | [number, number];
}

class ParticleSystem {
    private scene: THREE.Scene;
    private particles: Particle[] = [];
    private mesh: THREE.InstancedMesh;
    private dummy = new THREE.Object3D();
    private gravity: number;
    
    constructor(scene: THREE.Scene, count: number, texture: THREE.Texture, gravity: number = 0, blending: THREE.Blending = THREE.AdditiveBlending) {
        this.scene = scene;
        this.gravity = gravity;
        
        const geometry = new THREE.PlaneGeometry(1, 1);
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            blending: blending,
            depthWrite: false,
            transparent: true,
            vertexColors: true
        });

        this.mesh = new THREE.InstancedMesh(geometry, material, count);
        this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
        
        for (let i = 0; i < count; i++) {
            this.particles.push({
                active: false,
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                life: 0,
                maxLife: 1,
                size: 1,
                startSize: 1,
                endSize: 0,
                color: new THREE.Color(),
                startColor: new THREE.Color(),
                endColor: new THREE.Color(),
                rotation: 0,
                rotationSpeed: 0,
            });
        }
        
        this.scene.add(this.mesh);
    }

    emit(options: ParticleEmitterOptions) {
        let created = 0;
        for (let i = 0; i < this.particles.length && created < options.count; i++) {
            if (!this.particles[i].active) {
                this.initParticle(this.particles[i], options);
                created++;
            }
        }
    }

    private initParticle(p: Particle, options: ParticleEmitterOptions) {
        p.active = true;
        p.position.copy(options.position);
        
        const baseVelocity = options.velocity || new THREE.Vector3();
        p.velocity.copy(baseVelocity).add(
            new THREE.Vector3(
                (Math.random() - 0.5),
                (Math.random() - 0.5),
                (Math.random() - 0.5)
            ).multiplyScalar(options.velocityRandomness || 0)
        );

        p.maxLife = Array.isArray(options.life) 
            ? THREE.MathUtils.lerp(options.life[0], options.life[1], Math.random())
            : options.life || 1;
        p.life = p.maxLife;

        const size = Array.isArray(options.size) 
            ? THREE.MathUtils.lerp(options.size[0], options.size[1], Math.random())
            : options.size || 1;
        p.startSize = size;
        p.endSize = 0;
        p.size = p.startSize;
        
        const color = Array.isArray(options.color) 
            ? options.color[0].clone().lerp(options.color[1], Math.random())
            : options.color || new THREE.Color(0xffffff);
        p.startColor.copy(color);
        p.endColor.copy(color);
        p.color.copy(p.startColor);

        p.rotation = Math.random() * Math.PI * 2;
        p.rotationSpeed = Array.isArray(options.rotationSpeed) 
            ? THREE.MathUtils.lerp(options.rotationSpeed[0], options.rotationSpeed[1], Math.random())
            : options.rotationSpeed || 0;
    }

    update(delta: number, camera: THREE.Camera) {
        let colorNeedsUpdate = false;
        let matrixNeedsUpdate = false;

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];
            if (!p.active) continue;

            p.life -= delta;
            if (p.life <= 0) {
                p.active = false;
                this.dummy.scale.set(0, 0, 0);
                this.mesh.setMatrixAt(i, this.dummy.matrix);
                matrixNeedsUpdate = true;
                continue;
            }

            p.velocity.y -= (this.gravity) * delta;
            p.position.add(p.velocity.clone().multiplyScalar(delta));

            const lifeRatio = p.life / p.maxLife;
            p.size = THREE.MathUtils.lerp(p.endSize, p.startSize, lifeRatio);
            p.color.copy(p.startColor).lerp(p.endColor, 1 - lifeRatio);
            p.rotation += p.rotationSpeed * delta;
            
            this.dummy.position.copy(p.position);
            this.dummy.scale.set(p.size, p.size, p.size);
            this.dummy.rotation.setFromQuaternion(camera.quaternion); // Billboard
            this.dummy.rotateZ(p.rotation);

            this.mesh.setMatrixAt(i, this.dummy.matrix);
            this.mesh.setColorAt(i, p.color);
            colorNeedsUpdate = true;
            matrixNeedsUpdate = true;
        }

        if (matrixNeedsUpdate) this.mesh.instanceMatrix.needsUpdate = true;
        if (colorNeedsUpdate) this.mesh.instanceColor!.needsUpdate = true;
    }
    
    dispose() {
        this.mesh.geometry.dispose();
        (this.mesh.material as THREE.Material).dispose();
        this.scene.remove(this.mesh);
    }
}

const createBirdInstance = (): THREE.Group => {
    const bird = new THREE.Group();
    const body = new THREE.Mesh(birdBodyGeo, [birdBlueMat, birdYellowMat]);
    bird.add(body);
    const beak = new THREE.Mesh(beakGeo, birdDarkMat);
    beak.position.set(0, 0.1, -0.5);
    beak.rotation.x = Math.PI / 2;
    bird.add(beak);
    const leftWing = new THREE.Group();
    leftWing.position.set(-0.2, 0.1, 0);
    const leftWingMesh = new THREE.Mesh(birdWingGeo, [birdBlueMat, birdYellowMat]);
    leftWing.add(leftWingMesh);
    bird.add(leftWing);
    const rightWing = new THREE.Group();
    rightWing.position.set(0.2, 0.1, 0);
    const rightWingMesh = new THREE.Mesh(birdWingGeo, [birdBlueMat, birdYellowMat]);
    rightWingMesh.scale.x = -1;
    rightWing.add(rightWingMesh);
    bird.add(rightWing);
    bird.userData.leftWing = leftWing;
    bird.userData.rightWing = rightWing;
    bird.scale.set(1.5, 1.5, 1.5);
    return bird;
};

const createVillager = (profession: VillagerProfession, seed: number): THREE.Group => {
    const villager = new THREE.Group();
    
    const baseRobeMat = villagerProfessionMaterials[profession].clone();
    const hsl = { h: 0, s: 0, l: 0 };
    baseRobeMat.color.getHSL(hsl);
    hsl.l += (pseudoRandom(seed * 3) - 0.5) * 0.1; // +/- 5% lightness
    baseRobeMat.color.setHSL(hsl.h, hsl.s, Math.max(0.1, Math.min(0.9, hsl.l)));
    
    const body = new THREE.Mesh(villagerBodyGeo, baseRobeMat);
    body.position.y = 1.5 + 1.25;
    body.castShadow = true;
    villager.add(body);
    
    const headGroup = new THREE.Group();
    headGroup.position.y = 4.9;
    
    const head = new THREE.Mesh(villagerHeadGeo, villagerSkinMat);
    head.castShadow = true;
    headGroup.add(head);
    
    const nose = new THREE.Mesh(villagerNoseGeo, villagerSkinMat);
    nose.position.set(0, -0.2, 1);
    head.add(nose);
    
    const eyeGeo = new THREE.BoxGeometry(0.25, 0.25, 0.1);
    const leftEye = new THREE.Mesh(eyeGeo, villagerEyeMat);
    leftEye.position.set(-0.5, 0.3, 0.95);
    head.add(leftEye);
    const rightEye = leftEye.clone();
    rightEye.position.x = 0.5;
    head.add(rightEye);
    
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.1), villagerMouthMat);
    mouth.position.set(0, -0.6, 0.95);
    head.add(mouth);

    const hairStyleRand = pseudoRandom(seed * 5);
    const hairColorKey = hairColors[Math.floor(pseudoRandom(seed * 7) * hairColors.length)] as keyof typeof villagerHairMaterials;
    const hairMat = villagerHairMaterials[hairColorKey];
    let hair: THREE.Mesh | null = null;
    if (hairStyleRand < 0.4) {
        hair = new THREE.Mesh(flatTopHairGeo, hairMat);
        hair.position.y = 1.15;
    } else if (hairStyleRand < 0.7) {
        hair = new THREE.Mesh(sidePartHairGeo, hairMat);
        hair.position.set(0.1, 1.15, 0);
    } else if (hairStyleRand < 0.9) {
        hair = new THREE.Mesh(bowlCutHairGeo, hairMat);
        hair.position.y = 0.7;
    }
    if (hair) head.add(hair);

    villager.add(headGroup);

    if (profession === 'blacksmith') {
        const apron = new THREE.Mesh(apronGeo, new THREE.MeshLambertMaterial({ color: 0x4B3A26 }));
        apron.position.set(0, 3.5, 0.8);
        villager.add(apron);
    } else if (profession === 'librarian') {
        const belt = new THREE.Mesh(beltGeo, new THREE.MeshLambertMaterial({ color: 0x654321 }));
        belt.position.y = 3.2;
        villager.add(belt);
    } else if (profession === 'farmer') {
        if (pseudoRandom(seed*11) > 0.4) {
            const hat = new THREE.Group();
            const brim = new THREE.Mesh(hatBrimGeo, new THREE.MeshLambertMaterial({ color: 0xE6BF83 }));
            const top = new THREE.Mesh(hatTopGeo, new THREE.MeshLambertMaterial({ color: 0xD2A679 }));
            top.position.y = 0.5;
            hat.add(brim);
            hat.add(top);
            hat.position.y = 1.0;
            head.add(hat);
        }
    }

    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-1.4, 4.0, 0);
    const leftArm = new THREE.Mesh(villagerArmGeo, baseRobeMat);
    leftArm.castShadow = true;
    leftArm.position.y = -1.25;
    leftArmGroup.add(leftArm);
    villager.add(leftArmGroup);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(1.4, 4.0, 0);
    const rightArm = new THREE.Mesh(villagerArmGeo, baseRobeMat);
    rightArm.castShadow = true;
    rightArm.position.y = -1.25;
    rightArmGroup.add(rightArm);
    villager.add(rightArmGroup);

    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.5, 1.5, 0);
    const leftLeg = new THREE.Mesh(villagerLegGeo, baseRobeMat);
    leftLeg.castShadow = true;
    leftLeg.position.y = -0.75;
    leftLegGroup.add(leftLeg);
    villager.add(leftLegGroup);

    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.5, 1.5, 0);
    const rightLeg = new THREE.Mesh(villagerLegGeo, baseRobeMat);
    rightLeg.castShadow = true;
    rightLeg.position.y = -0.75;
    rightLegGroup.add(rightLeg);
    villager.add(rightLegGroup);
    
    villager.userData.leftArm = leftArmGroup;
    villager.userData.rightArm = rightArmGroup;
    villager.userData.leftLeg = leftLegGroup;
    villager.userData.rightLeg = rightLegGroup;
    villager.userData.headGroup = headGroup;

    return villager;
};

const createHouse = (seed: number): THREE.Group => {
    const house = new THREE.Group();
    const width = 5 + pseudoRandom(seed++) * 2;
    const depth = 6 + pseudoRandom(seed++) * 3;
    const height = 4;

    // Floor
    const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.2, depth), woodPlankMat);
    floor.position.y = 0.1;
    floor.receiveShadow = true;
    house.add(floor);
    
    // Walls
    const wallGeo = new THREE.BoxGeometry(1, height, 1);
    for (let x = -width/2; x <= width/2; x++) {
        for (let z = -depth/2; z <= depth/2; z++) {
            if (x === -width/2 || x === width/2 || z === -depth/2 || z === depth/2) {
                // Skip door
                if (z === depth/2 && x > -1.5 && x < 1.5) continue;
                
                const wall = new THREE.Mesh(wallGeo, woodPlankMat);
                wall.position.set(x, height/2, z);
                wall.castShadow = true;
                house.add(wall);
            }
        }
    }
    
    // Roof
    const roofPitch = 0.6;
    for (let z = -depth/2 - 0.5; z <= depth/2 + 0.5; z++) {
        for (let x = -width/2 - 0.5; x <= width/2 + 0.5; x++) {
            const roofBlock = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 1), cobblestoneMat);
            const yPos = height + (width/2 - Math.abs(x)) * roofPitch;
            roofBlock.position.set(x, yPos, z);
            roofBlock.castShadow = true;
            house.add(roofBlock);
        }
    }
    
    house.userData.interiorPoint = new THREE.Vector3(0, 1, -1);
    return house;
}

const createFarmPlot = (seed: number): THREE.Group => {
    const farm = new THREE.Group();
    const width = 4 + Math.floor(pseudoRandom(seed++) * 3);
    const depth = 6 + Math.floor(pseudoRandom(seed++) * 4);
    
    const fencePostGeo = new THREE.BoxGeometry(0.3, 1.5, 0.3);
    const fenceRailGeo = new THREE.BoxGeometry(1, 0.2, 0.2);

    for (let x = -width/2; x <= width/2; x++) {
        for (let z = -depth/2; z <= depth/2; z++) {
            if (x === -width/2 || x === width/2 || z === -depth/2 || z === depth/2) {
                const post = new THREE.Mesh(fencePostGeo, woodLogMat);
                post.position.set(x, 0.75, z);
                post.castShadow = true;
                farm.add(post);
            }
        }
    }

    const farmPlots: THREE.Vector3[] = [];
    for (let x = -width/2 + 1; x < width/2 - 1; x++) {
        for (let z = -depth/2 + 1; z < depth/2 - 1; z++) {
            const blockType = pseudoRandom(seed + x*17 + z*31);
            let block;
            if (blockType < 0.2) { // Water
                block = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), waterMat);
                block.position.y = -0.1;
            } else { // Farmland
                block = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), farmlandMat);
                block.position.y = -0.1;
                const crop = new THREE.Mesh(new THREE.BoxGeometry(0.5, pseudoRandom(seed+z*5+x*3)*0.8+0.2, 0.5), cropMat);
                crop.position.y = 0.4;
                block.add(crop);
                farmPlots.push(new THREE.Vector3(x, 0.5, z));
            }
            block.position.x = x;
            block.position.z = z;
            farm.add(block);
        }
    }
    farm.userData.workPoints = farmPlots;
    return farm;
}

const createWell = (seed: number): THREE.Group => {
    const well = new THREE.Group();
    const baseGeo = new THREE.BoxGeometry(3, 1, 3);
    const base = new THREE.Mesh(baseGeo, cobblestoneMat);
    base.position.y = 0.5;
    well.add(base);

    const water = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 2), waterMat);
    water.position.y = 0.6;
    well.add(water);

    const postGeo = new THREE.BoxGeometry(0.4, 3, 0.4);
    const leftPost = new THREE.Mesh(postGeo, woodLogMat);
    leftPost.position.set(-1.2, 2.5, 0);
    well.add(leftPost);
    const rightPost = leftPost.clone();
    rightPost.position.x = 1.2;
    well.add(rightPost);

    const roofGeo = new THREE.BoxGeometry(3.5, 0.4, 3.5);
    const roof = new THREE.Mesh(roofGeo, woodPlankMat);
    roof.position.y = 4.2;
    well.add(roof);

    return well;
}

// --- Dynamic Sky Element Creators ---
const createStars = (): THREE.Points => {
  const starVertices = [];
  for (let i = 0; i < 10000; i++) {
    const x = THREE.MathUtils.randFloatSpread(2000);
    const y = THREE.MathUtils.randFloatSpread(2000);
    const z = THREE.MathUtils.randFloatSpread(2000);
    if (Math.sqrt(x*x + y*y + z*z) > 500) {
        starVertices.push(x, y, z);
    }
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
  const starMaterial = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 1.5,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    fog: false
  });
  return new THREE.Points(starGeometry, starMaterial);
};

const createMoon = (): THREE.Mesh => {
    const moonGeometry = new THREE.SphereGeometry(5, 32, 32);
    const moonTexture = createMoonTexture();
    const moonMaterial = new THREE.MeshStandardMaterial({
        map: moonTexture,
        transparent: true,
        opacity: 0,
        fog: false,
        roughness: 0.7,
        metalness: 0.0
    });
    const moon = new THREE.Mesh(moonGeometry, moonMaterial);
    moon.layers.set(MOON_LAYER);
    return moon;
};

const createSun = (): THREE.Mesh => {
    const sunGeometry = new THREE.SphereGeometry(7.5, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xffddaa,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        fog: false
    });
    return new THREE.Mesh(sunGeometry, sunMaterial);
};

const createClouds = (): THREE.Group => {
    const cloudGroup = new THREE.Group();
    const cloudTexture = createCloudTexture();
    const cloudMaterial = new THREE.MeshLambertMaterial({
        map: cloudTexture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false
    });

    for (let i = 0; i < 25; i++) {
        const cloudPlane = new THREE.Mesh(new THREE.PlaneGeometry(128, 128), cloudMaterial.clone());
        cloudPlane.position.set(
            THREE.MathUtils.randFloatSpread(1000),
            100 + THREE.MathUtils.randFloat(-10, 10),
            THREE.MathUtils.randFloatSpread(1000)
        );
        cloudPlane.rotation.x = -Math.PI / 2;
        cloudPlane.rotation.z = Math.random() * Math.PI;
        (cloudPlane as any).userData.velocity = new THREE.Vector3(Math.random() * 5 + 2, 0, 0);
        cloudGroup.add(cloudPlane);
    }
    return cloudGroup;
};

interface CharacterHandles {
  group: THREE.Group;
  materials: {
    skin: THREE.MeshLambertMaterial;
    hair: THREE.MeshLambertMaterial;
    eyeWhite: THREE.MeshLambertMaterial;
    eyeBlue: THREE.MeshLambertMaterial;
    nose: THREE.MeshLambertMaterial;
    shirt: THREE.MeshLambertMaterial;
    pantsLight: THREE.MeshLambertMaterial;
    pantsDark: THREE.MeshLambertMaterial;
    shoes: THREE.MeshLambertMaterial;
  };
  hairContainer: THREE.Group;
  hairStyles: {
    [key: string]: THREE.Group;
  };
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  headGroup: THREE.Group;
  neckGroup: THREE.Group;
}

const createCharacter = (appearance: CharacterAppearance): CharacterHandles => {
  const character = new THREE.Group();
  
  const skinMat = new THREE.MeshLambertMaterial({ color: appearance.skinColor });
  const hairMat = new THREE.MeshLambertMaterial({ color: appearance.hairColor });
  const shirtMat = new THREE.MeshLambertMaterial({ color: appearance.shirtColor });
  const pantsLightMat = new THREE.MeshLambertMaterial({ color: appearance.pantsColor });

  const darkPantsColor = new THREE.Color();
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(appearance.pantsColor).getHSL(hsl);
  darkPantsColor.setHSL(hsl.h, hsl.s, hsl.l * 0.7);
  const pantsDarkMat = new THREE.MeshLambertMaterial({ color: darkPantsColor });

  const eyeWhiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
  const eyeBlueMat = new THREE.MeshLambertMaterial({ color: 0x4169E1 });
  const noseMat = new THREE.MeshLambertMaterial({ color: 0xC19A6B });
  const shoesMat = new THREE.MeshLambertMaterial({ color: 0x2C3E50 });

  const neckGroup = new THREE.Group();
  neckGroup.name = 'neckGroup';
  neckGroup.position.y = 5.5;

  const headGroup = new THREE.Group();
  headGroup.name = 'headGroup';
  headGroup.position.y = 1;

  const headGeo = new THREE.BoxGeometry(2, 2, 2);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.castShadow = true;
  headGroup.add(head);

  const hairContainer = new THREE.Group();
  headGroup.add(hairContainer);

  const standardHair = new THREE.Group();
  const hairGeo = new THREE.BoxGeometry(2.1, 0.4, 2.1);
  const hairTop = new THREE.Mesh(hairGeo, hairMat);
  hairTop.position.y = 1.2;
  standardHair.add(hairTop);
  const hairSideGeo = new THREE.BoxGeometry(2.1, 1, 0.3);
  const hairBack = new THREE.Mesh(hairSideGeo, hairMat);
  hairBack.position.set(0, 0.5, -1.05);
  standardHair.add(hairBack);
  const mustache = new THREE.Mesh(new THREE.BoxGeometry(1, 0.3, 0.2), hairMat);
  mustache.position.set(0, -0.6, 1.1);
  standardHair.add(mustache);

  const longHair = new THREE.Group();
  const longHairTop = hairTop.clone();
  longHair.add(longHairTop);
  const longHairBack = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.5, 0.3), hairMat);
  longHairBack.position.set(0, -0.25, -1.05);
  longHair.add(longHairBack);
  
  const baldHair = new THREE.Group();

  const hairStyles = { standard: standardHair, long: longHair, bald: baldHair };
  if (hairStyles[appearance.hairStyle]) {
      hairContainer.add(hairStyles[appearance.hairStyle]);
  }

  const leftEyeWhite = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.1), eyeWhiteMat);
  leftEyeWhite.position.set(-0.5, 0.1, 1.05);
  headGroup.add(leftEyeWhite);
  const rightEyeWhite = leftEyeWhite.clone();
  rightEyeWhite.position.x = 0.5;
  headGroup.add(rightEyeWhite);

  const leftEyeBlue = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.1), eyeBlueMat);
  leftEyeBlue.position.set(-0.5, 0.1, 1.1);
  headGroup.add(leftEyeBlue);
  const rightEyeBlue = leftEyeBlue.clone();
  rightEyeBlue.position.x = 0.5;
  headGroup.add(rightEyeBlue);

  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), noseMat);
  nose.position.set(0, -0.3, 1.1);
  headGroup.add(nose);
  
  neckGroup.add(headGroup);
  character.add(neckGroup);
  
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 1), shirtMat);
  body.position.y = 4;
  body.castShadow = true;
  character.add(body);

  const armGeo = new THREE.BoxGeometry(1, 3, 1);
  
  const leftArmGroup = new THREE.Group();
  leftArmGroup.position.set(-1.5, 5.5, 0);
  const leftArm = new THREE.Mesh(armGeo, skinMat);
  leftArm.position.y = -1.5;
  leftArm.castShadow = true;
  leftArmGroup.add(leftArm);
  character.add(leftArmGroup);

  const rightArmGroup = new THREE.Group();
  rightArmGroup.position.set(1.5, 5.5, 0);
  const rightArm = new THREE.Mesh(armGeo, skinMat);
  rightArm.position.y = -1.5;
  rightArm.castShadow = true;
  rightArmGroup.add(rightArm);
  character.add(rightArmGroup);
  
  const legGeo = new THREE.BoxGeometry(1, 3, 1);
  const footGeo = new THREE.BoxGeometry(1, 0.5, 1.2);

  const leftLegGroup = new THREE.Group();
  leftLegGroup.position.set(-0.5, 2.5, 0);
  const leftLeg = new THREE.Mesh(legGeo, pantsDarkMat);
  leftLeg.position.y = -1.5;
  leftLeg.castShadow = true;
  const leftFoot = new THREE.Mesh(footGeo, shoesMat);
  leftFoot.position.set(0, -1.75, 0.1);
  leftFoot.castShadow = true;
  leftLeg.add(leftFoot);
  leftLegGroup.add(leftLeg);
  character.add(leftLegGroup);
  
  const rightLegGroup = new THREE.Group();
  rightLegGroup.position.set(0.5, 2.5, 0);
  const rightLeg = new THREE.Mesh(legGeo, pantsLightMat);
  rightLeg.position.y = -1.5;
  rightLeg.castShadow = true;
  const rightFoot = new THREE.Mesh(footGeo, shoesMat);
  rightFoot.position.set(0, -1.75, 0.1);
  rightFoot.castShadow = true;
  rightLeg.add(rightFoot);
  rightLegGroup.add(rightLeg);
  character.add(rightLegGroup);

  return {
    group: character,
    materials: { skin: skinMat, hair: hairMat, eyeWhite: eyeWhiteMat, eyeBlue: eyeBlueMat, nose: noseMat, shirt: shirtMat, pantsLight: pantsLightMat, pantsDark: pantsDarkMat, shoes: shoesMat },
    hairContainer,
    hairStyles,
    leftArm: leftArmGroup,
    rightArm: rightArmGroup,
    leftLeg: leftLegGroup,
    rightLeg: rightLegGroup,
    headGroup,
    neckGroup,
  };
};

const createDog = (): THREE.Group => {
  const dog = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xCCCCCC });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 2), bodyMat);
  body.position.y = 1.5;
  body.castShadow = true;
  dog.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1), bodyMat);
  head.position.set(0, 1.8, 1.2);
  head.castShadow = true;
  dog.add(head);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.4), new THREE.MeshLambertMaterial({ color: 0x333333 }));
  nose.position.set(0, 1.6, 1.9);
  dog.add(nose);
  const eyeGeo = new THREE.BoxGeometry(0.2, 0.2, 0.1);
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.3, 2, 1.7);
  dog.add(leftEye);
  const rightEye = leftEye.clone();
  rightEye.position.x = 0.3;
  dog.add(rightEye);
  const earGeo = new THREE.BoxGeometry(0.4, 0.6, 0.2);
  const leftEar = new THREE.Mesh(earGeo, bodyMat);
  leftEar.position.set(-0.5, 2.3, 1.2);
  dog.add(leftEar);
  const rightEar = leftEar.clone();
  rightEar.position.x = 0.5;
  dog.add(rightEar);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.3, 16), new THREE.MeshLambertMaterial({ color: 0xFF0000 }));
  collar.position.set(0, 1.7, 0.7);
  collar.rotation.z = Math.PI / 2;
  dog.add(collar);
  const legGeo = new THREE.BoxGeometry(0.5, 1.2, 0.5);
  const positions: [number, number, number][] = [[-0.5, 0.6, 0.5], [0.5, 0.6, 0.5], [-0.5, 0.6, -0.5], [0.5, 0.6, -0.5]];
  positions.forEach(pos => {
    const leg = new THREE.Mesh(legGeo, bodyMat);
    leg.position.set(...pos);
    leg.castShadow = true;
    dog.add(leg);
  });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 1), bodyMat);
  tail.position.set(0, 2, -1.2);
  tail.rotation.x = -0.5;
  tail.castShadow = true;
  dog.add(tail);
  return dog;
};

const pseudoRandom = (seed: number) => {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
};

// Simple Noise function for flora density
const createNoise2D = (seed: number) => {
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
const floraNoise = createNoise2D(12345);


// --- Terrain Generation ---
const getHeight = (x: number, z: number): number => {
    const scale = 80;
    const roughness = 0.6;
    const amplitude = 15;
    let height = Math.sin(x / scale) * Math.cos(z / scale) * amplitude;
    height += (Math.sin(x / (scale * 0.5)) * Math.cos(z / (scale * 0.5))) * amplitude * roughness;
    return height;
};

const createNest = (): THREE.Group => {
    const nest = new THREE.Group();
    const radius = 0.8;
    const height = 0.5;
    for (let i = 0; i < 20; i++) {
        const twig = new THREE.Mesh(nestTwigGeo, nestMaterial);
        const angle = Math.random() * Math.PI * 2;
        const y = (Math.random() - 0.5) * height;
        twig.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
        twig.rotation.y = angle + Math.PI / 2 + (Math.random() - 0.5) * 0.5;
        twig.rotation.z = (Math.random() - 0.5) * 0.2;
        twig.rotation.x = (Math.random() - 0.5) * 0.2;
        twig.castShadow = true;
        nest.add(twig);
    }
    return nest;
};

const createTree = (x: number, z: number, seed: number): THREE.Group => {
  const tree = new THREE.Group();
  const trunkHeight = 5 + pseudoRandom(seed + 1) * 4;
  tree.userData.height = trunkHeight;
  const trunkWidth = 0.9 + pseudoRandom(seed + 2) * 0.4;
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(trunkWidth, trunkHeight, trunkWidth), trunkMat);
  trunk.position.y = trunkHeight / 2;
  trunk.castShadow = true;
  tree.add(trunk);
  const leafPositions: THREE.Vector3[] = [];
  const canopyBaseY = trunkHeight - 2;
  const canopyHeight = 3 + pseudoRandom(seed + 3) * 2;
  const canopyRadius = 2 + pseudoRandom(seed + 4) * 1.5;
  for (let y = canopyBaseY; y < canopyBaseY + canopyHeight; y += 1) {
      for (let lx = -canopyRadius; lx <= canopyRadius; lx += 1) {
          for (let lz = -canopyRadius; lz <= canopyRadius; lz += 1) {
              const dist = Math.sqrt(lx*lx + lz*lz + Math.pow((y - canopyBaseY - canopyHeight/2) * 1.5, 2));
              if (dist < canopyRadius && pseudoRandom(seed + lx*13 + y*31 + lz*53) > 0.2) {
                  leafPositions.push(new THREE.Vector3(lx, y, lz));
              }
          }
      }
  }
  if (leafPositions.length > 0) {
    const instancedLeaves = new THREE.InstancedMesh(leafGeometry, leafMaterial, leafPositions.length);
    instancedLeaves.castShadow = true;
    instancedLeaves.receiveShadow = true;
    const dummy = new THREE.Object3D();
    leafPositions.forEach((pos, i) => {
      dummy.position.copy(pos);
      dummy.updateMatrix();
      instancedLeaves.setMatrixAt(i, dummy.matrix);
    });
    instancedLeaves.instanceMatrix.needsUpdate = true;
    tree.add(instancedLeaves);

    if (pseudoRandom(seed + 57) < NEST_CHANCE && leafPositions.length > 5) {
      const nest = createNest();
      const suitableLeaves = leafPositions.filter(p => p.y > canopyBaseY + 1 && p.y < canopyBaseY + canopyHeight - 1);
      const targetLeafPos = suitableLeaves.length > 0
          ? suitableLeaves[Math.floor(pseudoRandom(seed + 61) * suitableLeaves.length)]
          : leafPositions[Math.floor(pseudoRandom(seed + 61) * leafPositions.length)];
      
      nest.position.copy(targetLeafPos);
      nest.position.y += 0.5;
      tree.add(nest);
      tree.userData.nest = nest;
    }
  }
  tree.position.set(x, 0, z);
  return tree;
};

const createBush = (x: number, z: number, seed: number): THREE.Group => {
    const bush = new THREE.Group();
    const leafPositions: THREE.Vector3[] = [];
    const size = 1 + pseudoRandom(seed) * 1.5;
    for (let i = 0; i < 5 + pseudoRandom(seed + 1) * 5; i++) {
        leafPositions.push(new THREE.Vector3(
            (pseudoRandom(seed + i * 2) - 0.5) * size,
            (pseudoRandom(seed + i * 3) - 0.3) * size * 0.5,
            (pseudoRandom(seed + i * 5) - 0.5) * size
        ));
    }

    if (leafPositions.length > 0) {
        const instancedLeaves = new THREE.InstancedMesh(bushLeafGeo, leafMaterial, leafPositions.length);
        instancedLeaves.castShadow = true;
        const dummy = new THREE.Object3D();
        leafPositions.forEach((pos, i) => {
            dummy.position.copy(pos);
            dummy.updateMatrix();
            instancedLeaves.setMatrixAt(i, dummy.matrix);
        });
        instancedLeaves.instanceMatrix.needsUpdate = true;
        bush.add(instancedLeaves);
    }
    bush.position.set(x, 0.5, z);
    return bush;
};

const findNewLandingSpot = (tree: THREE.Group): THREE.Vector3 => {
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

// --- Gun Creation ---
const createGunLibrary = () => {
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.8 });
  const wood = new THREE.MeshLambertMaterial({ color: 0x654321 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.2, metalness: 1.0 });

  const guns = [
    { name: "Pistol", fireRate: 0.2, model: new THREE.Group() },
    { name: "SMG", fireRate: 0.08, model: new THREE.Group() },
    { name: "Shotgun", fireRate: 1.0, model: new THREE.Group() },
    { name: "Rifle", fireRate: 0.5, model: new THREE.Group() },
    { name: "Sniper", fireRate: 1.5, model: new THREE.Group() },
    { name: "Revolver", fireRate: 0.6, model: new THREE.Group() },
    { name: "LMG", fireRate: 0.1, model: new THREE.Group() },
    { name: "Golden Gun", fireRate: 0.3, model: new THREE.Group() },
    { name: "Blaster", fireRate: 0.4, model: new THREE.Group() },
  ];

  // Pistol
  const pistolBody = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.8), darkMetal);
  const pistolGrip = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.3), darkMetal);
  pistolGrip.position.set(0, -0.3, 0.2);
  pistolGrip.rotation.x = 0.2;
  guns[0].model.add(pistolBody, pistolGrip);
  
  // SMG
  const smgBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 1.2), darkMetal);
  const smgGrip = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.7, 0.3), darkMetal);
  smgGrip.position.set(0, -0.3, 0.2);
  const smgStock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.8), darkMetal);
  smgStock.position.set(0, 0, 0.9);
  guns[1].model.add(smgBody, smgGrip, smgStock);

  // Shotgun
  const sgBody = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 2.5), wood);
  sgBody.position.z = 0.5;
  const sgBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2, 8), darkMetal);
  sgBarrel.rotation.x = Math.PI / 2;
  sgBarrel.position.set(0, 0.1, 0.2);
  guns[2].model.add(sgBody, sgBarrel);

  // Rifle
  const rifleBody = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 2), wood);
  const rifleBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.5, 8), darkMetal);
  rifleBarrel.rotation.x = Math.PI / 2;
  rifleBarrel.position.set(0, 0, -1.2);
  guns[3].model.add(rifleBody, rifleBarrel);

  // Copy models for remaining guns for now
  guns[4].model = guns[3].model.clone(); // Sniper
  guns[5].model = guns[0].model.clone(); // Revolver
  guns[6].model = guns[1].model.clone(); // LMG
  guns[7].model = guns[0].model.clone(); // Golden Gun
  guns[7].model.traverse(c => { if(c instanceof THREE.Mesh) c.material = gold; });
  guns[8].model = guns[1].model.clone(); // Blaster

  guns.forEach(gun => {
      gun.model.position.set(0.6, -1.2, 0.5);
      gun.model.rotation.y = -0.2;
      gun.model.scale.set(0.8, 0.8, 0.8);
  });

  return guns;
};


interface MinecraftSceneProps {
  move: MoveVector;
  isJumping: boolean;
  onJumpEnd: () => void;
  cameraMode: CameraMode;
  characterAppearance: CharacterAppearance;
  onCameraToggle: () => void;
  interacted: boolean;
  sfxVolume: number;
  musicVolume: number;
  isMuted: boolean;
  currentWeaponIndex: number | null;
  onWeaponSwitch: (index: number | null) => void;
  showDebugView: boolean;
  onToggleDebugView: () => void;
}

const MinecraftScene: React.FC<MinecraftSceneProps> = (props) => {
  const { move, isJumping, onJumpEnd, cameraMode, characterAppearance, onCameraToggle, interacted, sfxVolume, musicVolume, isMuted, currentWeaponIndex, onWeaponSwitch, showDebugView, onToggleDebugView } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const birdsRef = useRef<THREE.Group[]>([]);
  const villagersRef = useRef<THREE.Group[]>([]);
  const characterHandlesRef = useRef<CharacterHandles | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const debugCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  
  const audioListenerRef = useRef<THREE.AudioListener | null>(null);
  const windGainRef = useRef<GainNode | null>(null);
  const sfxGainRef = useRef<GainNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const birdChirpBufferRef = useRef<AudioBuffer | null>(null);
  const villageSoundsBufferRef = useRef<AudioBuffer | null>(null);
  const gunshotBufferRef = useRef<AudioBuffer | null>(null);
  
  const gunLibrary = useMemo(() => createGunLibrary(), []);
  const currentWeaponRef = useRef<THREE.Group | null>(null);
  const lastShotTimeRef = useRef(0);
  const activeTracersRef = useRef<THREE.Line[]>([]);


  const moveRef = useRef(move);
  const isJumpingRef = useRef(isJumping);
  const onJumpEndRef = useRef(onJumpEnd);
  const cameraModeRef = useRef(cameraMode);
  const onCameraToggleRef = useRef(onCameraToggle);
  const onWeaponSwitchRef = useRef(onWeaponSwitch);
  const currentWeaponIndexRef = useRef(currentWeaponIndex);
  const onToggleDebugViewRef = useRef(onToggleDebugView);
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    moveRef.current = move;
    isJumpingRef.current = isJumping;
    onJumpEndRef.current = onJumpEnd;
    cameraModeRef.current = cameraMode;
    onCameraToggleRef.current = onCameraToggle;
    onWeaponSwitchRef.current = onWeaponSwitch;
    currentWeaponIndexRef.current = currentWeaponIndex;
    onToggleDebugViewRef.current = onToggleDebugView;
  }, [move, isJumping, onJumpEnd, cameraMode, onCameraToggle, currentWeaponIndex, onWeaponSwitch, onToggleDebugView]);

   useEffect(() => {
    if (sfxGainRef.current) sfxGainRef.current.gain.setTargetAtTime(sfxVolume, sfxGainRef.current.context.currentTime, 0.1);
  }, [sfxVolume]);

  useEffect(() => {
    if (musicGainRef.current) musicGainRef.current.gain.setTargetAtTime(musicVolume, musicGainRef.current.context.currentTime, 0.1);
  }, [musicVolume]);

  useEffect(() => {
    if (audioListenerRef.current) {
      audioListenerRef.current.setMasterVolume(isMuted ? 0 : 1);
    }
  }, [isMuted]);

  useEffect(() => {
    if (interacted) {
        if (audioListenerRef.current && audioListenerRef.current.context.state === 'suspended') {
            audioListenerRef.current.context.resume().catch(e => console.error("Audio context could not be resumed:", e));
        }
    }
  }, [interacted]);

  useEffect(() => {
    if (!characterHandlesRef.current) return;

    const { materials, hairContainer, hairStyles } = characterHandlesRef.current;
    
    materials.skin.color.set(characterAppearance.skinColor);
    materials.hair.color.set(characterAppearance.hairColor);
    materials.shirt.color.set(characterAppearance.shirtColor);
    materials.pantsLight.color.set(characterAppearance.pantsColor);
    
    const darkPantsColor = new THREE.Color();
    const hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(characterAppearance.pantsColor).getHSL(hsl);
    darkPantsColor.setHSL(hsl.h, hsl.s, hsl.l * 0.7);
    materials.pantsDark.color.copy(darkPantsColor);
    
    while(hairContainer.children.length > 0){ 
      hairContainer.remove(hairContainer.children[0]); 
    }
    const newHairStyle = hairStyles[characterAppearance.hairStyle];
    if (newHairStyle) {
      hairContainer.add(newHairStyle);
    }
  }, [characterAppearance]);

  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    let animationFrameId: number;
    const playerVelocity = new THREE.Vector3();
    let isOnGround = true;
    const activeChunks = new Map<string, THREE.Group>();
    const activeVillages = new Map<string, THREE.Group>();
    let lastPlayerChunk: { x: number, z: number } | null = null;
    
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x000000, CHUNK_SIZE * (RENDER_DISTANCE_IN_CHUNKS), CHUNK_SIZE * (RENDER_DISTANCE_IN_CHUNKS + 3));

    const thirdPersonCamera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 2000);
    const firstPersonCamera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 2000);
    thirdPersonCamera.layers.enable(MOON_LAYER);
    firstPersonCamera.layers.enable(MOON_LAYER);
    const debugCamera = new THREE.PerspectiveCamera(40, 1, 0.1, 1000);
    debugCameraRef.current = debugCamera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 0.0);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 150;
    const shadowCamSize = 50;
    sunLight.shadow.camera.left = -shadowCamSize;
    sunLight.shadow.camera.right = shadowCamSize;
    sunLight.shadow.camera.top = shadowCamSize;
    sunLight.shadow.camera.bottom = -shadowCamSize;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const moonLight = new THREE.SpotLight(0x8090b0, 0, 1000, Math.PI / 4, 0.5, 1);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 512;
    moonLight.shadow.mapSize.height = 512;
    moonLight.shadow.camera.near = 50;
    moonLight.shadow.camera.far = 200;
    scene.add(moonLight);
    scene.add(moonLight.target);

    const moonIlluminationLight = new THREE.DirectionalLight(0xffffff, 1.2);
    moonIlluminationLight.layers.set(MOON_LAYER);
    scene.add(moonIlluminationLight);

    const handles = createCharacter(characterAppearance);
    characterHandlesRef.current = handles;
    const character = handles.group;
    const startY = getHeight(0, 5) + 1;
    character.position.set(0, startY, 5);
    scene.add(character);

    currentWeaponRef.current = new THREE.Group();
    handles.rightArm.add(currentWeaponRef.current);
    
    const listener = new THREE.AudioListener();
    audioListenerRef.current = listener;
    handles.neckGroup.add(listener);

    // --- Particle Systems ---
    const particleTexture = createParticleTexture();
    const dustSystem = new ParticleSystem(scene, 100, particleTexture, 0, THREE.NormalBlending);
    const sparkSystem = new ParticleSystem(scene, 100, particleTexture, 10.0, THREE.AdditiveBlending);

    // --- Audio Graph Setup ---
    const audioContext = listener.context;
    sfxGainRef.current = audioContext.createGain();
    sfxGainRef.current.gain.value = sfxVolume;
    sfxGainRef.current.connect(listener.getInput());

    musicGainRef.current = audioContext.createGain();
    musicGainRef.current.gain.value = musicVolume;
    musicGainRef.current.connect(listener.getInput());

    const windNode = audioContext.createBufferSource();
    const bufferSize = audioContext.sampleRate * 2;
    const windBuffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    const windData = windBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) { windData[i] = Math.random() * 2 - 1; }
    windNode.buffer = windBuffer;
    windNode.loop = true;
    const windFilter = audioContext.createBiquadFilter();
    windFilter.type = 'lowpass'; windFilter.frequency.value = 400; windFilter.Q.value = 5;
    windNode.connect(windFilter);
    windFilter.connect(musicGainRef.current);
    windNode.start(0);

    const createChirpBuffer = (ctx: AudioContext): AudioBuffer => {
        const duration = 0.2;
        const sr = ctx.sampleRate;
        const bufSize = sr * duration;
        const buffer = ctx.createBuffer(1, bufSize, sr);
        const data = buffer.getChannelData(0);
        let freq = 2000;
        for (let i = 0; i < bufSize; i++) {
            const t = i / sr;
            data[i] = Math.sin(2 * Math.PI * freq * t) * (1 - i / bufSize) * 0.5;
            freq += Math.sin(2 * Math.PI * 40 * t) * 500;
        }
        return buffer;
    };
    birdChirpBufferRef.current = createChirpBuffer(audioContext);
    
    const createVillageSoundsBuffer = (ctx: AudioContext): AudioBuffer => {
        const duration = 10;
        const sr = ctx.sampleRate;
        const bufSize = sr * duration;
        const buffer = ctx.createBuffer(1, bufSize, sr);
        const data = buffer.getChannelData(0);
        const addSound = (offset: number, gen: (t: number) => number, soundDur: number) => {
            const start = Math.floor(offset * sr);
            const end = Math.floor((offset + soundDur) * sr);
            for (let i = start; i < end && i < bufSize; i++) {
                data[i] += gen((i - start) / sr) * 0.2;
            }
        };
        const hammer = (t: number) => Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t * 25);
        const woodChop = (t: number) => (Math.random() * 2 - 1) * Math.exp(-t * 30);
        for (let i = 0; i < 7; i++) {
            addSound(Math.random() * duration, hammer, 0.15);
            addSound(Math.random() * duration, woodChop, 0.2);
        }
        return buffer;
    };
    villageSoundsBufferRef.current = createVillageSoundsBuffer(audioContext);
    
    const createGunshotBuffer = (ctx: AudioContext): AudioBuffer => {
        const duration = 0.3;
        const sr = ctx.sampleRate;
        const bufSize = sr * duration;
        const buffer = ctx.createBuffer(1, bufSize, sr);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufSize; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / bufSize) * 0.8;
        }
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2000;
        return buffer;
    };
    gunshotBufferRef.current = createGunshotBuffer(audioContext);


    firstPersonCamera.position.set(0, 0.1, 0.5);
    firstPersonCamera.rotation.y = Math.PI;
    handles.headGroup.add(firstPersonCamera);

    const dog = createDog();
    dog.position.set(-3, getHeight(-3, 2), 2);
    dog.rotation.y = Math.PI / 4;
    scene.add(dog);

    const stars = createStars();
    stars.position.y = -100;
    scene.add(stars);
    const moon = createMoon();
    scene.add(moon);
    const sun = createSun();
    scene.add(sun);
    const clouds = createClouds();
    scene.add(clouds);
    
    const matrixDummy = new THREE.Object3D();
    
    const updateWorld = (playerX: number, playerZ: number) => {
      const currentChunkX = Math.floor(playerX / CHUNK_SIZE);
      const currentChunkZ = Math.floor(playerZ / CHUNK_SIZE);

      for (let x = currentChunkX - RENDER_DISTANCE_IN_CHUNKS; x <= currentChunkX + RENDER_DISTANCE_IN_CHUNKS; x++) {
        for (let z = currentChunkZ - RENDER_DISTANCE_IN_CHUNKS; z <= currentChunkZ + RENDER_DISTANCE_IN_CHUNKS; z++) {
          const chunkId = `${x},${z}`;
          if (!activeChunks.has(chunkId)) {
            const chunkGroup = new THREE.Group();
            chunkGroup.position.set(x * CHUNK_SIZE, 0, z * CHUNK_SIZE);
            const grassMatrices: THREE.Matrix4[] = [];
            const dirtTopMatrices: THREE.Matrix4[] = [];
            const dirtBaseMatrices: THREE.Matrix4[] = [];
            
            const flowerStemMatrices: THREE.Matrix4[] = [];
            const redFlowerHeadMatrices: THREE.Matrix4[] = [];
            const yellowFlowerHeadMatrices: THREE.Matrix4[] = [];
            const blueFlowerHeadMatrices: THREE.Matrix4[] = [];
            const mushroomStalkMatrices: THREE.Matrix4[] = [];
            const redMushroomCapMatrices: THREE.Matrix4[] = [];
            const brownMushroomCapMatrices: THREE.Matrix4[] = [];
            const grassBladesMatrices: THREE.Matrix4[] = [];
            
            const localTrees: THREE.Vector3[] = [];

            for (let i = 0; i < CHUNK_SIZE; i += 2) {
              for (let j = 0; j < CHUNK_SIZE; j += 2) {
                const worldX = x * CHUNK_SIZE + i - CHUNK_SIZE / 2 + 1;
                const worldZ = z * CHUNK_SIZE + j - CHUNK_SIZE / 2 + 1;
                const groundY = getHeight(worldX, worldZ);
                const blockSeed = Math.floor(worldX) * 1839 + Math.floor(worldZ) * 3847;
                
                matrixDummy.position.set(i - CHUNK_SIZE / 2 + 1, groundY - 1.75, j - CHUNK_SIZE / 2 + 1);
                matrixDummy.rotation.set(0,0,0);
                matrixDummy.updateMatrix();
                dirtBaseMatrices.push(matrixDummy.matrix.clone());

                matrixDummy.position.set(i - CHUNK_SIZE / 2 + 1, groundY - 0.25, j - CHUNK_SIZE / 2 + 1);
                matrixDummy.updateMatrix();

                const isDirtPatch = pseudoRandom(blockSeed) <= DIRT_PATCH_DENSITY;
                
                if (!isDirtPatch) {
                    grassMatrices.push(matrixDummy.matrix.clone());
                    
                    const floraDensity = (floraNoise(worldX / 50, worldZ / 50) + 1) / 2;
                    const floraSeed = blockSeed * 3;

                    if (pseudoRandom(floraSeed) < FLOWER_DENSITY * floraDensity) {
                        const flowerX = i - CHUNK_SIZE / 2 + 1 + (pseudoRandom(floraSeed * 2) - 0.5);
                        const flowerZ = j - CHUNK_SIZE / 2 + 1 + (pseudoRandom(floraSeed * 3) - 0.5);
                        const flowerY = getHeight(x * CHUNK_SIZE + flowerX, z * CHUNK_SIZE + flowerZ);

                        matrixDummy.position.set(flowerX, flowerY + 0.25, flowerZ);
                        matrixDummy.updateMatrix();
                        flowerStemMatrices.push(matrixDummy.matrix.clone());

                        matrixDummy.position.set(flowerX, flowerY + 0.5, flowerZ);
                        matrixDummy.updateMatrix();
                        
                        const colorRand = pseudoRandom(floraSeed * 5);
                        if (colorRand < 0.4) redFlowerHeadMatrices.push(matrixDummy.matrix.clone());
                        else if (colorRand < 0.8) yellowFlowerHeadMatrices.push(matrixDummy.matrix.clone());
                        else blueFlowerHeadMatrices.push(matrixDummy.matrix.clone());
                    }
                    
                    if (pseudoRandom(floraSeed + 10) < GRASS_DENSITY * floraDensity * 2) {
                        const grassX = i - CHUNK_SIZE / 2 + 1 + (pseudoRandom(floraSeed * 11) - 0.5);
                        const grassZ = j - CHUNK_SIZE / 2 + 1 + (pseudoRandom(floraSeed * 12) - 0.5);
                        const grassY = getHeight(x * CHUNK_SIZE + grassX, z * CHUNK_SIZE + grassZ);
                        
                        const numBlades = 2 + Math.floor(pseudoRandom(floraSeed * 13) * 3);
                        for (let k = 0; k < numBlades; k++) {
                            matrixDummy.position.set(grassX, grassY + 0.6, grassZ);
                             matrixDummy.rotation.set(
                                (pseudoRandom(floraSeed * 15 + k) - 0.5) * 0.4,
                                pseudoRandom(floraSeed * 14 + k) * Math.PI * 2,
                                (pseudoRandom(floraSeed * 16 + k) - 0.5) * 0.4
                            );
                            matrixDummy.updateMatrix();
                            grassBladesMatrices.push(matrixDummy.matrix.clone());
                        }
                    }
                } else {
                    dirtTopMatrices.push(matrixDummy.matrix.clone());
                }
                
                const floraSeedMush = blockSeed * 5;
                const floraDensityMush = (floraNoise(worldX / 20, worldZ / 20) + 1) / 2;
                if ((isDirtPatch) && pseudoRandom(floraSeedMush) < MUSHROOM_DENSITY * floraDensityMush) {
                    const mushX = i - CHUNK_SIZE / 2 + 1 + (pseudoRandom(floraSeedMush * 6) - 0.5);
                    const mushZ = j - CHUNK_SIZE / 2 + 1 + (pseudoRandom(floraSeedMush * 7) - 0.5);
                    const mushY = getHeight(x * CHUNK_SIZE + mushX, z * CHUNK_SIZE + mushZ);

                    matrixDummy.position.set(mushX, mushY + 0.3, mushZ);
                    matrixDummy.rotation.set(0,0,0);
                    matrixDummy.updateMatrix();
                    mushroomStalkMatrices.push(matrixDummy.matrix.clone());

                    matrixDummy.position.set(mushX, mushY + 0.6, mushZ);
                    matrixDummy.updateMatrix();
                    
                    if (pseudoRandom(floraSeedMush * 9) < 0.6) brownMushroomCapMatrices.push(matrixDummy.matrix.clone());
                    else redMushroomCapMatrices.push(matrixDummy.matrix.clone());
                }
              }
            }

            const seed = x * 1839 + z * 3847;
            if (pseudoRandom(seed) < TREE_DENSITY) {
                const treeX = (pseudoRandom(seed * 2) - 0.5) * CHUNK_SIZE * 0.8;
                const treeZ = (pseudoRandom(seed * 3) - 0.5) * CHUNK_SIZE * 0.8;
                localTrees.push(new THREE.Vector3(treeX, 0, treeZ));
            }
            
            localTrees.forEach(treePos => {
                for(let k = 0; k < 15; k++) {
                    const angle = pseudoRandom(seed * k * 5) * Math.PI * 2;
                    const radius = 1 + pseudoRandom(seed * k * 7) * 3;
                    const grassX = treePos.x + Math.cos(angle) * radius;
                    const grassZ = treePos.z + Math.sin(angle) * radius;
                    const grassY = getHeight(chunkGroup.position.x + grassX, chunkGroup.position.z + grassZ);
                    
                    const numBlades = 2 + Math.floor(pseudoRandom(seed * k * 9) * 3);
                    for (let l = 0; l < numBlades; l++) {
                        matrixDummy.position.set(grassX, grassY + 0.6, grassZ);
                        matrixDummy.rotation.set(
                            (pseudoRandom(seed * 15 + l) - 0.5) * 0.4,
                             pseudoRandom(seed * 14 + l) * Math.PI * 2,
                            (pseudoRandom(seed * 16 + l) - 0.5) * 0.4
                        );
                        matrixDummy.updateMatrix();
                        grassBladesMatrices.push(matrixDummy.matrix.clone());
                    }
                }
            });


            const instancedDirtBase = new THREE.InstancedMesh(groundBaseGeo, dirtMaterial, dirtBaseMatrices.length);
            instancedDirtBase.receiveShadow = true;
            dirtBaseMatrices.forEach((m, i) => instancedDirtBase.setMatrixAt(i, m));
            chunkGroup.add(instancedDirtBase);
            if (grassMatrices.length > 0) {
              const instancedGrass = new THREE.InstancedMesh(groundTopGeo, grassMaterial, grassMatrices.length);
              instancedGrass.receiveShadow = true;
              grassMatrices.forEach((m, i) => instancedGrass.setMatrixAt(i, m));
              chunkGroup.add(instancedGrass);
            }
            if (dirtTopMatrices.length > 0) {
              const instancedDirtTop = new THREE.InstancedMesh(groundTopGeo, dirtMaterial, dirtTopMatrices.length);
              instancedDirtTop.receiveShadow = true;
              dirtTopMatrices.forEach((m, i) => instancedDirtTop.setMatrixAt(i, m));
              chunkGroup.add(instancedDirtTop);
            }

            if (flowerStemMatrices.length > 0) {
                const mesh = new THREE.InstancedMesh(flowerStemGeo, flowerStemMat, flowerStemMatrices.length);
                flowerStemMatrices.forEach((m, i) => mesh.setMatrixAt(i, m));
                chunkGroup.add(mesh);
            }
            if (redFlowerHeadMatrices.length > 0) {
                const mesh = new THREE.InstancedMesh(flowerHeadGeo, flowerMaterials.red, redFlowerHeadMatrices.length);
                redFlowerHeadMatrices.forEach((m, i) => mesh.setMatrixAt(i, m));
                chunkGroup.add(mesh);
            }
            if (yellowFlowerHeadMatrices.length > 0) {
                const mesh = new THREE.InstancedMesh(flowerHeadGeo, flowerMaterials.yellow, yellowFlowerHeadMatrices.length);
                yellowFlowerHeadMatrices.forEach((m, i) => mesh.setMatrixAt(i, m));
                chunkGroup.add(mesh);
            }
            if (blueFlowerHeadMatrices.length > 0) {
                const mesh = new THREE.InstancedMesh(flowerHeadGeo, flowerMaterials.blue, blueFlowerHeadMatrices.length);
                blueFlowerHeadMatrices.forEach((m, i) => mesh.setMatrixAt(i, m));
                chunkGroup.add(mesh);
            }
            if (mushroomStalkMatrices.length > 0) {
                const mesh = new THREE.InstancedMesh(mushroomStalkGeo, mushroomMaterials.stalk, mushroomStalkMatrices.length);
                mushroomStalkMatrices.forEach((m, i) => mesh.setMatrixAt(i, m));
                chunkGroup.add(mesh);
            }
            if (redMushroomCapMatrices.length > 0) {
                const mesh = new THREE.InstancedMesh(mushroomCapGeo, mushroomMaterials.redCap, redMushroomCapMatrices.length);
                redMushroomCapMatrices.forEach((m, i) => mesh.setMatrixAt(i, m));
                chunkGroup.add(mesh);
            }
            if (brownMushroomCapMatrices.length > 0) {
                const mesh = new THREE.InstancedMesh(mushroomCapGeo, mushroomMaterials.brownCap, brownMushroomCapMatrices.length);
                brownMushroomCapMatrices.forEach((m, i) => mesh.setMatrixAt(i, m));
                chunkGroup.add(mesh);
            }
            if (grassBladesMatrices.length > 0) {
                const instancedGrass = new THREE.InstancedMesh(grassBladeGeo, grassMaterialGeneric, grassBladesMatrices.length);
                grassBladesMatrices.forEach((m, i) => instancedGrass.setMatrixAt(i, m));
                chunkGroup.add(instancedGrass);
            }

            localTrees.forEach(treePos => {
              const tree = createTree(treePos.x, treePos.z, seed);
              tree.position.y = getHeight(chunkGroup.position.x + treePos.x, chunkGroup.position.z + treePos.z);
              chunkGroup.add(tree);

              if (pseudoRandom(seed * 5) < BIRD_TREE_CHANCE) {
                  const numBirds = Math.floor(pseudoRandom(seed * 7) * 3) + 1;
                  const instancedLeaves = tree.children.find(c => c instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
                  if (instancedLeaves) {
                      for (let i = 0; i < numBirds; i++) {
                          const bird = createBirdInstance();
                          const treeHasNest = !!tree.userData.nest;

                          bird.userData = {
                              ...bird.userData,
                              state: 'SITTING', flightMode: 'NONE', homeTree: tree,
                              nest: treeHasNest ? tree.userData.nest : null,
                              chunkId: chunkId,
                              stateTimer: pseudoRandom(seed * 13 * (i+1)) * 10 + 5,
                              landingSpot: treeHasNest ? tree.userData.nest.position.clone() : findNewLandingSpot(tree),
                              flapOffset: Math.random() * Math.PI * 2,
                              velocity: new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).normalize().multiplyScalar(BIRD_MAX_SPEED),
                          };
                          
                          const birdAudio = new THREE.PositionalAudio(listener);
                          birdAudio.setRefDistance(5);
                          birdAudio.setRolloffFactor(2);
                          birdAudio.setVolume(0.8);
                          birdAudio.getOutput().connect(sfxGainRef.current!);
                          bird.add(birdAudio);
                          bird.userData.audio = birdAudio;
                          
                          const treeWorldPos = chunkGroup.position.clone().add(tree.position);
                          bird.position.copy(treeWorldPos).add(bird.userData.landingSpot);
                          if (treeHasNest) bird.position.y += 0.2;

                          const lookAwayTarget = bird.position.clone().add(new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize());
                          bird.lookAt(lookAwayTarget);

                          scene.add(bird);
                          birdsRef.current.push(bird);
                      }
                  }
              }
            });

            if (pseudoRandom(seed*5) < BUSH_DENSITY) {
                const bushX = (pseudoRandom(seed * 7) - 0.5) * CHUNK_SIZE * 0.9;
                const bushZ = (pseudoRandom(seed * 11) - 0.5) * CHUNK_SIZE * 0.9;
                const bush = createBush(bushX, bushZ, seed);
                bush.position.y = getHeight(chunkGroup.position.x + bushX, chunkGroup.position.z + bushZ) + 0.5;
                chunkGroup.add(bush);
            }

            if (pseudoRandom(seed * 13) < VILLAGE_DENSITY && !activeVillages.has(chunkId)) {
                const villageGroup = new THREE.Group();
                villageGroup.position.set(x * CHUNK_SIZE, 0, z * CHUNK_SIZE);
                villageGroup.userData.chunkId = chunkId;

                const villageSeed = seed * 17;
                const numHouses = 2 + Math.floor(pseudoRandom(villageSeed) * 2);
                const houses = [];
                for(let i = 0; i < numHouses; i++) {
                    const house = createHouse(villageSeed + i * 3);
                    const angle = (i / numHouses) * Math.PI * 2 + pseudoRandom(villageSeed+i) * 0.5;
                    const radius = 8 + pseudoRandom(villageSeed+i*2)*4;
                    const houseX = Math.cos(angle) * radius;
                    const houseZ = Math.sin(angle) * radius;
                    house.position.set(houseX, getHeight(villageGroup.position.x + houseX, villageGroup.position.z + houseZ), houseZ);
                    house.rotation.y = -angle + Math.PI/2;
                    villageGroup.add(house);
                    houses.push(house);
                }

                const farm = createFarmPlot(villageSeed + 11);
                farm.position.set(0, getHeight(villageGroup.position.x, villageGroup.position.z), 12);
                villageGroup.add(farm);
                
                const well = createWell(villageSeed + 13);
                well.position.set(0, getHeight(villageGroup.position.x, villageGroup.position.z), -2);
                villageGroup.add(well);
                
                if (villageSoundsBufferRef.current) {
                    const villageAudio = new THREE.PositionalAudio(listener);
                    villageAudio.setBuffer(villageSoundsBufferRef.current);
                    villageAudio.setRefDistance(30);
                    villageAudio.setRolloffFactor(1.5);
                    villageAudio.setLoop(true);
                    villageAudio.setVolume(0.6);
                    villageAudio.position.copy(well.position);
                    villageAudio.getOutput().connect(sfxGainRef.current!);
                    villageGroup.add(villageAudio);
                    if (interacted) villageAudio.play();
                    villageGroup.userData.audio = villageAudio;
                }

                const numVillagers = numHouses + Math.floor(pseudoRandom(villageSeed + 17));
                const professions: VillagerProfession[] = ['farmer', 'librarian', 'blacksmith', 'nitwit'];
                for(let i=0; i<numVillagers; i++) {
                    const prof = professions[Math.floor(pseudoRandom(villageSeed+i*19) * professions.length)];
                    const villager = createVillager(prof, villageSeed + i * 19);
                    
                    const spawnAngle = Math.random() * Math.PI * 2;
                    const villagerX = villageGroup.position.x + Math.cos(spawnAngle) * 5;
                    const villagerZ = villageGroup.position.z + Math.sin(spawnAngle) * 5;
                    villager.position.set(villagerX, getHeight(villagerX, villagerZ), villagerZ);

                    const homeHouse = houses[i % houses.length];
                    const homePointInHouse = homeHouse.userData.interiorPoint.clone().applyQuaternion(homeHouse.quaternion);
                    const homePoint = homeHouse.position.clone().add(homePointInHouse).add(villageGroup.position);
                    homePoint.y = getHeight(homePoint.x, homePoint.z) + 1;

                    villager.userData = {
                        ...villager.userData,
                        state: 'IDLE', stateTimer: pseudoRandom(villageSeed * 23 * i) * 5 + 3,
                        chunkId: chunkId, targetPosition: null, profession: prof,
                        homePoint: homePoint,
                        workPoint: (() => {
                            if (prof === 'farmer' && farm.userData.workPoints.length > 0) {
                                const workPointInFarm = farm.userData.workPoints[i % farm.userData.workPoints.length];
                                const point = farm.position.clone().add(workPointInFarm).add(villageGroup.position);
                                point.y = getHeight(point.x, point.z) + 0.5;
                                return point;
                            }
                            return null;
                        })(),
                        velocity: new THREE.Vector3(),
                        isOnGround: true,
                    };
                    villager.rotation.y = pseudoRandom(seed * 29) * Math.PI * 2;
                    scene.add(villager);
                    villagersRef.current.push(villager);
                }

                scene.add(villageGroup);
                activeVillages.set(chunkId, villageGroup);
            }

            scene.add(chunkGroup);
            activeChunks.set(chunkId, chunkGroup);
          }
        }
      }
      activeChunks.forEach((chunk, chunkId) => {
        const [xStr, zStr] = chunkId.split(',');
        const x = parseInt(xStr, 10);
        const z = parseInt(zStr, 10);
        if (Math.abs(x - currentChunkX) > RENDER_DISTANCE_IN_CHUNKS || Math.abs(z - currentChunkZ) > RENDER_DISTANCE_IN_CHUNKS) {
          if (activeVillages.has(chunkId)) {
              const village = activeVillages.get(chunkId)!;
              if (village.userData.audio && village.userData.audio.isPlaying) {
                  village.userData.audio.stop();
              }
              scene.remove(village);
              activeVillages.delete(chunkId);
              villagersRef.current = villagersRef.current.filter(v => {
                  if (v.userData.chunkId === chunkId) {
                      scene.remove(v); return false;
                  }
                  return true;
              });
          }
          birdsRef.current = birdsRef.current.filter(bird => {
            if (bird.userData.chunkId === chunkId) {
                if (bird.userData.audio && bird.userData.audio.isPlaying) {
                    bird.userData.audio.stop();
                }
                scene.remove(bird);
                return false;
            }
            return true;
          });
          scene.remove(chunk);
          activeChunks.delete(chunkId);
        }
      });
    };
    
    updateWorld(character.position.x, character.position.z);
    
    const clock = new THREE.Clock();
    let lastBirdOpacity = -1.0;
    const treeWorldPosHelper = new THREE.Vector3();
    const targetLookAt = new THREE.Vector3();
    let wasOnGround = true;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();
      
      const currentIsJumping = isJumpingRef.current;
      const currentCameraMode = cameraModeRef.current;
      const character = characterHandlesRef.current?.group;
      if (!character) return;
      
      const activeCamera = currentCameraMode === 'first-person' ? firstPersonCamera : thirdPersonCamera;

      dustSystem.update(delta, activeCamera);
      sparkSystem.update(delta, activeCamera);

      activeTracersRef.current.forEach((tracer, index) => {
          tracer.userData.life -= delta;
          if (tracer.userData.life <= 0) {
              scene.remove(tracer);
              tracer.geometry.dispose();
              (tracer.material as THREE.Material).dispose();
              activeTracersRef.current.splice(index, 1);
          }
      });

      const timeOfDay = ((elapsedTime + START_TIME_OFFSET) / DAY_NIGHT_CYCLE_SECONDS) % 1.0;
      const sunAngle = timeOfDay * Math.PI * 2;
      let startKey, endKey;
      for (let i = 0; i < keyframes.length - 1; i++) {
        if (timeOfDay >= keyframes[i].time && timeOfDay < keyframes[i+1].time) {
          startKey = keyframes[i];
          endKey = keyframes[i+1];
          break;
        }
      }
      
      let dayFactor = 0;
      if (startKey && endKey) {
        const duration = endKey.time - startKey.time;
        const alpha = (timeOfDay - startKey.time) / duration;
        const bgColor = startKey.sky.clone().lerp(endKey.sky, alpha);
        scene.background = bgColor;
        scene.fog!.color.copy(startKey.fog.clone().lerp(endKey.fog, alpha));
        sunLight.intensity = THREE.MathUtils.lerp(startKey.sun, endKey.sun, alpha);
        ambientLight.intensity = THREE.MathUtils.lerp(startKey.ambient, endKey.ambient, alpha);
        
        const nightFactor = 1.0 - (sunLight.intensity / 0.9);
        const starMaterial = stars.material as THREE.PointsMaterial;
        starMaterial.opacity = nightFactor * nightFactor;
        starMaterial.size = 1.5 + Math.sin(elapsedTime * 2.0) * 0.5;

        (moon.material as THREE.MeshStandardMaterial).opacity = nightFactor * 0.9;
        moonLight.intensity = nightFactor * nightFactor * 1.5;
        
        dayFactor = 1.0 - nightFactor;
        (sun.material as THREE.MeshBasicMaterial).opacity = dayFactor * dayFactor;

        const cloudColor = startKey.ambient > 0.15 ? new THREE.Color(0xffffff) : new THREE.Color(0x444466);
        const finalCloudColor = cloudColor.lerp(bgColor, 0.5);
        clouds.children.forEach(cloud => {
            const cloudMat = (cloud as THREE.Mesh).material as THREE.MeshLambertMaterial;
            cloudMat.color.copy(finalCloudColor);
            cloudMat.opacity = dayFactor > 0.1 ? THREE.MathUtils.smoothstep(dayFactor, 0.1, 0.4) * 0.6 : 0;
        });
      }
      
      const playerCenter = character.position;
      sunLight.position.set(playerCenter.x + Math.cos(sunAngle) * 70, Math.sin(sunAngle) * 50, playerCenter.z + Math.sin(sunAngle - Math.PI/2) * 70);
      sunLight.target.position.copy(playerCenter);
      sunLight.target.updateMatrixWorld();
      sun.position.copy(sunLight.position);
      moonIlluminationLight.position.copy(sunLight.position);
      
      const moonAngle = sunAngle + Math.PI;
      moon.position.set(playerCenter.x + Math.cos(moonAngle) * 60, Math.sin(moonAngle) * 40, playerCenter.z + Math.sin(moonAngle - Math.PI/2) * 60);
      moon.lookAt(playerCenter);
      moonLight.position.copy(moon.position);
      moonLight.target.position.copy(playerCenter);
      moonLight.target.updateMatrixWorld();

      stars.position.copy(playerCenter);
      clouds.position.x = playerCenter.x;
      clouds.position.z = playerCenter.z;
      clouds.children.forEach(cloud => {
        cloud.position.x += (cloud as any).userData.velocity.x * delta;
        const relX = cloud.position.x - clouds.position.x;
        if (relX > 500) cloud.position.x -= 1000;
        else if (relX < -500) cloud.position.x += 1000;
      });
      
      const birdOpacity = dayFactor > 0.1 ? THREE.MathUtils.smoothstep(dayFactor, 0.1, 0.4) : 0;
      if (lastBirdOpacity !== birdOpacity) {
        allBirdMaterials.forEach(m => m.opacity = birdOpacity);
        lastBirdOpacity = birdOpacity;
      }
      
      if (birdOpacity > 0) {
        birdsRef.current.forEach(bird => {
          const data = bird.userData;
          data.stateTimer -= delta;

          if (data.state !== 'SITTING') {
            const time = elapsedTime * 25 + data.flapOffset;
            const flapAngle = Math.sin(time) * 0.9;
            data.leftWing.rotation.z = flapAngle;
            data.rightWing.rotation.z = -flapAngle;
          }

          switch (data.state) {
            case 'SITTING':
              data.homeTree.getWorldPosition(treeWorldPosHelper);
              const expectedPosition = treeWorldPosHelper.clone().add(data.landingSpot);
              if (data.nest) expectedPosition.y += 0.2;

              if (bird.position.distanceTo(expectedPosition) > 1.5) {
                  data.state = 'FLYING';
                  data.flightMode = 'RETURNING';
                  break;
              }

              if (data.stateTimer <= 0) {
                  data.state = 'FLYING';
                  const rand = Math.random();
                  if (rand < 0.5) {
                      data.flightMode = 'CIRCLING'; data.stateTimer = Math.random() * 8 + 8;
                      data.circleAngle = Math.random() * Math.PI * 2; data.circleRadius = Math.random() * 10 + 10;
                      data.circleAltitude = Math.random() * 5 + 5;
                  } else if (rand < 0.85) {
                      data.flightMode = 'EXPLORING'; data.stateTimer = Math.random() * 10 + 15;
                  } else {
                      data.flightMode = 'SWOOPING';
                      data.homeTree.getWorldPosition(treeWorldPosHelper);
                      data.swoopTarget = new THREE.Vector3(treeWorldPosHelper.x + (Math.random() - 0.5) * 20, treeWorldPosHelper.y - 1, treeWorldPosHelper.z + (Math.random() - 0.5) * 20);
                      data.swoopPhase = 'DIVE';
                  }
              } else {
                 if (data.audio && !data.audio.isPlaying && Math.random() < 0.005) {
                    if (!data.audio.buffer) data.audio.setBuffer(birdChirpBufferRef.current);
                    data.audio.play();
                 }
              }
              break;

            case 'FLYING':
              let targetPosition = new THREE.Vector3();
              data.homeTree.getWorldPosition(treeWorldPosHelper);

              if (data.flightMode === 'RETURNING') {
                  const landingWorldPos = treeWorldPosHelper.clone().add(data.landingSpot);
                   if (data.nest) landingWorldPos.y += 0.2;
                  const approachPos = landingWorldPos.clone().add(new THREE.Vector3(0, 2, 0));
                  const distanceToTarget = bird.position.distanceTo(landingWorldPos);

                  if (distanceToTarget > 2.5) {
                      bird.position.lerp(approachPos, delta * 1.5);
                      bird.lookAt(approachPos);
                  } else {
                      bird.position.lerp(landingWorldPos, delta * 3.0);
                      bird.lookAt(landingWorldPos);
                  }
                  
                  if (distanceToTarget < 0.2) {
                      bird.position.copy(landingWorldPos);
                      const lookAway = landingWorldPos.clone().add(new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize());
                      bird.lookAt(lookAway);
                      data.state = 'SITTING';
                      data.stateTimer = Math.random() * 10 + 5;
                  }
              } else if (data.flightMode === 'CIRCLING') {
                  const treePos = treeWorldPosHelper;
                  data.circleAngle += delta * 1.5;
                  targetPosition.set(
                      treePos.x + Math.cos(data.circleAngle) * data.circleRadius,
                      treePos.y + data.homeTree.userData.height / 2 + data.circleAltitude,
                      treePos.z + Math.sin(data.circleAngle) * data.circleRadius
                  );
                  const lookTarget = targetPosition.clone();
                  lookTarget.x += Math.cos(data.circleAngle + 0.1);
                  lookTarget.z += Math.sin(data.circleAngle + 0.1);
                  bird.position.lerp(targetPosition, delta * 2.0);
                  bird.lookAt(lookTarget);
                  if (data.stateTimer <= 0) {
                      data.flightMode = 'RETURNING';
                      if (!data.nest) data.landingSpot = findNewLandingSpot(data.homeTree);
                  }
              } else if (data.flightMode === 'SWOOPING') {
                  if (data.swoopPhase === 'DIVE') {
                      bird.position.lerp(data.swoopTarget, delta * 3.0);
                      bird.lookAt(data.swoopTarget);
                      if (bird.position.distanceTo(data.swoopTarget) < 2) {
                          data.swoopPhase = 'PULL_UP';
                          data.swoopTarget.y += 15;
                      }
                  } else { // PULL_UP
                      bird.position.lerp(data.swoopTarget, delta * 2.5);
                      bird.lookAt(data.swoopTarget);
                      if (bird.position.distanceTo(data.swoopTarget) < 3) {
                          data.flightMode = 'CIRCLING'; data.stateTimer = Math.random() * 8 + 8;
                          data.circleAngle = Math.random() * Math.PI * 2; data.circleRadius = Math.random() * 10 + 10;
                          data.circleAltitude = Math.random() * 5 + 5;
                      }
                  }
              } else if (data.flightMode === 'EXPLORING') {
                  const alignment = new THREE.Vector3(), cohesion = new THREE.Vector3(), separation = new THREE.Vector3();
                  let neighborCount = 0;
                  for (const otherBird of birdsRef.current) {
                      if (otherBird !== bird && otherBird.userData.state === 'FLYING' && otherBird.userData.flightMode === 'EXPLORING') {
                          const dist = bird.position.distanceTo(otherBird.position);
                          if (dist > 0 && dist < BIRD_PERCEPTION_RADIUS) {
                              alignment.add(otherBird.userData.velocity); cohesion.add(otherBird.position);
                              if (dist < BIRD_SEPARATION_DISTANCE) {
                                  const diff = new THREE.Vector3().subVectors(bird.position, otherBird.position);
                                  diff.normalize().divideScalar(dist);
                                  separation.add(diff);
                              }
                              neighborCount++;
                          }
                      }
                  }

                  if (neighborCount > 0) {
                      alignment.divideScalar(neighborCount).normalize().multiplyScalar(BIRD_MAX_SPEED).sub(data.velocity).multiplyScalar(BIRD_ALIGNMENT_WEIGHT);
                      cohesion.divideScalar(neighborCount).sub(bird.position).normalize().multiplyScalar(BIRD_MAX_SPEED).sub(data.velocity).multiplyScalar(BIRD_COHESION_WEIGHT);
                      separation.divideScalar(neighborCount).normalize().multiplyScalar(BIRD_MAX_SPEED).sub(data.velocity).multiplyScalar(BIRD_SEPARATION_WEIGHT);
                      data.velocity.add(alignment).add(cohesion).add(separation);
                  } else {
                      const wanderVector = new THREE.Vector3((Math.random() - 0.5), (Math.random() - 0.5) * 0.3, (Math.random() - 0.5));
                      data.velocity.add(wanderVector.normalize().multiplyScalar(0.3));
                  }
                  if (data.velocity.lengthSq() < 0.1) data.velocity.set(Math.random() - 0.5, 0, Math.random() - 0.5);
                  data.velocity.clampLength(BIRD_MAX_SPEED * 0.6, BIRD_MAX_SPEED);
                  bird.position.add(data.velocity.clone().multiplyScalar(delta));
                  const lookTarget = bird.position.clone().add(data.velocity);
                  bird.lookAt(lookTarget);
                  if (data.stateTimer <= 0) {
                      data.flightMode = 'RETURNING';
                      if (!data.nest) data.landingSpot = findNewLandingSpot(data.homeTree);
                  }
              }
              break;
          }
        });
      }

      // --- Villager AI ---
      villagersRef.current.forEach(villager => {
        const data = villager.userData;
        data.stateTimer -= delta;

        // Villager physics to keep them grounded
        if (data.state !== 'SLEEPING') {
            const groundY = getHeight(villager.position.x, villager.position.z);
            if (!data.velocity) data.velocity = new THREE.Vector3(); // Safety for hot-reloads

            data.velocity.y -= GRAVITY * delta;
            villager.position.y += data.velocity.y * delta;

            if (villager.position.y < groundY) {
                villager.position.y = groundY;
                data.velocity.y = 0;
                data.isOnGround = true;
            } else {
                data.isOnGround = false;
            }
        }
        
        const distanceToPlayer = villager.position.distanceTo(character.position);
        const isDayTime = timeOfDay > 0.28 && timeOfDay < 0.76;
        const isNightTime = !isDayTime;

        // High-level state changes based on time
        if (isNightTime && data.state !== 'SLEEPING' && data.state !== 'GOING_HOME') {
            data.state = 'GOING_HOME';
            data.targetPosition = data.homePoint;
        }
        if (isDayTime && data.state === 'SLEEPING') {
            data.state = 'IDLE'; data.stateTimer = Math.random() * 5 + 3;
        }

        // Player interaction overrides other states
        if (distanceToPlayer < VILLAGER_INTERACTION_RADIUS && data.state !== 'LOOKING_AT_PLAYER') {
            data.prevState = data.state;
            data.state = 'LOOKING_AT_PLAYER';
            data.targetPosition = null;
        } else if (distanceToPlayer >= VILLAGER_INTERACTION_RADIUS && data.state === 'LOOKING_AT_PLAYER') {
            data.state = data.prevState || 'IDLE';
            data.stateTimer = Math.random() * 2 + 1;
        }
        
        // Timer-based state changes for daytime
        if (data.stateTimer <= 0 && isDayTime) {
            if (data.state === 'IDLE' || data.state === 'WANDERING') {
                if (data.profession === 'farmer' && data.workPoint && Math.random() < 0.5) {
                    data.state = 'GOING_TO_WORK'; data.targetPosition = data.workPoint;
                } else {
                    data.state = 'WANDERING';
                    const angle = Math.random() * Math.PI * 2;
                    const wanderDist = Math.random() * 10 + 5;
                    data.targetPosition = new THREE.Vector3(
                        villager.position.x + Math.cos(angle) * wanderDist, 0,
                        villager.position.z + Math.sin(angle) * wanderDist
                    );
                    data.stateTimer = wanderDist / VILLAGER_SPEED + (Math.random() * 2);
                }
            } else { // from WORKING or other states
                 data.state = 'IDLE'; data.stateTimer = Math.random() * 8 + 5;
            }
        }
    
        // State actions
        let isMoving = false;
        let targetYRotation: number | null = null;
        const ROTATION_SPEED = 4.0;

        switch (data.state) {
            case 'IDLE': /* Do nothing */ break;
            case 'LOOKING_AT_PLAYER':
                {
                    const lookAtTarget = new THREE.Vector3(character.position.x, villager.position.y, character.position.z);
                    const direction = lookAtTarget.sub(villager.position);
                    if (direction.lengthSq() > 0.01) {
                        targetYRotation = Math.atan2(direction.x, direction.z);
                    }
                }
                break;
            case 'GOING_HOME':
            case 'GOING_TO_WORK':
            case 'WANDERING':
                if (data.targetPosition) {
                    const target = data.targetPosition;
                    const direction = new THREE.Vector3().subVectors(target, villager.position);
                    direction.y = 0;
                    if (direction.lengthSq() > 1) {
                        isMoving = true;
                        direction.normalize();
                        villager.position.x += direction.x * VILLAGER_SPEED * delta;
                        villager.position.z += direction.z * VILLAGER_SPEED * delta;
                        targetYRotation = Math.atan2(direction.x, direction.z);
                    } else { // Arrived
                        data.targetPosition = null;
                        if(data.state === 'GOING_HOME') data.state = 'SLEEPING';
                        if(data.state === 'GOING_TO_WORK') { data.state = 'WORKING'; data.stateTimer = Math.random() * 10 + 10; }
                        if(data.state === 'WANDERING') { data.state = 'IDLE'; data.stateTimer = Math.random() * 5 + 3; }
                    }
                }
                break;
            case 'WORKING':
                const workBob = Math.sin(elapsedTime * 3) * 0.1;
                data.headGroup.position.y = 4.9 + workBob;
                data.leftArm.rotation.x = -Math.PI / 4 + workBob * 2;
                data.rightArm.rotation.x = -Math.PI / 4 - workBob * 2;
                break;
            case 'SLEEPING':
                 villager.position.lerp(data.homePoint, delta); // stay inside
                 break;
        }
        
        // Unify rotation logic to prevent tilting and ensure smooth turning.
        if (targetYRotation !== null) {
            const currentRotation = villager.rotation.y;
            let diff = targetYRotation - currentRotation;
            
            // Find the shortest path to the target rotation
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;

            // Apply rotation change
            villager.rotation.y += diff * ROTATION_SPEED * delta;
        }

        // Explicitly prevent any tilting on X and Z axes.
        villager.rotation.x = 0;
        villager.rotation.z = 0;
        
        // Animation
        if (isMoving) {
            const walkSpeed = elapsedTime * 6;
            const swingAngle = Math.sin(walkSpeed) * 0.4;
            data.leftArm.rotation.x = swingAngle;
            data.rightArm.rotation.x = -swingAngle;
            if (data.leftLeg && data.rightLeg) {
                data.leftLeg.rotation.x = -swingAngle;
                data.rightLeg.rotation.x = swingAngle;
            }
        } else if (data.state !== 'WORKING') {
            data.leftArm.rotation.x = THREE.MathUtils.lerp(data.leftArm.rotation.x, 0, delta * 10);
            data.rightArm.rotation.x = THREE.MathUtils.lerp(data.rightArm.rotation.x, 0, delta * 10);
            data.headGroup.position.y = THREE.MathUtils.lerp(data.headGroup.position.y, 4.9, delta * 10);
            if (data.leftLeg && data.rightLeg) {
                data.leftLeg.rotation.x = THREE.MathUtils.lerp(data.leftLeg.rotation.x, 0, delta * 10);
                data.rightLeg.rotation.x = THREE.MathUtils.lerp(data.rightLeg.rotation.x, 0, delta * 10);
            }
        } else if (data.state === 'WORKING') {
             if (data.leftLeg && data.rightLeg) {
                data.leftLeg.rotation.x = THREE.MathUtils.lerp(data.leftLeg.rotation.x, 0, delta * 10);
                data.rightLeg.rotation.x = THREE.MathUtils.lerp(data.rightLeg.rotation.x, 0, delta * 10);
            }
        }
      });


      // --- Player Movement ---
      let walkMagnitude = 0;
      let isRunning = false;

      if (isMobile) {
        const currentMove = moveRef.current;
        character.rotation.y -= currentMove.x * PLAYER_ROTATION_SPEED * delta;
        walkMagnitude = Math.abs(currentMove.y);
        if (currentMove.y !== 0) {
          const moveSpeed = PLAYER_SPEED * currentMove.y;
          character.position.x += Math.sin(character.rotation.y) * moveSpeed * delta;
          character.position.z += Math.cos(character.rotation.y) * moveSpeed * delta;
        }
      } else {
        const forwardInput = (keysPressed.current['w'] || keysPressed.current['arrowup'] ? 1 : 0) - (keysPressed.current['s'] || keysPressed.current['arrowdown'] ? 1 : 0);
        const strafeInput = (keysPressed.current['a'] || keysPressed.current['arrowleft'] ? 1 : 0) - (keysPressed.current['d'] || keysPressed.current['arrowright'] ? 1 : 0);
        
        walkMagnitude = Math.max(Math.abs(forwardInput), Math.abs(strafeInput));
        
        isRunning = keysPressed.current['shift'] && walkMagnitude > 0.1;
        const currentSpeed = isRunning ? PLAYER_SPEED * PLAYER_RUN_MULTIPLIER : PLAYER_SPEED;

        if (forwardInput !== 0 || strafeInput !== 0) {
            const moveDirection = new THREE.Vector3(strafeInput, 0, forwardInput).normalize();
            const moveSpeed = currentSpeed * delta;
            
            const forwardDir = new THREE.Vector3(Math.sin(character.rotation.y), 0, Math.cos(character.rotation.y));
            const rightDir = new THREE.Vector3(forwardDir.z, 0, -forwardDir.x);

            character.position.add(forwardDir.multiplyScalar(moveDirection.z * moveSpeed));
            character.position.add(rightDir.multiplyScalar(moveDirection.x * moveSpeed));
        }
      }
      
      const groundYPosition = getHeight(character.position.x, character.position.z) + 1.0;
      const fallSpeed = playerVelocity.y;

      playerVelocity.y -= GRAVITY * delta;
      character.position.y += playerVelocity.y * delta;

      if (character.position.y <= groundYPosition) {
        character.position.y = groundYPosition;
        playerVelocity.y = 0;
        isOnGround = true;
      }
      
      const justLanded = !wasOnGround && isOnGround;
      if (justLanded && fallSpeed < -5) {
          dustSystem.emit({
              position: character.position.clone().sub(new THREE.Vector3(0, 1, 0)),
              count: 20,
              color: new THREE.Color(0x8B4513),
              velocity: new THREE.Vector3(0, 0.5, 0),
              velocityRandomness: 3,
              size: [0.5, 1.5],
              life: [0.5, 1.0],
              rotationSpeed: [-1, 1],
          });
      }

      if (isMobile) {
        if (currentIsJumping && isOnGround) {
          dustSystem.emit({
              position: character.position.clone().sub(new THREE.Vector3(0, 1, 0)),
              count: 8,
              color: new THREE.Color(0xcccccc),
              velocity: new THREE.Vector3(0, 1, 0),
              velocityRandomness: 1,
              size: [0.2, 0.4],
              life: [0.3, 0.6],
              rotationSpeed: [-2, 2],
          });
          playerVelocity.y = JUMP_FORCE;
          isOnGround = false;
          onJumpEndRef.current();
        }
      } else {
        if (keysPressed.current[' '] && isOnGround) {
           dustSystem.emit({
              position: character.position.clone().sub(new THREE.Vector3(0, 1, 0)),
              count: 8,
              color: new THREE.Color(0xcccccc),
              velocity: new THREE.Vector3(0, 1, 0),
              velocityRandomness: 1,
              size: [0.2, 0.4],
              life: [0.3, 0.6],
              rotationSpeed: [-2, 2],
          });
          playerVelocity.y = JUMP_FORCE;
          isOnGround = false;
        }
      }

      wasOnGround = isOnGround;
      
      const playerChunkX = Math.floor(character.position.x / CHUNK_SIZE);
      const playerChunkZ = Math.floor(character.position.z / CHUNK_SIZE);
      if (!lastPlayerChunk || lastPlayerChunk.x !== playerChunkX || lastPlayerChunk.z !== playerChunkZ) {
        updateWorld(character.position.x, character.position.z);
        lastPlayerChunk = { x: playerChunkX, z: playerChunkZ };
      }
      
      // --- Player Animation ---
      const animationSpeedMultiplier = isRunning ? 1.6 : 1.0;
      const walkCycleTime = elapsedTime * 8 * walkMagnitude * animationSpeedMultiplier;

      const { leftArm, rightArm, leftLeg, rightLeg, neckGroup } = characterHandlesRef.current!;
      const isWeaponEquipped = currentWeaponIndexRef.current !== null;

      // --- Leg Animation ---
      if (isOnGround && walkMagnitude > 0.1) {
          const swingMagnitude = isRunning ? 0.8 : 0.6;
          const swingAngle = Math.sin(walkCycleTime) * swingMagnitude;
          leftLeg.rotation.x = -swingAngle;
          rightLeg.rotation.x = swingAngle;
      } else if (isOnGround) {
          leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, delta * 10);
          rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, delta * 10);
      } else { // Jumping
          const jumpAngle = 0.5;
          leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, jumpAngle, delta * 5);
          rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, jumpAngle, delta * 5);
      }

      // --- Arm Animation ---
      if (isWeaponEquipped) {
          const aimSway = isOnGround && walkMagnitude > 0.1 ? Math.sin(walkCycleTime) * 0.02 : 0;
          const aimBob = isOnGround && walkMagnitude > 0.1 ? Math.abs(Math.cos(walkCycleTime)) * 0.04 : 0;

          const targetRightArmX = -Math.PI / 2 + neckGroup.rotation.x + aimSway;
          const targetLeftArmX = -Math.PI / 2 + neckGroup.rotation.x + 0.1 - aimSway;
          
          rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, targetRightArmX, delta * 10);
          rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, -0.2, delta * 10);
          rightArm.position.y = THREE.MathUtils.lerp(rightArm.position.y, 5.5 + aimBob, delta * 10);
          rightArm.position.z = 0;

          leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, targetLeftArmX, delta * 10);
          leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0.4, delta * 10);
          leftArm.position.y = THREE.MathUtils.lerp(leftArm.position.y, 5.5 + aimBob, delta * 10);
          leftArm.position.z = 0;
          
      } else { // No weapon equipped
          rightArm.position.y = THREE.MathUtils.lerp(rightArm.position.y, 5.5, delta * 10);
          leftArm.position.y = THREE.MathUtils.lerp(leftArm.position.y, 5.5, delta * 10);
          rightArm.position.z = THREE.MathUtils.lerp(rightArm.position.z, 0, delta * 10);
          rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y, 0, delta * 10);
          leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y, 0, delta * 10);

          if (isOnGround && walkMagnitude > 0.1) {
              const swingMagnitude = isRunning ? 0.8 : 0.6;
              const swingAngle = Math.sin(walkCycleTime) * swingMagnitude;
              leftArm.rotation.x = swingAngle;
              rightArm.rotation.x = -swingAngle;
          } else if (isOnGround) { // Idle
              leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, 0, delta * 10);
              rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, 0, delta * 10);
          } else { // Jumping
              const jumpAngle = -0.5;
              leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, jumpAngle, delta * 5);
              rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, jumpAngle * 0.8, delta * 5);
          }
      }
      
      const tail = dog.children.find(c => c.geometry.type === "BoxGeometry" && c.position.z < -1);
      if (tail) tail.rotation.z = Math.sin(elapsedTime * 5) * 0.4;

      const headGroup = characterHandlesRef.current!.headGroup;
      headGroup.children.forEach(child => {
          if (!(child instanceof THREE.Camera) && child !== characterHandlesRef.current!.hairContainer) {
              child.visible = currentCameraMode !== 'first-person';
          }
      });
      characterHandlesRef.current!.hairContainer.visible = currentCameraMode !== 'first-person';

      
      // --- Camera Logic ---
      if (currentCameraMode === 'third-person') {
        const idealOffset = CAMERA_OFFSET.clone();

        idealOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), character.rotation.y);
        const targetCameraPosition = character.position.clone().add(idealOffset);
        thirdPersonCamera.position.lerp(targetCameraPosition, delta * 15);

        neckGroup.getWorldPosition(targetLookAt);
        const lookDirection = new THREE.Vector3();
        neckGroup.getWorldDirection(lookDirection);
        targetLookAt.add(lookDirection.multiplyScalar(50));
        thirdPersonCamera.lookAt(targetLookAt);
      }
      
      
      const { clientWidth, clientHeight } = renderer.domElement;
      renderer.setViewport(0, 0, clientWidth, clientHeight);
      renderer.setScissor(0, 0, clientWidth, clientHeight);
      renderer.render(scene, activeCamera);

      // --- Debug View Logic ---
      if (!isMobile && debugCameraRef.current) {
        const debugPort = document.getElementById('debug-view-port');
        if (debugPort) {
            const portRect = debugPort.getBoundingClientRect();
            const canvasRect = renderer.domElement.getBoundingClientRect();
    
            const debugLeft = portRect.left - canvasRect.left;
            const debugTop = portRect.top - canvasRect.top;
            const debugWidth = portRect.width;
            const debugHeight = portRect.height;
            
            if (debugWidth > 0 && debugHeight > 0) {
                const isShowingThirdPersonInBox = currentCameraMode === 'first-person';
                const debugCamToRender = isShowingThirdPersonInBox ? debugCameraRef.current : firstPersonCamera;

                debugCamToRender.aspect = debugWidth / debugHeight;
                debugCamToRender.updateProjectionMatrix();

                const originalHairVisibility = characterHandlesRef.current!.hairContainer.visible;
                const originalHeadPartVisibility: { [key: number]: boolean } = {};
                headGroup.children.forEach((c, i) => originalHeadPartVisibility[i] = c.visible);

                if (isShowingThirdPersonInBox) {
                    const debugCam = debugCameraRef.current;
                    const debugOffset = new THREE.Vector3(0, 8, -15);
                    debugOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), character.rotation.y);
                    debugCam.position.copy(character.position).add(debugOffset);
                    const debugLookAtTarget = character.position.clone();
                    debugLookAtTarget.y += 4;
                    debugCam.lookAt(debugLookAtTarget);
                    
                    headGroup.children.forEach(c => c.visible = true);
                    characterHandlesRef.current!.hairContainer.visible = true;
                } else {
                    headGroup.children.forEach(child => {
                        if (!(child instanceof THREE.Camera) && child !== characterHandlesRef.current!.hairContainer) {
                            child.visible = false;
                        }
                    });
                    characterHandlesRef.current!.hairContainer.visible = false;
                }
        
                renderer.autoClear = false;
                renderer.clearDepth();
                renderer.setScissorTest(true);
                renderer.setScissor(debugLeft, clientHeight - debugTop - debugHeight, debugWidth, debugHeight);
                renderer.setViewport(debugLeft, clientHeight - debugTop - debugHeight, debugWidth, debugHeight);
                renderer.render(scene, debugCamToRender);
                renderer.setScissorTest(false);
                renderer.autoClear = true;
                
                characterHandlesRef.current!.hairContainer.visible = originalHairVisibility;
                headGroup.children.forEach((c, i) => c.visible = originalHeadPartVisibility[i]);
            }
        }
      }
    };
    
    // --- Event Listeners for Desktop ---
    const handlePointerLockChange = () => {
      setIsPointerLocked(document.pointerLockElement === renderer.domElement);
    };
    const handlePointerLockError = () => console.error('PointerLock failed.');
    const handleMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement !== renderer.domElement) return;
      
      const character = characterHandlesRef.current?.group;
      const neck = characterHandlesRef.current?.neckGroup;
      if (!character || !neck) return;
      
      character.rotation.y -= event.movementX * MOUSE_SENSITIVITY;
      
      neck.rotation.x -= event.movementY * MOUSE_SENSITIVITY;
      neck.rotation.x = Math.max(-FIRST_PERSON_PITCH_LIMIT, Math.min(FIRST_PERSON_PITCH_LIMIT, neck.rotation.x));
    };
    const handleKeyDown = (event: KeyboardEvent) => { 
        const key = event.key.toLowerCase();
        keysPressed.current[key] = true; 
        if (key === 'c') {
            onCameraToggleRef.current();
        }
        if (key === 'v') {
            onToggleDebugViewRef.current();
        }
        if (key >= '1' && key <= '9') {
            const index = parseInt(key) - 1;
            const newIndex = currentWeaponIndexRef.current === index ? null : index;
            onWeaponSwitchRef.current(newIndex);
        }
    };
    const handleKeyUp = (event: KeyboardEvent) => { keysPressed.current[event.key.toLowerCase()] = false; };
    const handleMouseDown = (event: MouseEvent) => {
        if (document.pointerLockElement !== renderer.domElement) return;
        if (event.button === 0) { // Left mouse button
            keysPressed.current['mouse0'] = true;
            handleShoot();
        }
    };
    const handleMouseUp = (event: MouseEvent) => {
         if (event.button === 0) {
            keysPressed.current['mouse0'] = false;
        }
    };
    
    const raycaster = new THREE.Raycaster();
    const handleShoot = () => {
        const weaponIndex = currentWeaponIndexRef.current;
        if (weaponIndex === null) return;

        const gun = gunLibrary[weaponIndex];
        const now = clock.getElapsedTime();
        if (now - lastShotTimeRef.current < gun.fireRate) return;
        lastShotTimeRef.current = now;

        const activeCamera = cameraModeRef.current === 'first-person' ? firstPersonCamera : thirdPersonCamera;
        raycaster.setFromCamera({ x: 0, y: 0 }, activeCamera);
        const intersects = raycaster.intersectObjects(scene.children, true);

        let hitPoint = raycaster.ray.at(300, new THREE.Vector3());
        if (intersects.length > 0) {
            const firstHit = intersects.find(i => i.object !== characterHandlesRef.current?.group && !characterHandlesRef.current?.group.getObjectById(i.object.id));
            if (firstHit) {
                hitPoint = firstHit.point;
                sparkSystem.emit({
                    position: firstHit.point,
                    count: 15,
                    color: [new THREE.Color(0xffff00), new THREE.Color(0xff8800)],
                    velocityRandomness: 5,
                    size: [0.1, 0.3],
                    life: [0.2, 0.5],
                });
            }
        }

        const muzzlePosition = new THREE.Vector3();
        currentWeaponRef.current!.getWorldPosition(muzzlePosition);
        
        // Tracer
        const points = [muzzlePosition, hitPoint];
        const tracerGeo = new THREE.BufferGeometry().setFromPoints(points);
        const tracerMat = new THREE.LineBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.8 });
        const tracer = new THREE.Line(tracerGeo, tracerMat);
        tracer.userData.life = 0.05;
        scene.add(tracer);
        activeTracersRef.current.push(tracer);

        // Sound
        if (gunshotBufferRef.current) {
            const gunshotAudio = new THREE.PositionalAudio(listener);
            gunshotAudio.setBuffer(gunshotBufferRef.current);
            gunshotAudio.setRefDistance(20);
            gunshotAudio.setVolume(0.8);
            gunshotAudio.getOutput().connect(sfxGainRef.current!);
            currentWeaponRef.current!.add(gunshotAudio);
            gunshotAudio.play();
        }
    };


    if (!isMobile) {
      document.addEventListener('pointerlockchange', handlePointerLockChange);
      document.addEventListener('pointerlockerror', handlePointerLockError);
      document.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      renderer.domElement.addEventListener('mousedown', handleMouseDown);
      renderer.domElement.addEventListener('mouseup', handleMouseUp);
    }
    
    animate();

    const handleResize = () => {
      thirdPersonCamera.aspect = container.clientWidth / container.clientHeight;
      thirdPersonCamera.updateProjectionMatrix();
      firstPersonCamera.aspect = container.clientWidth / container.clientHeight;
      firstPersonCamera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      windNode.stop();
      activeVillages.forEach(village => {
        if (village.userData.audio && village.userData.audio.isPlaying) {
          village.userData.audio.stop();
        }
      });
      birdsRef.current.forEach(bird => {
        if (bird.userData.audio && bird.userData.audio.isPlaying) {
            bird.userData.audio.stop();
        }
      });

      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      rendererRef.current = null;

      if (!isMobile) {
        document.exitPointerLock();
        document.removeEventListener('pointerlockchange', handlePointerLockChange);
        document.removeEventListener('pointerlockerror', handlePointerLockError);
        document.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
        renderer.domElement.removeEventListener('mousedown', handleMouseDown);
        renderer.domElement.removeEventListener('mouseup', handleMouseUp);
      }

      particleTexture.dispose();
      dustSystem.dispose();
      sparkSystem.dispose();

      sun.geometry.dispose();(sun.material as THREE.Material).dispose();
      moon.geometry.dispose();((moon.material as THREE.MeshStandardMaterial).map as THREE.Texture)?.dispose();(moon.material as THREE.Material).dispose();
      stars.geometry.dispose();(stars.material as THREE.Material).dispose();
      clouds.children.forEach(cloud => {
        (cloud as THREE.Mesh).geometry.dispose();
        ((cloud as THREE.Mesh).material as THREE.Material[]).forEach(m => m.dispose());
      });

      birdBodyGeo.dispose(); birdWingGeo.dispose(); beakGeo.dispose(); allBirdMaterials.forEach(m => m.dispose());
      nestMaterial.dispose(); nestTwigGeo.dispose();
      groundTopGeo.dispose(); groundBaseGeo.dispose();
      grassTexture.dispose(); dirtTexture.dispose(); grassMaterial.dispose(); dirtMaterial.dispose();
      leafGeometry.dispose(); leafMaterial.dispose(); bushLeafGeo.dispose();

      flowerStemGeo.dispose(); flowerHeadGeo.dispose(); flowerStemMat.dispose();
      Object.values(flowerMaterials).forEach(m => m.dispose());
      mushroomStalkGeo.dispose(); mushroomCapGeo.dispose();
      Object.values(mushroomMaterials).forEach(m => m.dispose());
      grassBladeGeo.dispose(); grassMaterialGeneric.dispose();
      
      gunLibrary.forEach(gun => gun.model.traverse(c => {
          if (c instanceof THREE.Mesh) {
              c.geometry.dispose();
              (c.material as THREE.Material).dispose();
          }
      }));

      villagerSkinMat.dispose(); villagerEyeMat.dispose(); villagerMouthMat.dispose();
      Object.values(villagerHairMaterials).forEach(m => m.dispose());
      Object.values(villagerProfessionMaterials).forEach(m => m.dispose());
      villagerHeadGeo.dispose(); villagerNoseGeo.dispose(); villagerBodyGeo.dispose(); villagerArmGeo.dispose(); villagerLegGeo.dispose();
      flatTopHairGeo.dispose(); sidePartHairGeo.dispose(); bowlCutHairGeo.dispose(); apronGeo.dispose(); beltGeo.dispose(); hatBrimGeo.dispose(); hatTopGeo.dispose();
      
      woodPlankMat.dispose(); woodLogMat.dispose(); cobblestoneMat.dispose(); farmlandMat.dispose(); waterMat.dispose(); cropMat.dispose();

      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if(Array.isArray(object.material)) {
            object.material.forEach(m => m.dispose());
          } else if (object.material) {
            object.material.dispose();
          }
        }
      });
    };
  }, [gunLibrary]);
  
  // Effect to handle weapon switching
  useEffect(() => {
    if (characterHandlesRef.current && currentWeaponRef.current) {
        // Clear previous weapon
        while (currentWeaponRef.current.children.length > 0) {
            currentWeaponRef.current.remove(currentWeaponRef.current.children[0]);
        }
        // Add new weapon model
        if (currentWeaponIndex !== null && gunLibrary[currentWeaponIndex]) {
            const newWeaponModel = gunLibrary[currentWeaponIndex].model.clone();
            currentWeaponRef.current.add(newWeaponModel);
        }
    }
  }, [currentWeaponIndex, gunLibrary]);


  const handleContainerClick = () => {
    // Handle pointer lock for desktop controls.
    if (!isMobile && !isPointerLocked && rendererRef.current) {
      rendererRef.current.domElement.requestPointerLock().catch(err => console.error("Pointer lock failed:", err));
    }
  };

  return (
    <div className="w-full h-full relative" onClick={handleContainerClick}>
        <div ref={containerRef} className="w-full h-full" />
        {!isMobile && !isPointerLocked && (
            <div 
            className="absolute inset-0 flex items-center justify-center bg-black/50 cursor-pointer"
            onClick={handleContainerClick}
            >
            <div className="text-center text-white bg-gray-800/80 p-8 rounded-lg shadow-2xl shadow-cyan-500/10 border border-gray-700 pointer-events-none">
                <h2 className="text-3xl font-bold mb-4">Desktop Controls</h2>
                <p className="mb-2"><strong className="text-cyan-400">W, A, S, D:</strong> Move</p>
                <p className="mb-2"><strong className="text-cyan-400">Shift:</strong> Run</p>
                <p className="mb-2"><strong className="text-cyan-400">Mouse:</strong> Look</p>
                <p className="mb-2"><strong className="text-cyan-400">Spacebar:</strong> Jump</p>
                <p className="mb-2"><strong className="text-cyan-400">1-9:</strong> Switch Weapon</p>
                <p className="mb-2"><strong className="text-cyan-400">Click:</strong> Fire</p>
                <p className="mb-2"><strong className="text-cyan-400">C:</strong> Toggle Camera</p>
                <p className="mb-4"><strong className="text-cyan-400">V:</strong> Toggle Mini-View</p>
                <p className="text-xl mt-6 animate-pulse">Click to Start</p>
            </div>
            </div>
        )}
        {!isMobile && showDebugView && (
             <div 
                id="debug-view-container"
                className="absolute top-5 right-5 flex flex-col border border-white rounded-md bg-black/40 pointer-events-none shadow-lg"
                aria-hidden="true"
            >
                <h3 className="text-white font-semibold px-2 py-1 text-center text-sm bg-black/30 rounded-t-md">
                    {cameraMode === 'first-person' ? 'Third-Person View' : 'First-Person View'}
                </h3>
                <div id="debug-view-port" className="w-[200px] h-[200px]"></div>
            </div>
        )}
    </div>
  );
};

export default MinecraftScene;