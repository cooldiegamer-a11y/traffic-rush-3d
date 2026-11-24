import * as THREE from 'three';
import { CarSpec, TrafficKind } from '../types/traffic';

export interface SportsCarRig {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  frontPivots: THREE.Object3D[];
  taillightMat: THREE.MeshStandardMaterial;
  headlightMat: THREE.MeshStandardMaterial;
  nitroFlames: THREE.Mesh[];
  headlightBeams: THREE.Mesh[];
}

export interface TrafficRig {
  group: THREE.Group;
  wheels: THREE.Object3D[];
  halfWidth: number;
  halfLength: number;
  taillightMat: THREE.MeshStandardMaterial;
}

const tireMat = new THREE.MeshStandardMaterial({
  color: 0x16181d,
  roughness: 0.88,
  metalness: 0.05,
});

const rimMat = new THREE.MeshStandardMaterial({
  color: 0xe2e8f0,
  roughness: 0.18,
  metalness: 0.92,
});

const darkTrimMat = new THREE.MeshStandardMaterial({
  color: 0x111827,
  roughness: 0.55,
  metalness: 0.3,
});

const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0x0b1324,
  roughness: 0.08,
  metalness: 0.25,
  clearcoat: 1.0,
  clearcoatRoughness: 0.05,
});

const chromeMat = new THREE.MeshStandardMaterial({
  color: 0xf1f5f9,
  roughness: 0.12,
  metalness: 0.95,
});

function createWheel(
  radius: number,
  width: number,
  caliperColor?: string
): THREE.Group {
  const wheel = new THREE.Group();

  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 18);
  tireGeo.rotateZ(Math.PI / 2);
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  wheel.add(tire);

  const rimGeo = new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width + 0.02, 12);
  rimGeo.rotateZ(Math.PI / 2);
  const rim = new THREE.Mesh(rimGeo, rimMat);
  wheel.add(rim);

  // Cross spoke detail
  const spokeGeo = new THREE.BoxGeometry(width + 0.04, radius * 1.12, radius * 0.16);
  const spoke1 = new THREE.Mesh(spokeGeo, rimMat);
  const spoke2 = new THREE.Mesh(spokeGeo, rimMat);
  spoke2.rotation.x = Math.PI / 2;
  wheel.add(spoke1, spoke2);

  if (caliperColor) {
    const calMat = new THREE.MeshStandardMaterial({
      color: caliperColor,
      roughness: 0.3,
      metalness: 0.6,
    });
    const caliper = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.6, radius * 0.45, radius * 0.35),
      calMat
    );
    caliper.position.set(0, radius * 0.25, radius * 0.2);
    wheel.add(caliper);
  }

  return wheel;
}

function addContactShadow(
  parent: THREE.Group,
  width: number,
  length: number,
  shadowTex: THREE.Texture
) {
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.58,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.02;
  parent.add(mesh);
}

