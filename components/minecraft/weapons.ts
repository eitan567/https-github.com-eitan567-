import * as THREE from 'three';

export const createGunLibrary = () => {
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
