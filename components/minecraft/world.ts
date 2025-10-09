import * as THREE from 'three';
import { pseudoRandom } from './utils';
import { 
    leafGeometry, leafMaterial, nestTwigGeo, nestMaterial,
    bushLeafGeo, woodPlankMat, cobblestoneMat,
    woodLogMat, waterMat, farmlandMat, cropMat
} from './geometries';
import { NEST_CHANCE } from './constants';
import { findNewLandingSpot } from './utils';

export const createNest = (): THREE.Group => {
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

export const createTree = (x: number, z: number, seed: number): THREE.Group => {
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

export const createBush = (x: number, z: number, seed: number): THREE.Group => {
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


export const createHouse = (seed: number): THREE.Group => {
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

export const createFarmPlot = (seed: number): THREE.Group => {
    const farm = new THREE.Group();
    const width = 4 + Math.floor(pseudoRandom(seed++) * 3);
    const depth = 6 + Math.floor(pseudoRandom(seed++) * 4);
    
    const fencePostGeo = new THREE.BoxGeometry(0.3, 1.5, 0.3);

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

export const createWell = (seed: number): THREE.Group => {
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
