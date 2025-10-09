import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { MoveVector, CameraMode, CharacterAppearance } from '../App';

import {
    CHUNK_SIZE, RENDER_DISTANCE_IN_CHUNKS, PLAYER_SPEED, PLAYER_RUN_MULTIPLIER,
    PLAYER_ROTATION_SPEED, GRAVITY, JUMP_FORCE, CAMERA_OFFSET, DAY_NIGHT_CYCLE_SECONDS,
    START_TIME_OFFSET, MOON_LAYER, isMobile, MOUSE_SENSITIVITY, FIRST_PERSON_PITCH_LIMIT,
    BIRD_MAX_SPEED, BIRD_PERCEPTION_RADIUS, BIRD_SEPARATION_DISTANCE, BIRD_ALIGNMENT_WEIGHT,
    BIRD_COHESION_WEIGHT, BIRD_SEPARATION_WEIGHT, VILLAGER_INTERACTION_RADIUS,
    keyframes, BIRD_TREE_CHANCE, VILLAGE_DENSITY, DIRT_PATCH_DENSITY,
    FLOWER_DENSITY, GRASS_DENSITY, MUSHROOM_DENSITY, BUSH_DENSITY, TREE_DENSITY
} from './minecraft/constants';
// FIX: Import findNewLandingSpot to resolve "Cannot find name" errors.
import { getHeight, createParticleTexture, floraNoise, pseudoRandom, findNewLandingSpot } from './minecraft/utils';
import {
    createCharacter, createDog, createBirdInstance, createVillager, CharacterHandles
} from './minecraft/creatures';
import {
    createHouse, createFarmPlot, createWell, createTree, createBush
} from './minecraft/world';
import {
    groundTopGeo, groundBaseGeo, grassMaterial, dirtMaterial, flowerStemGeo, flowerStemMat,
    flowerHeadGeo, flowerMaterials, mushroomStalkGeo, mushroomMaterials, mushroomCapGeo,
    grassBladeGeo, grassMaterialGeneric, allBirdMaterials
} from './minecraft/geometries';
import { createStars, createMoon, createSun, createClouds, ParticleSystem } from './minecraft/environment';
import { createGunLibrary } from './minecraft/weapons';

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
                const professions: ('farmer' | 'librarian' | 'blacksmith' | 'nitwit')[] = ['farmer', 'librarian', 'blacksmith', 'nitwit'];
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
                    data.stateTimer = wanderDist / 1.5 + (Math.random() * 2);
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
                        villager.position.x += direction.x * 1.5 * delta;
                        villager.position.z += direction.z * 1.5 * delta;
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
        const forwardInput = (keysPressed.current['W'] || keysPressed.current['w'] || keysPressed.current['arrowup'] ? 1 : 0) - (keysPressed.current['S'] || keysPressed.current['s'] || keysPressed.current['arrowdown'] ? 1 : 0);
        const strafeInput = (keysPressed.current['A'] || keysPressed.current['a'] || keysPressed.current['arrowleft'] ? 1 : 0) - (keysPressed.current['D'] || keysPressed.current['d'] || keysPressed.current['arrowright'] ? 1 : 0);
        
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
      
      // FIX: Added type guard `c instanceof THREE.Mesh` to prevent error when accessing `geometry`.
      const tail = dog.children.find(c => c instanceof THREE.Mesh && c.geometry.type === "BoxGeometry" && c.position.z < -1);
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

                const originalAspect = debugCamToRender.aspect;
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
                
                debugCamToRender.aspect = originalAspect;
                debugCamToRender.updateProjectionMatrix();
                
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
        // FIX: The first argument to setFromCamera must be a THREE.Vector2.
        raycaster.setFromCamera(new THREE.Vector2(0, 0), activeCamera);
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
        // FIX: Proactively fixed incorrect disposal logic. Added type guard and corrected material disposal.
        if (cloud instanceof THREE.Mesh) {
            cloud.geometry.dispose();
            (cloud.material as THREE.Material).dispose();
        }
      });

      allBirdMaterials.forEach(m => m.dispose());
      
      gunLibrary.forEach(gun => gun.model.traverse(c => {
          if (c instanceof THREE.Mesh) {
              c.geometry.dispose();
              (c.material as THREE.Material).dispose();
          }
      }));

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
      // FIX: Removed .catch() to resolve TypeScript error with older DOM typings.
      // An event listener for 'pointerlockerror' is already registered to handle failures.
      rendererRef.current.domElement.requestPointerLock();
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