export function buildSportsCar(
  spec: CarSpec,
  contactShadowTex: THREE.Texture
): SportsCarRig {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];
  const frontPivots: THREE.Object3D[] = [];
  const nitroFlames: THREE.Mesh[] = [];
  const headlightBeams: THREE.Mesh[] = [];

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: spec.primaryColor,
    roughness: 0.2,
    metalness: 0.68,
    clearcoat: 1.0,
    clearcoatRoughness: 0.07,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: spec.accentColor,
    roughness: 0.35,
    metalness: 0.5,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfef08a,
    emissiveIntensity: 1.4,
    roughness: 0.1,
  });

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 1.2,
    roughness: 0.2,
  });

  // 1. Contact shadow
  addContactShadow(group, 2.5, 4.9, contactShadowTex);

  // 2. Sculpted lower chassis using ExtrudeGeometry side profile (pointing -Z)
  const profile = new THREE.Shape();
  profile.moveTo(-2.12, 0.22); // Rear bumper bottom
  profile.lineTo(2.12, 0.22);  // Front splitter bottom
  profile.lineTo(2.18, 0.42);  // Front nose lip
  profile.lineTo(1.88, 0.64);  // Front hood edge
  profile.lineTo(0.82, 0.78);  // Base of windshield
  profile.lineTo(0.22, 1.18);  // Roof front
  profile.lineTo(-0.78, 1.18); // Roof rear
  profile.lineTo(-1.75, 0.82); // Rear fastback deck
  profile.lineTo(-2.14, 0.72); // Rear tail edge
  profile.closePath();

  const chassisGeo = new THREE.ExtrudeGeometry(profile, {
    steps: 1,
    depth: 1.76,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.07,
    bevelSegments: 2,
  });
  // Extrude is in XY with depth along +Z; rotate so length is along Z (-Z is front)
  chassisGeo.translate(0, 0, -0.88);
  chassisGeo.rotateY(Math.PI / 2);

  const chassis = new THREE.Mesh(chassisGeo, bodyMat);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  group.add(chassis);

  // 3. Front carbon splitter & side skirts
  const splitter = new THREE.Mesh(
    new THREE.BoxGeometry(1.94, 0.08, 0.45),
    darkTrimMat
  );
  splitter.position.set(0, 0.23, -2.02);
  group.add(splitter);

  const diffuser = new THREE.Mesh(
    new THREE.BoxGeometry(1.86, 0.14, 0.35),
    darkTrimMat
  );
  diffuser.position.set(0, 0.26, 2.02);
  group.add(diffuser);

  // 4. Racing stripe / hood accent
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(spec.bodyStyle === 'gt' ? 0.42 : 0.72, 0.02, 1.35),
    accentMat
  );
  stripe.position.set(0, 0.76, -1.32);
  stripe.rotation.x = 0.11;
  group.add(stripe);

  // 5. Glass cockpit wrap (windshield + side windows + rear glass)
  const windshield = new THREE.Mesh(
    new THREE.BoxGeometry(1.52, 0.46, 0.96),
    glassMat
  );
  windshield.position.set(0, 0.97, -0.25);
  windshield.rotation.x = 0.56;
  group.add(windshield);

  const rearGlass = new THREE.Mesh(
    new THREE.BoxGeometry(1.48, 0.08, 0.98),
    glassMat
  );
  rearGlass.position.set(0, 1.02, 0.92);
  rearGlass.rotation.x = -0.34;
  group.add(rearGlass);

  const sideGlass = new THREE.Mesh(
    new THREE.BoxGeometry(1.82, 0.32, 1.25),
    glassMat
  );
  sideGlass.position.set(0, 0.96, 0.25);
  group.add(sideGlass);

  // 6. Side mirrors
  for (const side of [-1, 1]) {
    const mirror = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.12, 0.16),
      bodyMat
    );
    mirror.position.set(side * 1.04, 0.84, -0.58);
    group.add(mirror);
  }

  // 7. Style-specific Rear Spoiler
  if (spec.bodyStyle !== 'muscle') {
    const wingY = spec.bodyStyle === 'track' || spec.bodyStyle === 'hyper' ? 1.15 : 1.02;
    const wingWidth = spec.bodyStyle === 'track' ? 1.98 : 1.78;
    const wingBlade = new THREE.Mesh(
      new THREE.BoxGeometry(wingWidth, 0.06, 0.3),
      accentMat
    );
    wingBlade.position.set(0, wingY, 1.88);
    wingBlade.rotation.x = 0.08;
    group.add(wingBlade);

    for (const side of [-0.56, 0.56]) {
      const pylon = new THREE.Mesh(
        new THREE.BoxGeometry(0.06, wingY - 0.72, 0.16),
        darkTrimMat
      );
      pylon.position.set(side, 0.72 + (wingY - 0.72) / 2, 1.86);
      group.add(pylon);
    }

    // Wing endplates
    for (const side of [-1, 1]) {
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.22, 0.34),
        bodyMat
      );
      plate.position.set(side * (wingWidth / 2), wingY, 1.88);
      group.add(plate);
    }
  } else {
    // Muscle ducktail lip
    const ducktail = new THREE.Mesh(
      new THREE.BoxGeometry(1.78, 0.16, 0.18),
      accentMat
    );
    ducktail.position.set(0, 0.84, 1.98);
    ducktail.rotation.x = -0.35;
    group.add(ducktail);
  }

  // 8. Headlights & Taillights
  for (const side of [-1, 1]) {
    const hl = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.12, 0.1),
      headlightMat
    );
    hl.position.set(side * 0.65, 0.54, -2.14);
    group.add(hl);

    const tl = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.12, 0.08),
      taillightMat
    );
    tl.position.set(side * 0.62, 0.62, 2.13);
    group.add(tl);
  }

  // Center light bar accent for hyper/track
  if (spec.bodyStyle === 'hyper' || spec.bodyStyle === 'track') {
    const centerBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.05, 0.06),
      taillightMat
    );
    centerBar.position.set(0, 0.62, 2.13);
    group.add(centerBar);
  }

  // 9. Twin Exhausts & Nitro Flame Cones
  const flameGeo = new THREE.ConeGeometry(0.14, 0.95, 10);
  flameGeo.rotateX(Math.PI / 2);
  flameGeo.translate(0, 0, 0.48);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.9,
  });

  for (const side of [-0.48, 0.48]) {
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.22, 10),
      chromeMat
    );
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(side, 0.28, 2.14);
    group.add(pipe);

    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(side, 0.28, 2.18);
    flame.visible = false;
    group.add(flame);
    nitroFlames.push(flame);
  }

  // 10. Ground headlight beams (visible in Night mode)
  const beamGeo = new THREE.PlaneGeometry(2.2, 16);
  beamGeo.rotateX(-Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xfef9c3,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  for (const side of [-0.65, 0.65]) {
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(side, 0.03, -10.2);
    beam.visible = false;
    group.add(beam);
    headlightBeams.push(beam);
  }

  // 11. Four Wheels (Front wheels inside steering pivots)
  const wheelY = 0.35;
  const frontZ = -1.32;
  const rearZ = 1.32;
  const trackX = 0.93;

  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * trackX, wheelY, frontZ);
    const fWheel = createWheel(0.35, 0.26, spec.caliperColor);
    pivot.add(fWheel);
    group.add(pivot);
    frontPivots.push(pivot);
    wheels.push(fWheel);

    const rWheel = createWheel(0.36, 0.28, spec.caliperColor);
    rWheel.position.set(side * trackX, wheelY, rearZ);
    group.add(rWheel);
    wheels.push(rWheel);
  }

  return {
    group,
    wheels,
    frontPivots,
    taillightMat,
    headlightMat,
    nitroFlames,
    headlightBeams,
  };
}

