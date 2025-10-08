import React, { useEffect, useRef, useState } from 'react';
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
const BIRD_TREE_CHANCE = 0.4;
const NEST_CHANCE = 0.3; // 30% of trees with birds will have a nest

// --- Game Constants ---
const PLAYER_SPEED = 5;
const PLAYER_ROTATION_SPEED = 3;
const GRAVITY = 30;
const JUMP_FORCE = 10;
const CAMERA_OFFSET = new THREE.Vector3(0, 10, -21); // Lowered the camera
const DAY_NIGHT_CYCLE_SECONDS = 300; // A full day-night cycle lasts 5 minutes
const START_TIME_OFFSET = DAY_NIGHT_CYCLE_SECONDS * 0.35; // Start in the morning
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
    const size = 32; // Low-res pixelated look
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d')!;

    const baseR = parseInt(baseColor.slice(1, 3), 16);
    const baseG = parseInt(baseColor.slice(3, 5), 16);
    const baseB = parseInt(baseColor.slice(5, 7), 16);

    const imageData = context.createImageData(size, size);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const variation = (Math.random() - 0.5) * 40; // a bit of noise
        data[i] = Math.max(0, Math.min(255, baseR + variation));
        data[i + 1] = Math.max(0, Math.min(255, baseG + variation));
        data[i + 2] = Math.max(0, Math.min(255, baseB + variation));
        data[i + 3] = 255; // Alpha
    }

    context.putImageData(imageData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter; // Crucial for pixelated look
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

    // Base moon color
    ctx.fillStyle = '#c0c0c0';
    ctx.fillRect(0, 0, size, size);

    // Add some noise for texture
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const variation = (Math.random() - 0.5) * 20;
        data[i] += variation;
        data[i + 1] += variation;
        data[i + 2] += variation;
    }
    ctx.putImageData(imageData, 0, 0);

    // Create some large, dark 'seas' (maria)
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

    // Function to draw a crater
    const drawCrater = (x: number, y: number, r: number) => {
        const angle = Math.random() * Math.PI * 2;
        const highlightOffset = 0.2 * r;

        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();

        // Highlight on the opposite side
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.arc(x + Math.cos(angle) * highlightOffset, y + Math.sin(angle) * highlightOffset, r * 0.8, 0, Math.PI * 2);
        ctx.fill();
    };

    // Draw lots of craters
    for (let i = 0; i < 300; i++) {
        drawCrater(
            Math.random() * size,
            Math.random() * size,
            Math.random() * size * 0.04 + 2 // radius from 2 to ~22
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

// --- New Bird Component Geometries & Materials ---
const birdBodyGeo = new THREE.BufferGeometry();
const bodyVertices = new Float32Array([
    // Top (blue)
    0, 0.2, 0.3,   // 0: back top
    0.3, 0, 0,     // 1: right shoulder
    -0.3, 0, 0,    // 2: left shoulder
    0, 0.25, -0.4, // 3: head top
    // Bottom (yellow)
    0, -0.2, 0.5,  // 4: tail bottom
    0, -0.25, -0.2, // 5: belly
]);
birdBodyGeo.setAttribute('position', new THREE.BufferAttribute(bodyVertices, 3));
const bodyIndices = [
    // Top Blue Part
    0, 1, 2,  3, 2, 1,  0, 2, 4,
    0, 4, 1,  3, 1, 5,  3, 5, 2,
    // Bottom Yellow Part
    2, 5, 4,  1, 4, 5,
];
birdBodyGeo.setIndex(bodyIndices);
birdBodyGeo.addGroup(0, 18, 0); // Blue material for top
birdBodyGeo.addGroup(18, 6, 1); // Yellow material for bottom
birdBodyGeo.computeVertexNormals();

const birdWingGeo = new THREE.BufferGeometry();
const wingVertices = new Float32Array([
    // Vertices for a single wing, extending in +X direction
    0, 0, 0,          // 0: root
    1.2, 0, -0.2,     // 1: tip front
    0.8, 0.05, 0.5,   // 2: feather 1
    0.5, 0.0, 0.8,    // 3: feather 2 (back)
    0.2, -0.05, 0.4,  // 4: root back
]);
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
  
  // Create all materials based on appearance colors
  const skinMat = new THREE.MeshLambertMaterial({ color: appearance.skinColor });
  const hairMat = new THREE.MeshLambertMaterial({ color: appearance.hairColor });
  const shirtMat = new THREE.MeshLambertMaterial({ color: appearance.shirtColor });
  const pantsLightMat = new THREE.MeshLambertMaterial({ color: appearance.pantsColor });

  const darkPantsColor = new THREE.Color();
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(appearance.pantsColor).getHSL(hsl);
  darkPantsColor.setHSL(hsl.h, hsl.s, hsl.l * 0.7);
  const pantsDarkMat = new THREE.MeshLambertMaterial({ color: darkPantsColor });

  // Static materials
  const eyeWhiteMat = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
  const eyeBlueMat = new THREE.MeshLambertMaterial({ color: 0x4169E1 });
  const noseMat = new THREE.MeshLambertMaterial({ color: 0xC19A6B });
  const shoesMat = new THREE.MeshLambertMaterial({ color: 0x2C3E50 });

  const neckGroup = new THREE.Group();
  neckGroup.name = 'neckGroup';
  neckGroup.position.y = 5.5; // Top of the body, our pivot point

  const headGroup = new THREE.Group();
  headGroup.name = 'headGroup';
  headGroup.position.y = 1; // Position the head above the pivot point

  const headGeo = new THREE.BoxGeometry(2, 2, 2);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // --- Hair Styles ---
  const hairContainer = new THREE.Group();
  headGroup.add(hairContainer);

  // Standard Hair
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

  // Long Hair
  const longHair = new THREE.Group();
  const longHairTop = hairTop.clone();
  longHair.add(longHairTop);
  const longHairBack = new THREE.Mesh(new THREE.BoxGeometry(2.1, 2.5, 0.3), hairMat);
  longHairBack.position.set(0, -0.25, -1.05);
  longHair.add(longHairBack);
  
  // Bald (empty group)
  const baldHair = new THREE.Group();

  const hairStyles = { standard: standardHair, long: longHair, bald: baldHair };
  if (hairStyles[appearance.hairStyle]) {
      hairContainer.add(hairStyles[appearance.hairStyle]);
  }

  // --- Face details ---
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
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 2), bodyMat);
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
      return new THREE.Vector3(0, tree.userData.height, 0); // Fallback
    }
    const leafIndex = Math.floor(Math.random() * instancedLeaves.count);
    const matrix = new THREE.Matrix4();
    instancedLeaves.getMatrixAt(leafIndex, matrix);
    const leafPosition = new THREE.Vector3().setFromMatrixPosition(matrix);
    leafPosition.y -= 0.8; // Sit deep inside the leaf block for a more natural perch
    return leafPosition;
};

