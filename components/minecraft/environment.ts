import * as THREE from 'three';
import { createMoonTexture, createCloudTexture } from './utils';
import { MOON_LAYER } from './constants';

// --- Dynamic Sky Element Creators ---
export const createStars = (): THREE.Points => {
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

export const createMoon = (): THREE.Mesh => {
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

export const createSun = (): THREE.Mesh => {
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

export const createClouds = (): THREE.Group => {
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

// --- Particle System ---
export interface Particle {
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

export interface ParticleEmitterOptions {
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

export class ParticleSystem {
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