export function buildTrafficVehicle(
  kind: TrafficKind,
  colorHex: string,
  contactShadowTex: THREE.Texture
): TrafficRig {
  const group = new THREE.Group();
  const wheels: THREE.Object3D[] = [];

  const paintMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.34,
    metalness: 0.45,
  });

  const taillightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 1.0,
    roughness: 0.25,
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfef08a,
    emissiveIntensity: 0.9,
  });

  let halfWidth = 0.95;
  let halfLength = 2.1;

  if (kind === 'sedan') {
    halfWidth = 0.92;
    halfLength = 2.05;
    addContactShadow(group, 2.3, 4.6, contactShadowTex);

    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.56, 4.1), paintMat);
    lower.position.y = 0.54;
    lower.castShadow = true;
    group.add(lower);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.5, 2.05), paintMat);
    cabin.position.set(0, 1.04, 0.12);
    cabin.castShadow = true;
    group.add(cabin);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.38, 1.92), glassMat);
    glass.position.set(0, 1.03, 0.12);
    group.add(glass);

    for (const side of [-0.62, 0.62]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.13, 0.06), taillightMat);
      tl.position.set(side, 0.6, 2.06);
      group.add(tl);

      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.12, 0.06), headlightMat);
      hl.position.set(side, 0.54, -2.06);
      group.add(hl);
    }

    for (const side of [-0.9, 0.9]) {
      for (const zPos of [-1.25, 1.25]) {
        const w = createWheel(0.33, 0.22);
        w.position.set(side, 0.33, zPos);
        group.add(w);
        wheels.push(w);
      }
    }
  } else if (kind === 'suv') {
    halfWidth = 1.0;
    halfLength = 2.25;
    addContactShadow(group, 2.5, 5.0, contactShadowTex);

    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.66, 4.45), paintMat);
    lower.position.y = 0.64;
    lower.castShadow = true;
    group.add(lower);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.62, 2.7), paintMat);
    cabin.position.set(0, 1.25, 0.32);
    cabin.castShadow = true;
    group.add(cabin);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.44, 2.55), glassMat);
    glass.position.set(0, 1.24, 0.32);
    group.add(glass);

    // Roof rails
    for (const side of [-0.72, 0.72]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 2.1), darkTrimMat);
      rail.position.set(side, 1.59, 0.32);
      group.add(rail);
    }

    for (const side of [-0.68, 0.68]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.06), taillightMat);
      tl.position.set(side, 0.72, 2.23);
      group.add(tl);
    }

    for (const side of [-0.96, 0.96]) {
      for (const zPos of [-1.38, 1.38]) {
        const w = createWheel(0.38, 0.26);
        w.position.set(side, 0.38, zPos);
        group.add(w);
        wheels.push(w);
      }
    }
  } else if (kind === 'pickup') {
    halfWidth = 1.02;
    halfLength = 2.4;
    addContactShadow(group, 2.5, 5.2, contactShadowTex);

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.62, 4.75), paintMat);
    chassis.position.y = 0.62;
    chassis.castShadow = true;
    group.add(chassis);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.84, 0.62, 1.75), paintMat);
    cab.position.set(0, 1.22, -0.55);
    cab.castShadow = true;
    group.add(cab);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.42, 1.58), glassMat);
    glass.position.set(0, 1.22, -0.55);
    group.add(glass);

    // Bed liner
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.12, 1.85), darkTrimMat);
    bed.position.set(0, 0.9, 1.3);
    group.add(bed);

    for (const side of [-0.7, 0.7]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.06), taillightMat);
      tl.position.set(side, 0.7, 2.38);
      group.add(tl);
    }

    for (const side of [-0.98, 0.98]) {
      for (const zPos of [-1.45, 1.45]) {
        const w = createWheel(0.39, 0.27);
        w.position.set(side, 0.39, zPos);
        group.add(w);
        wheels.push(w);
      }
    }
  } else if (kind === 'truck') {
    halfWidth = 1.18;
    halfLength = 4.1;
    addContactShadow(group, 2.9, 8.8, contactShadowTex);

    // Cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.24, 1.85, 2.2), paintMat);
    cab.position.set(0, 1.25, -2.9);
    cab.castShadow = true;
    group.add(cab);

    const cabWindshield = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.65, 0.15), glassMat);
    cabWindshield.position.set(0, 1.62, -3.96);
    group.add(cabWindshield);

    // Cargo trailer
    const trailerMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.45,
      metalness: 0.15,
    });
    const trailer = new THREE.Mesh(new THREE.BoxGeometry(2.36, 2.45, 5.9), trailerMat);
    trailer.position.set(0, 1.72, 1.15);
    trailer.castShadow = true;
    group.add(trailer);

    // Reflective stripe on trailer
    const stripeMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4 });
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.39, 0.28, 5.75), stripeMat);
    stripe.position.set(0, 1.35, 1.15);
    group.add(stripe);

    // Rear bumper & taillights
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.22, 0.2), darkTrimMat);
    bumper.position.set(0, 0.45, 4.12);
    group.add(bumper);

    for (const side of [-0.82, 0.82]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.18, 0.08), taillightMat);
      tl.position.set(side, 0.72, 4.12);
      group.add(tl);
    }

    for (const side of [-1.1, 1.1]) {
      for (const zPos of [-3.1, 1.6, 3.0]) {
        const w = createWheel(0.46, 0.32);
        w.position.set(side, 0.46, zPos);
        group.add(w);
        wheels.push(w);
      }
    }
  } else {
    // Bus
    halfWidth = 1.18;
    halfLength = 4.4;
    addContactShadow(group, 2.9, 9.4, contactShadowTex);

    const busBody = new THREE.Mesh(new THREE.BoxGeometry(2.34, 2.35, 8.7), paintMat);
    busBody.position.set(0, 1.56, 0);
    busBody.castShadow = true;
    group.add(busBody);

    // Panoramic window band
    const winBand = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.85, 8.4), glassMat);
    winBand.position.set(0, 1.92, -0.05);
    group.add(winBand);

    // Roof AC pods
    const acMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.5 });
    for (const zPos of [-1.8, 1.5]) {
      const ac = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.22, 1.5), acMat);
      ac.position.set(0, 2.84, zPos);
      group.add(ac);
    }

    // Rear taillights
    for (const side of [-0.84, 0.84]) {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.26, 0.08), taillightMat);
      tl.position.set(side, 0.88, 4.36);
      group.add(tl);
    }

    for (const side of [-1.1, 1.1]) {
      for (const zPos of [-2.8, 1.6, 3.1]) {
        const w = createWheel(0.46, 0.3);
        w.position.set(side, 0.46, zPos);
        group.add(w);
        wheels.push(w);
      }
    }
  }

  return {
    group,
    wheels,
    halfWidth,
    halfLength,
    taillightMat,
  };
}

