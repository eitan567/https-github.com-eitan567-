import * as THREE from 'three';
import { CharacterAppearance } from '../../App';
import {
    birdBodyGeo, birdBlueMat, birdYellowMat, beakGeo, birdDarkMat, birdWingGeo, villagerBodyGeo, villagerSkinMat,
    villagerHeadGeo, villagerNoseGeo, villagerEyeMat, villagerMouthMat, flatTopHairGeo, villagerHairMaterials,
    hairColors, sidePartHairGeo, bowlCutHairGeo, apronGeo, beltGeo, hatBrimGeo, hatTopGeo, villagerArmGeo,
    villagerLegGeo, villagerProfessionMaterials
} from './geometries';
import { VillagerProfession } from './constants';
import { pseudoRandom } from './utils';


export interface CharacterHandles {
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


export const createBirdInstance = (): THREE.Group => {
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

export const createVillager = (profession: VillagerProfession, seed: number): THREE.Group => {
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

export const createCharacter = (appearance: CharacterAppearance): CharacterHandles => {
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

export const createDog = (): THREE.Group => {
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