interface MinecraftSceneProps {
  move: MoveVector;
  isJumping: boolean;
  onJumpEnd: () => void;
  cameraMode: CameraMode;
  characterAppearance: CharacterAppearance;
  onCameraToggle: () => void;
}

const MinecraftScene: React.FC<MinecraftSceneProps> = ({ move, isJumping, onJumpEnd, cameraMode, characterAppearance, onCameraToggle }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const birdsRef = useRef<THREE.Group[]>([]);
  const characterHandlesRef = useRef<CharacterHandles | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const debugCameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  
  const moveRef = useRef(move);
  const isJumpingRef = useRef(isJumping);
  const onJumpEndRef = useRef(onJumpEnd);
  const cameraModeRef = useRef(cameraMode);
  const onCameraToggleRef = useRef(onCameraToggle);
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  useEffect(() => {
    moveRef.current = move;
    isJumpingRef.current = isJumping;
    onJumpEndRef.current = onJumpEnd;
    cameraModeRef.current = cameraMode;
    onCameraToggleRef.current = onCameraToggle;
  }, [move, isJumping, onJumpEnd, cameraMode, onCameraToggle]);

  useEffect(() => {
    if (!characterHandlesRef.current) return;

    const { materials, hairContainer, hairStyles } = characterHandlesRef.current;
    
    // Update colors
    materials.skin.color.set(characterAppearance.skinColor);
    materials.hair.color.set(characterAppearance.hairColor);
    materials.shirt.color.set(characterAppearance.shirtColor);
    materials.pantsLight.color.set(characterAppearance.pantsColor);
    
    const darkPantsColor = new THREE.Color();
    const hsl = { h: 0, s: 0, l: 0 };
    new THREE.Color(characterAppearance.pantsColor).getHSL(hsl);
    darkPantsColor.setHSL(hsl.h, hsl.s, hsl.l * 0.7);
    materials.pantsDark.color.copy(darkPantsColor);
    
    // Update hair style
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

    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, thirdPersonCamera);
    composer.addPass(renderPass);

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(container.clientWidth, container.clientHeight),
        0.5, // strength
        0.4, // radius
        0.85 // threshold
    );
    composer.addPass(bloomPass);

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
    
    firstPersonCamera.position.set(0, 0.1, 0.5);
    firstPersonCamera.rotation.y = Math.PI;
    handles.headGroup.add(firstPersonCamera);

    const dog = createDog();
    dog.position.set(-3, getHeight(-3, 2), 2);
    dog.rotation.y = Math.PI / 4;
    scene.add(dog);

    const stars = createStars();
    stars.position.y = -100; // Offset to avoid clipping with near plane
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
            for (let i = 0; i < CHUNK_SIZE; i += 2) {
              for (let j = 0; j < CHUNK_SIZE; j += 2) {
                const worldX = x * CHUNK_SIZE + i - CHUNK_SIZE / 2 + 1;
                const worldZ = z * CHUNK_SIZE + j - CHUNK_SIZE / 2 + 1;
                const groundY = getHeight(worldX, worldZ);
                const blockSeed = Math.floor(worldX) * 1839 + Math.floor(worldZ) * 3847;
                
                matrixDummy.position.set(i - CHUNK_SIZE / 2 + 1, groundY - 1.75, j - CHUNK_SIZE / 2 + 1);
                matrixDummy.updateMatrix();
                dirtBaseMatrices.push(matrixDummy.matrix.clone());

                matrixDummy.position.set(i - CHUNK_SIZE / 2 + 1, groundY - 0.25, j - CHUNK_SIZE / 2 + 1);
                matrixDummy.updateMatrix();
                if (pseudoRandom(blockSeed) > DIRT_PATCH_DENSITY) {
                    grassMatrices.push(matrixDummy.matrix.clone());
                } else {
                    dirtTopMatrices.push(matrixDummy.matrix.clone());
                }
              }
            }
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
            const seed = x * 1839 + z * 3847;
            if (pseudoRandom(seed) < TREE_DENSITY) {
              const treeX = (pseudoRandom(seed * 2) - 0.5) * CHUNK_SIZE * 0.8;
              const treeZ = (pseudoRandom(seed * 3) - 0.5) * CHUNK_SIZE * 0.8;
              const tree = createTree(treeX, treeZ, seed);
              tree.position.y = getHeight(chunkGroup.position.x + treeX, chunkGroup.position.z + treeZ);
              chunkGroup.add(tree);

              if (pseudoRandom(seed * 5) < BIRD_TREE_CHANCE) {
                  const numBirds = Math.floor(pseudoRandom(seed * 7) * 3) + 1; // 1-3 birds
                  const instancedLeaves = tree.children.find(c => c instanceof THREE.InstancedMesh) as THREE.InstancedMesh;
                  if (instancedLeaves) {
                      for (let i = 0; i < numBirds; i++) {
                          const bird = createBirdInstance();
                          const treeHasNest = !!tree.userData.nest;

                          bird.userData = {
                              ...bird.userData,
                              state: 'SITTING', // SITTING, FLYING
                              flightMode: 'NONE', // CIRCLING, EXPLORING, SWOOPING, RETURNING
                              homeTree: tree,
                              nest: treeHasNest ? tree.userData.nest : null,
                              chunkId: chunkId,
                              stateTimer: pseudoRandom(seed * 13 * (i+1)) * 10 + 5, // 5-15 seconds
                              landingSpot: treeHasNest ? tree.userData.nest.position.clone() : findNewLandingSpot(tree),
                              flapOffset: Math.random() * Math.PI * 2,
                              velocity: new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).normalize().multiplyScalar(BIRD_MAX_SPEED),
                          };
                          
                          const treeWorldPos = chunkGroup.position.clone().add(tree.position);
                          bird.position.copy(treeWorldPos).add(bird.userData.landingSpot);
                          if (treeHasNest) {
                              bird.position.y += 0.2; // Sit inside nest
                          }

                          const lookAwayTarget = bird.position.clone().add(new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize());
                          bird.lookAt(lookAwayTarget);

                          scene.add(bird);
                          birdsRef.current.push(bird);
                      }
                  }
              }
            }
            if (pseudoRandom(seed*5) < BUSH_DENSITY) {
                const bushX = (pseudoRandom(seed * 7) - 0.5) * CHUNK_SIZE * 0.9;
                const bushZ = (pseudoRandom(seed * 11) - 0.5) * CHUNK_SIZE * 0.9;
                const bush = createBush(bushX, bushZ, seed);
                bush.position.y = getHeight(chunkGroup.position.x + bushX, chunkGroup.position.z + bushZ) + 0.5;
                chunkGroup.add(bush);
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
          birdsRef.current = birdsRef.current.filter(bird => {
            if (bird.userData.chunkId === chunkId) {
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
    const targetLookAt = new THREE.Vector3(); // For camera

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();
      
      const currentIsJumping = isJumpingRef.current;
      const currentCameraMode = cameraModeRef.current;
      const character = characterHandlesRef.current?.group;
      if (!character) return;

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
                      data.flightMode = 'CIRCLING';
                      data.stateTimer = Math.random() * 8 + 8;
                      data.circleAngle = Math.random() * Math.PI * 2;
                      data.circleRadius = Math.random() * 10 + 10;
                      data.circleAltitude = Math.random() * 5 + 5;
                  } else if (rand < 0.85) {
                      data.flightMode = 'EXPLORING';
                      data.stateTimer = Math.random() * 10 + 15;
                  } else {
                      data.flightMode = 'SWOOPING';
                      data.homeTree.getWorldPosition(treeWorldPosHelper);
                      data.swoopTarget = new THREE.Vector3(treeWorldPosHelper.x + (Math.random() - 0.5) * 20, treeWorldPosHelper.y - 1, treeWorldPosHelper.z + (Math.random() - 0.5) * 20);
                      data.swoopPhase = 'DIVE';
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
                      if (!data.nest) {
                        data.landingSpot = findNewLandingSpot(data.homeTree);
                      }
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
                          data.flightMode = 'CIRCLING';
                          data.stateTimer = Math.random() * 8 + 8;
                          data.circleAngle = Math.random() * Math.PI * 2;
                          data.circleRadius = Math.random() * 10 + 10;
                          data.circleAltitude = Math.random() * 5 + 5;
                      }
                  }
              } else if (data.flightMode === 'EXPLORING') {
                  const alignment = new THREE.Vector3();
                  const cohesion = new THREE.Vector3();
                  const separation = new THREE.Vector3();
                  let neighborCount = 0;

                  for (const otherBird of birdsRef.current) {
                      if (otherBird !== bird && otherBird.userData.state === 'FLYING' && otherBird.userData.flightMode === 'EXPLORING') {
                          const dist = bird.position.distanceTo(otherBird.position);
                          if (dist > 0 && dist < BIRD_PERCEPTION_RADIUS) {
                              alignment.add(otherBird.userData.velocity);
                              cohesion.add(otherBird.position);
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
                      const wanderStrength = 0.3;
                      const wanderVector = new THREE.Vector3(
                          (Math.random() - 0.5),
                          (Math.random() - 0.5) * 0.3,
                          (Math.random() - 0.5)
                      );
                      data.velocity.add(wanderVector.normalize().multiplyScalar(wanderStrength));
                  }

                  if (data.velocity.lengthSq() < 0.1) {
                      data.velocity.set(Math.random() - 0.5, 0, Math.random() - 0.5);
                  }

                  data.velocity.clampLength(BIRD_MAX_SPEED * 0.6, BIRD_MAX_SPEED);
                  
                  bird.position.add(data.velocity.clone().multiplyScalar(delta));
                  const lookTarget = bird.position.clone().add(data.velocity);
                  bird.lookAt(lookTarget);

                  if (data.stateTimer <= 0) {
                      data.flightMode = 'RETURNING';
                      if (!data.nest) {
                          data.landingSpot = findNewLandingSpot(data.homeTree);
                      }
                  }
              }
              break;
          }
        });
      }

      // --- Player Movement ---
      let walkMagnitude = 0;
      if (isMobile) {
        const currentMove = moveRef.current;
        character.rotation.y -= currentMove.x * PLAYER_ROTATION_SPEED * delta;
        walkMagnitude = Math.abs(currentMove.y);
        if (currentMove.y !== 0) {
          const moveSpeed = PLAYER_SPEED * currentMove.y;
          character.position.x += Math.sin(character.rotation.y) * moveSpeed * delta;
          character.position.z += Math.cos(character.rotation.y) * moveSpeed * delta;
        }
      } else { // Desktop movement
        const forwardInput = (keysPressed.current['w'] || keysPressed.current['arrowup'] ? 1 : 0) - (keysPressed.current['s'] || keysPressed.current['arrowdown'] ? 1 : 0);
        const strafeInput = (keysPressed.current['a'] || keysPressed.current['arrowleft'] ? 1 : 0) - (keysPressed.current['d'] || keysPressed.current['arrowright'] ? 1 : 0);
        
        walkMagnitude = Math.max(Math.abs(forwardInput), Math.abs(strafeInput));

        if (forwardInput !== 0 || strafeInput !== 0) {
            const moveDirection = new THREE.Vector3(strafeInput, 0, forwardInput).normalize();
            const moveSpeed = PLAYER_SPEED * delta;
            
            const forwardDir = new THREE.Vector3(Math.sin(character.rotation.y), 0, Math.cos(character.rotation.y));
            const rightDir = new THREE.Vector3(forwardDir.z, 0, -forwardDir.x);

            character.position.add(forwardDir.multiplyScalar(moveDirection.z * moveSpeed));
            character.position.add(rightDir.multiplyScalar(moveDirection.x * moveSpeed));
        }
      }
      
      const groundYPosition = getHeight(character.position.x, character.position.z) + 1.0;

      playerVelocity.y -= GRAVITY * delta;
      character.position.y += playerVelocity.y * delta;

      if (isMobile) {
        if (currentIsJumping && isOnGround) {
          playerVelocity.y = JUMP_FORCE;
          isOnGround = false;
          onJumpEndRef.current();
        }
      } else {
        if (keysPressed.current[' '] && isOnGround) {
          playerVelocity.y = JUMP_FORCE;
          isOnGround = false;
        }
      }

      if (character.position.y <= groundYPosition) {
        character.position.y = groundYPosition;
        playerVelocity.y = 0;
        isOnGround = true;
      }
      
      const playerChunkX = Math.floor(character.position.x / CHUNK_SIZE);
      const playerChunkZ = Math.floor(character.position.z / CHUNK_SIZE);
      if (!lastPlayerChunk || lastPlayerChunk.x !== playerChunkX || lastPlayerChunk.z !== playerChunkZ) {
        updateWorld(character.position.x, character.position.z);
        lastPlayerChunk = { x: playerChunkX, z: playerChunkZ };
      }
      
      const { leftArm, rightArm, leftLeg, rightLeg } = characterHandlesRef.current!;
      if (isOnGround && walkMagnitude > 0.1) {
        const walkSpeed = elapsedTime * 8 * walkMagnitude;
        const swingAngle = Math.sin(walkSpeed) * 0.6;
        leftArm.rotation.x = swingAngle;
        rightArm.rotation.x = -swingAngle;
        leftLeg.rotation.x = -swingAngle;
        rightLeg.rotation.x = swingAngle;
      } else if (isOnGround) {
        leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, 0, delta * 10);
        rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, 0, delta * 10);
        leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, 0, delta * 10);
        rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, 0, delta * 10);
      } else {
        const jumpAngle = 0.5;
        leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x, -jumpAngle, delta * 5);
        rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x, -jumpAngle, delta * 5);
        leftLeg.rotation.x = THREE.MathUtils.lerp(leftLeg.rotation.x, jumpAngle, delta * 5);
        rightLeg.rotation.x = THREE.MathUtils.lerp(rightLeg.rotation.x, jumpAngle, delta * 5);
      }
      
      const tail = dog.children[dog.children.length - 1];
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
        const neck = characterHandlesRef.current!.neckGroup;
        const idealOffset = CAMERA_OFFSET.clone();

        idealOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), character.rotation.y);
        const targetCameraPosition = character.position.clone().add(idealOffset);
        thirdPersonCamera.position.lerp(targetCameraPosition, delta * 15);

        neck.getWorldPosition(targetLookAt);
        const lookDirection = new THREE.Vector3();
        neck.getWorldDirection(lookDirection);
        targetLookAt.add(lookDirection.multiplyScalar(50));
        thirdPersonCamera.lookAt(targetLookAt);
      }

      const activeCamera = currentCameraMode === 'first-person' ? firstPersonCamera : thirdPersonCamera;
      renderPass.camera = activeCamera;
      
      const { clientWidth, clientHeight } = renderer.domElement;
      renderer.setViewport(0, 0, clientWidth, clientHeight);
      renderer.setScissor(0, 0, clientWidth, clientHeight);
      composer.render();

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

                // Save original visibility
                const originalHairVisibility = characterHandlesRef.current!.hairContainer.visible;
                const originalHeadPartVisibility: { [key: number]: boolean } = {};
                headGroup.children.forEach((c, i) => originalHeadPartVisibility[i] = c.visible);

                // Set visibility for debug render
                if (isShowingThirdPersonInBox) {
                    const debugCam = debugCameraRef.current;
                    const debugOffset = new THREE.Vector3(0, 8, -15); // From the back
                    debugOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), character.rotation.y);
                    debugCam.position.copy(character.position).add(debugOffset);
                    const debugLookAtTarget = character.position.clone();
                    debugLookAtTarget.y += 4;
                    debugCam.lookAt(debugLookAtTarget);
                    
                    headGroup.children.forEach(c => c.visible = true);
                    characterHandlesRef.current!.hairContainer.visible = true;
                } else { // Showing first person in box
                    headGroup.children.forEach(child => {
                        if (!(child instanceof THREE.Camera) && child !== characterHandlesRef.current!.hairContainer) {
                            child.visible = false;
                        }
                    });
                    characterHandlesRef.current!.hairContainer.visible = false;
                }
        
                // Render debug view
                renderer.autoClear = false;
                renderer.clearDepth();
                renderer.setScissorTest(true);
                renderer.setScissor(debugLeft, clientHeight - debugTop - debugHeight, debugWidth, debugHeight);
                renderer.setViewport(debugLeft, clientHeight - debugTop - debugHeight, debugWidth, debugHeight);
                renderer.render(scene, debugCamToRender);
                renderer.setScissorTest(false);
                renderer.autoClear = true;
                
                // Restore original visibility
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
    };
    const handleKeyUp = (event: KeyboardEvent) => { keysPressed.current[event.key.toLowerCase()] = false; };
    
    if (!isMobile) {
      document.addEventListener('pointerlockchange', handlePointerLockChange);
      document.addEventListener('pointerlockerror', handlePointerLockError);
      document.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
    }
    
    animate();

    const handleResize = () => {
      thirdPersonCamera.aspect = container.clientWidth / container.clientHeight;
      thirdPersonCamera.updateProjectionMatrix();
      firstPersonCamera.aspect = container.clientWidth / container.clientHeight;
      firstPersonCamera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      composer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
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
      }

      sun.geometry.dispose();
      (sun.material as THREE.Material).dispose();
      moon.geometry.dispose();
      ((moon.material as THREE.MeshStandardMaterial).map as THREE.Texture)?.dispose();
      (moon.material as THREE.Material).dispose();
      stars.geometry.dispose();
      (stars.material as THREE.Material).dispose();
      clouds.children.forEach(cloud => {
        (cloud as THREE.Mesh).geometry.dispose();
        ((cloud as THREE.Mesh).material as THREE.Material[]).forEach(m => m.dispose());
      });

      birdBodyGeo.dispose();
      birdWingGeo.dispose();
      beakGeo.dispose();
      allBirdMaterials.forEach(m => m.dispose());
      
      nestMaterial.dispose();
      nestTwigGeo.dispose();
      groundTopGeo.dispose();
      groundBaseGeo.dispose();
      grassTexture.dispose();
      dirtTexture.dispose();
      grassMaterial.dispose();
      dirtMaterial.dispose();
      leafGeometry.dispose();
      leafMaterial.dispose();
      bushLeafGeo.dispose();
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
  }, []);

  const handleContainerClick = () => {
    if (!isMobile && !isPointerLocked && rendererRef.current) {
      Promise.resolve(rendererRef.current.domElement.requestPointerLock())
        .catch(err => console.error(err));
    }
  };

  return (
    <div className="w-full h-full relative" onClick={handleContainerClick}>
        <div ref={containerRef} className="w-full h-full" />
        {!isMobile && !isPointerLocked && (
            <div 
            className="absolute inset-0 flex items-center justify-center bg-black/50 cursor-pointer pointer-events-none"
            aria-hidden="true"
            >
            <div className="text-center text-white bg-gray-800/80 p-8 rounded-lg shadow-2xl shadow-cyan-500/10 border border-gray-700">
                <h2 className="text-3xl font-bold mb-4">Desktop Controls</h2>
                <p className="mb-2"><strong className="text-cyan-400">W, A, S, D:</strong> Move</p>
                <p className="mb-2"><strong className="text-cyan-400">Mouse:</strong> Look</p>
                <p className="mb-2"><strong className="text-cyan-400">Spacebar:</strong> Jump</p>
                <p className="mb-4"><strong className="text-cyan-400">C:</strong> Toggle Camera</p>
                <p className="text-xl mt-6 animate-pulse">Click to Start</p>
            </div>
            </div>
        )}
        {!isMobile && (
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