export function buildCoin(contactShadowTex: THREE.Texture): THREE.Group {
  const group = new THREE.Group();

  const coinMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xd97706,
    emissiveIntensity: 0.45,
    metalness: 0.9,
    roughness: 0.16,
  });

  const innerMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.35,
    metalness: 0.85,
    roughness: 0.2,
  });

  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.14, 20), coinMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.88;
  group.add(rim);

  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.17, 16), innerMat);
  core.rotation.x = Math.PI / 2;
  core.position.y = 0.88;
  group.add(core);

  const shadowMat = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.38,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);

  return group;
}

export function buildTree(): THREE.Group {
  const group = new THREE.Group();

  const trunkMat = new THREE.MeshStandardMaterial({
    color: 0x5c4033,
    roughness: 0.92,
    metalness: 0.02,
  });
  const foliageMat1 = new THREE.MeshStandardMaterial({
    color: 0x2e7d32,
    roughness: 0.85,
  });
  const foliageMat2 = new THREE.MeshStandardMaterial({
    color: 0x388e3c,
    roughness: 0.82,
  });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.36, 2.4, 8), trunkMat);
  trunk.position.y = 1.2;
  trunk.castShadow = true;
  group.add(trunk);

  const tier1 = new THREE.Mesh(new THREE.ConeGeometry(1.75, 2.6, 8), foliageMat1);
  tier1.position.y = 3.1;
  tier1.castShadow = true;
  group.add(tier1);

  const tier2 = new THREE.Mesh(new THREE.ConeGeometry(1.35, 2.2, 8), foliageMat2);
  tier2.position.y = 4.4;
  tier2.castShadow = true;
  group.add(tier2);

  const tier3 = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.6, 8), foliageMat2);
  tier3.position.y = 5.5;
  group.add(tier3);

  return group;
}

