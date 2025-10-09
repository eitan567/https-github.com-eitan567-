import * as THREE from 'three';

// --- World Generation Constants ---
export const CHUNK_SIZE = 32;
export const RENDER_DISTANCE_IN_CHUNKS = 5; 
export const TREE_DENSITY = 0.1; 
export const BUSH_DENSITY = 0.08;
export const DIRT_PATCH_DENSITY = 0.15;
export const FLOWER_DENSITY = 0.15;
export const MUSHROOM_DENSITY = 0.08;
export const GRASS_DENSITY = 0.3;
export const BIRD_TREE_CHANCE = 0.4;
export const NEST_CHANCE = 0.3;
export const VILLAGE_DENSITY = 0.04; 

// --- Game Constants ---
export const PLAYER_SPEED = 9;
export const PLAYER_RUN_MULTIPLIER = 2;
export const PLAYER_ROTATION_SPEED = 3;
export const GRAVITY = 30;
export const JUMP_FORCE = 10;
export const CAMERA_OFFSET = new THREE.Vector3(0, 12, -28);
export const DAY_NIGHT_CYCLE_SECONDS = 300;
export const START_TIME_OFFSET = DAY_NIGHT_CYCLE_SECONDS * 0.35;
export const MOON_LAYER = 1;
export const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
export const MOUSE_SENSITIVITY = 0.002;
export const FIRST_PERSON_PITCH_LIMIT = Math.PI / 2 - 0.1;


// --- Bird AI Constants ---
export const BIRD_MAX_SPEED = 4.0;
export const BIRD_PERCEPTION_RADIUS = 20;
export const BIRD_SEPARATION_DISTANCE = 5;
export const BIRD_ALIGNMENT_WEIGHT = 1.0;
export const BIRD_COHESION_WEIGHT = 1.0;
export const BIRD_SEPARATION_WEIGHT = 1.5;

// --- Villager AI Constants ---
export const VILLAGER_SPEED = 1.5;
export const VILLAGER_INTERACTION_RADIUS = 8;
export type VillagerProfession = 'farmer' | 'librarian' | 'blacksmith' | 'nitwit';


// --- Day/Night Cycle Colors & Intensities ---
export const keyframes = [
    { time: 0,    sky: new THREE.Color(0x00001a), fog: new THREE.Color(0x00001a), sun: 0.0, ambient: 0.05 }, // Midnight
    { time: 0.23, sky: new THREE.Color(0x00001a), fog: new THREE.Color(0x00001a), sun: 0.0, ambient: 0.05 }, // Pre-dawn
    { time: 0.25, sky: new THREE.Color(0xff8c00), fog: new THREE.Color(0xffa500), sun: 0.5, ambient: 0.3 }, // Sunrise
    { time: 0.30, sky: new THREE.Color(0x87CEEB), fog: new THREE.Color(0x87CEEB), sun: 0.9, ambient: 0.6 }, // Morning
    { time: 0.70, sky: new THREE.Color(0x87CEEB), fog: new THREE.Color(0x87CEEB), sun: 0.9, ambient: 0.6 }, // Afternoon
    { time: 0.75, sky: new THREE.Color(0xff8c00), fog: new THREE.Color(0xffa500), sun: 0.5, ambient: 0.3 }, // Sunset
    { time: 0.77, sky: new THREE.Color(0x00001a), fog: new THREE.Color(0x00001a), sun: 0.0, ambient: 0.05 }, // Post-dusk
    { time: 1.0,  sky: new THREE.Color(0x00001a), fog: new THREE.Color(0x00001a), sun: 0.0, ambient: 0.05 }  // Midnight
];