export interface StreetLightRig {
  group: THREE.Group;
  bulbMat: THREE.MeshStandardMaterial;
  roadPool: THREE.Mesh;
}

export function buildStreetLight(side: -1 | 1): StreetLightRig {
  const group = new THREE.Group();

  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    metalness: 0.78,
    roughness: 0.32,
  });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 7.2, 8), poleMat);
  pole.position.y = 3.6;
  group.add(pole);

  const arm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 0.14), poleMat);
  arm.position.set(-side * 1.2, 7.1, 0);
  group.add(arm);

  const housing = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.18, 0.35), poleMat);
  housing.position.set(-side * 2.3, 7.02, 0);
  group.add(housing);

  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xfbbf24,
    emissiveIntensity: 0.2,
    roughness: 0.2,
  });
  const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.26), bulbMat);
  bulb.position.set(-side * 2.3, 6.92, 0);
  group.add(bulb);

  const poolMat = new THREE.MeshBasicMaterial({
    color: 0xfde68a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const roadPool = new THREE.Mesh(new THREE.CircleGeometry(3.2, 16), poolMat);
  roadPool.rotation.x = -Math.PI / 2;
  roadPool.position.set(-side * 2.4, 0.025, 0);
  group.add(roadPool);

  return { group, bulbMat, roadPool };
}
