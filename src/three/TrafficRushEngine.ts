import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { racingAudio } from '../audio/racingAudio';
import {
  LANE_CENTERS,
  PLAYER_X_LIMIT,
  ROAD_WIDTH,
  TRAFFIC_COLORS,
} from '../data/cars';
import {
  CarSpec,
  ControlState,
  GameMode,
  HudTelemetry,
  OvertakeEvent,
  TimeOfDay,
  TrafficKind,
} from '../types/traffic';
import {
  SportsCarRig,
  StreetLightRig,
  TrafficRig,
  buildCoin,
  buildSportsCar,
  buildStreetLight,
  buildTree,
  buildTrafficVehicle,
} from './models';
import {
  createBuildingFacadeTexture,
  createContactShadowTexture,
  createGrassTexture,
  createRoadTexture,
} from './textures';

interface TrafficActor {
  id: number;
  kind: TrafficKind;
  rig: TrafficRig;
  lane: number;
  x: number;
  z: number;
  speedMps: number;
  overtaken: boolean;
}

interface CoinActor {
  mesh: THREE.Group;
  x: number;
  z: number;
  collected: boolean;
}

interface SceneryProp {
  group: THREE.Object3D;
  z: number;
  kind: 'tree' | 'building' | 'light';
  lightRig?: StreetLightRig;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

export interface EngineCallbacks {
  onTelemetry: (telemetry: HudTelemetry) => void;
  onCoinCollected: (totalRunCoins: number) => void;
  onOvertake: (evt: OvertakeEvent) => void;
  onCrash: (finalTelemetry: HudTelemetry) => void;
  onContextLost?: () => void;
  onContextRestored?: () => void;
}

const _vec3 = new THREE.Vector3();
const _lookAt = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class TrafficRushEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private isSoftwareGl: boolean;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private envRT: THREE.WebGLRenderTarget;

  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;

  private roadTex: THREE.CanvasTexture;
  private grassTex: THREE.CanvasTexture;
  private contactShadowTex: THREE.CanvasTexture;
  private buildingDayTex: THREE.CanvasTexture;
  private buildingNightTex: THREE.CanvasTexture;
  private buildingMat: THREE.MeshStandardMaterial;
  private grassMat: THREE.MeshStandardMaterial;
  private roadMat: THREE.MeshStandardMaterial;

  private playerCar: SportsCarRig | null = null;
  private currentCarSpec: CarSpec;
  private timeOfDay: TimeOfDay;
  private mode: GameMode = 'START_MENU';

  private controls: ControlState = {
    left: false,
    right: false,
    brake: false,
    nitro: false,
  };

  private traffic: TrafficActor[] = [];
  private coins: CoinActor[] = [];
  private scenery: SceneryProp[] = [];
  private particles: SparkParticle[] = [];

  private particleGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
  private sparkMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
  private debrisMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  private nitroStreakMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.75,
  });

  // Simulation variables
  private playerX = 0;
  private lateralVel = 0;
  private playerSpeedMps = 34; // ~122 km/h
  private distanceM = 0;
  private score = 0;
  private runCoins = 0;
  private nitroPct = 100;
  private overtakeStreak = 0;
  private spawnTimer = 0;
  private coinTimer = 1.6;
  private nextActorId = 1;
  private overtakeId = 1;

  private crashTimer = 0;
  private crashSpin = 0;
  private crashShake = 0;
  private wasNitroActive = false;
  private telemetryTimer = 0;
  private menuOrbitAngle = 0;

  private frameId = 0;
  private disposed = false;
  private lastTime = performance.now();
  private prefersReducedMotion = false;

  private handleResizeBound: () => void;
  private handleContextLostBound: (e: Event) => void;
  private handleContextRestoredBound: () => void;

  constructor(
    container: HTMLElement,
    initialCar: CarSpec,
    initialTime: TimeOfDay,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.currentCarSpec = initialCar;
    this.timeOfDay = initialTime;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    if (typeof window !== 'undefined' && window.matchMedia) {
      this.prefersReducedMotion.valueOf();
      this.prefersReducedMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches;
    }

    const width = Math.max(container.clientWidth, 320);
    const height = Math.max(container.clientHeight, 240);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    // Studio environment reflection for realistic car clearcoat & chrome
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.scene.environment = this.envRT.texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.2, 260);
    this.camera.position.set(0, 3.6, 8.2);

    // Lighting rig
    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x334155, 0.75);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff7ed, 1.8);
    this.sunLight.position.set(22, 34, 18);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 110;
    this.sunLight.shadow.camera.left = -22;
    this.sunLight.shadow.camera.right = 22;
    this.sunLight.shadow.camera.top = 45;
    this.sunLight.shadow.camera.bottom = -25;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);

    // Procedural Textures
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.roadTex = createRoadTexture(maxAniso);
    this.grassTex = createGrassTexture(maxAniso);
    this.contactShadowTex = createContactShadowTexture();
    this.buildingDayTex = createBuildingFacadeTexture(maxAniso, false);
    this.buildingNightTex = createBuildingFacadeTexture(maxAniso, true);

    // Highway Surface & Terrain
    this.roadMat = new THREE.MeshStandardMaterial({
      map: this.roadTex,
      roughness: 0.78,
      metalness: 0.08,
    });
    const roadMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_WIDTH, 250),
      this.roadMat
    );
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(0, 0, -90);
    roadMesh.receiveShadow = true;
    this.scene.add(roadMesh);

    this.grassMat = new THREE.MeshStandardMaterial({
      map: this.grassTex,
      roughness: 0.94,
      metalness: 0.02,
    });
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 260),
      this.grassMat
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(0, -0.04, -90);
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // Continuous concrete highway barriers / shoulders
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.8,
      metalness: 0.1,
    });
    const barrierStripMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.5,
    });
    for (const side of [-1, 1]) {
      const barrier = new THREE.Mesh(
        new THREE.BoxGeometry(0.65, 0.72, 250),
        barrierMat
      );
      barrier.position.set(side * (ROAD_WIDTH / 2 + 0.35), 0.34, -90);
      barrier.receiveShadow = true;
      this.scene.add(barrier);

      const reflectorStrip = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 250),
        barrierStripMat
      );
      reflectorStrip.position.set(side * (ROAD_WIDTH / 2 + 0.02), 0.52, -90);
      this.scene.add(reflectorStrip);
    }

    this.buildingMat = new THREE.MeshStandardMaterial({
      map: this.buildingDayTex,
      roughness: 0.6,
      metalness: 0.25,
    });

    // Populate Scenery along the highway
    this.populateScenery();

    // Build initial player sports car
    this.setCarSpec(initialCar);

    // Apply initial Day/Night theme
    this.setTimeOfDay(initialTime);

    // Seed initial ambient traffic for live Start Menu backdrop
    this.spawnInitialMenuTraffic();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.handleResizeBound = this.onResize.bind(this);
    this.handleContextLostBound = (e: Event) => {
      e.preventDefault();
      this.callbacks.onContextLost?.();
    };
    this.handleContextRestoredBound = () => {
      this.callbacks.onContextRestored?.();
    };

    window.addEventListener('resize', this.handleResizeBound);
    this.renderer.domElement.addEventListener(
      'webglcontextlost',
      this.handleContextLostBound
    );
    this.renderer.domElement.addEventListener(
      'webglcontextrestored',
      this.handleContextRestoredBound
    );

    this.lastTime = performance.now();
    this.loop();
  }

  private populateScenery() {
    const zStart = -180;
    const zEnd = 24;
    const step = 18;

    for (let z = zStart; z <= zEnd; z += step) {
      for (const side of [-1, 1] as const) {
        // Street lights every step
        const lightRig = buildStreetLight(side);
        lightRig.group.position.set(side * (ROAD_WIDTH / 2 + 1.3), 0, z);
        this.scene.add(lightRig.group);
        this.scenery.push({
          group: lightRig.group,
          z,
          kind: 'light',
          lightRig,
        });

        // Roadside trees
        const tree = buildTree();
        const treeScale = 0.85 + Math.random() * 0.45;
        tree.scale.setScalar(treeScale);
        tree.position.set(
          side * (ROAD_WIDTH / 2 + 4.5 + Math.random() * 4.5),
          0,
          z + (Math.random() - 0.5) * 8
        );
        this.scene.add(tree);
        this.scenery.push({ group: tree, z: tree.position.z, kind: 'tree' });

        // Highway skyline buildings further back
        if (Math.random() > 0.25) {
          const bw = 7 + Math.random() * 6;
          const bh = 12 + Math.random() * 24;
          const bd = 8 + Math.random() * 6;
          const buildingGroup = new THREE.Group();
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(bw, bh, bd),
            this.buildingMat
          );
          mesh.position.y = bh / 2;
          buildingGroup.add(mesh);

          // Roof cap detail
          const roof = new THREE.Mesh(
            new THREE.BoxGeometry(bw * 0.72, 1.2, bd * 0.72),
            new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 })
          );
          roof.position.y = bh + 0.6;
          buildingGroup.add(roof);

          buildingGroup.position.set(
            side * (ROAD_WIDTH / 2 + 14 + Math.random() * 14),
            0,
            z + (Math.random() - 0.5) * 6
          );
          this.scene.add(buildingGroup);
          this.scenery.push({
            group: buildingGroup,
            z: buildingGroup.position.z,
            kind: 'building',
          });
        }
      }
    }
  }

  private spawnInitialMenuTraffic() {
    this.clearTrafficAndCoins();
    const initialZ = [-38, -72, -108, -142];
    initialZ.forEach((z, idx) => {
      const lane = (idx * 2 + 1) % 4;
      this.spawnTrafficInLane(lane, z);
    });
  }

  public setCarSpec(spec: CarSpec) {
    this.currentCarSpec = spec;
    if (this.playerCar) {
      this.scene.remove(this.playerCar.group);
    }
    this.playerCar = buildSportsCar(spec, this.contactShadowTex);
    this.playerCar.group.position.set(this.playerX, 0, 0);
    this.scene.add(this.playerCar.group);
    this.updateHeadlightVisibility();
  }

  public setTimeOfDay(time: TimeOfDay) {
    this.timeOfDay = time;
    const isNight = time === 'NIGHT';

    if (isNight) {
      const skyNight = new THREE.Color(0x070b19);
      this.scene.background = skyNight;
      this.scene.fog = new THREE.Fog(0x070b19, 55, 175);
      this.hemiLight.color.setHex(0x3b82f6);
      this.hemiLight.groundColor.setHex(0x0f172a);
      this.hemiLight.intensity = 0.48;
      this.sunLight.color.setHex(0xbfdbfe);
      this.sunLight.intensity = 0.72;
      this.grassMat.color.setHex(0x3b5249);
      this.roadMat.color.setHex(0x9ca3af);
      this.buildingMat.map = this.buildingNightTex;
      this.buildingMat.emissive.setHex(0xfde68a);
      this.buildingMat.emissiveMap = this.buildingNightTex;
      this.buildingMat.emissiveIntensity = 0.45;
      this.buildingMat.needsUpdate = true;
    } else {
      const skyDay = new THREE.Color(0x9bd4ff);
      this.scene.background = skyDay;
      this.scene.fog = new THREE.Fog(0xb9e0ff, 70, 195);
      this.hemiLight.color.setHex(0xbae6fd);
      this.hemiLight.groundColor.setHex(0x4d7c0f);
      this.hemiLight.intensity = 0.85;
      this.sunLight.color.setHex(0xfffbeb);
      this.sunLight.intensity = 1.95;
      this.grassMat.color.setHex(0xffffff);
      this.roadMat.color.setHex(0xffffff);
      this.buildingMat.map = this.buildingDayTex;
      this.buildingMat.emissive.setHex(0x000000);
      this.buildingMat.emissiveMap = null;
      this.buildingMat.emissiveIntensity = 0;
      this.buildingMat.needsUpdate = true;
    }

    for (const prop of this.scenery) {
      if (prop.kind === 'light' && prop.lightRig) {
        prop.lightRig.bulbMat.emissiveIntensity = isNight ? 2.6 : 0.15;
        const poolMat = prop.lightRig.roadPool.material as THREE.MeshBasicMaterial;
        poolMat.opacity = isNight ? 0.14 : 0;
      }
    }

    this.updateHeadlightVisibility();
  }

  private updateHeadlightVisibility() {
    if (!this.playerCar) return;
    const isNight = this.timeOfDay === 'NIGHT';
    this.playerCar.headlightMat.emissiveIntensity = isNight ? 2.8 : 1.1;
    for (const beam of this.playerCar.headlightBeams) {
      beam.visible = isNight;
    }
  }

  public setMode(mode: GameMode) {
    this.mode = mode;
    if (mode === 'PLAYING') {
      racingAudio.startEngine();
    } else {
      racingAudio.stopEngine();
      this.controls = { left: false, right: false, brake: false, nitro: false };
    }
  }

  public setControls(partial: Partial<ControlState>) {
    this.controls = { ...this.controls, ...partial };
  }

  public startNewRun() {
    this.clearTrafficAndCoins();
    this.clearParticles();

    this.playerX = LANE_CENTERS[1]; // Start cleanly in middle-left lane
    this.lateralVel = 0;
    this.playerSpeedMps = 34; // ~122 km/h starting pace
    this.distanceM = 0;
    this.score = 0;
    this.runCoins = 0;
    this.nitroPct = 100;
    this.overtakeStreak = 0;
    this.spawnTimer = 0.6;
    this.coinTimer = 1.4;
    this.crashTimer = 0;
    this.crashSpin = 0;
    this.crashShake = 0;
    this.wasNitroActive = false;

    if (this.playerCar) {
      this.playerCar.group.position.set(this.playerX, 0, 0);
      this.playerCar.group.rotation.set(0, 0, 0);
    }

    // Spawn initial highway traffic ahead
    this.spawnTrafficInLane(0, -68);
    this.spawnTrafficInLane(2, -96);
    this.spawnTrafficInLane(3, -132);
    this.spawnCoinLine(1, -55);

    this.setMode('PLAYING');
    this.emitTelemetry();
  }

  private clearTrafficAndCoins() {
    for (const t of this.traffic) {
      this.scene.remove(t.rig.group);
    }
    this.traffic = [];
    for (const c of this.coins) {
      this.scene.remove(c.mesh);
    }
    this.coins = [];
  }

  private clearParticles() {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
    }
    this.particles = [];
  }

  private spawnTrafficInLane(lane: number, zPos: number) {
    const roll = Math.random();
    let kind: TrafficKind = 'sedan';
    if (roll > 0.86) kind = 'bus';
    else if (roll > 0.7) kind = 'truck';
    else if (roll > 0.5) kind = 'pickup';
    else if (roll > 0.3) kind = 'suv';

    const color =
      TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)];
    const rig = buildTrafficVehicle(kind, color, this.contactShadowTex);
    const x = LANE_CENTERS[lane];
    rig.group.position.set(x, 0, zPos);
    this.scene.add(rig.group);

    // Slower traffic ahead: trucks/buses slower than sedans
    const difficultyFactor = Math.min(1, this.distanceM / 2200);
    let speedMps = 16 + Math.random() * 8 + difficultyFactor * 4;
    if (kind === 'truck' || kind === 'bus') {
      speedMps = 13 + Math.random() * 5 + difficultyFactor * 3;
    }

    this.traffic.push({
      id: this.nextActorId++,
      kind,
      rig,
      lane,
      x,
      z: zPos,
      speedMps,
      overtaken: false,
    });
  }

  private spawnTrafficWave() {
    // Check which lanes are clear near the spawn horizon (-165 to -125)
    const busyLanes = new Set<number>();
    for (const t of this.traffic) {
      if (t.z < -118) {
        busyLanes.add(t.lane);
      }
    }

    const availableLanes = [0, 1, 2, 3].filter((l) => !busyLanes.has(l));
    if (availableLanes.length === 0) return;

    // Never block all 4 lanes: leave at least 1 open lane across the road
    const difficulty = Math.min(1, this.distanceM / 2600);
    const maxToSpawn = Math.min(
      availableLanes.length - (busyLanes.size === 0 ? 1 : 0),
      difficulty > 0.55 ? 2 : Math.random() > 0.55 ? 2 : 1
    );
    const count = Math.max(1, maxToSpawn);

    // Shuffle available lanes
    for (let i = availableLanes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableLanes[i], availableLanes[j]] = [
        availableLanes[j],
        availableLanes[i],
      ];
    }

    // Ensure at least 1 lane on the entire road stays open in this z-band
    const totalOccupiedAfter = busyLanes.size + count;
    const finalCount = totalOccupiedAfter >= 4 ? Math.max(0, 3 - busyLanes.size) : count;

    for (let i = 0; i < finalCount; i++) {
      const lane = availableLanes[i];
      const zOffset = -158 - Math.random() * 24;
      this.spawnTrafficInLane(lane, zOffset);
    }
  }

  private spawnCoinLine(forcedLane?: number, startZ = -150) {
    const lane =
      forcedLane !== undefined ? forcedLane : Math.floor(Math.random() * 4);
    const x = LANE_CENTERS[lane];
    const count = 3 + Math.floor(Math.random() * 3);

    for (let i = 0; i < count; i++) {
      const z = startZ - i * 5.2;
      // Skip if overlapping a traffic car at spawn
      const overlaps = this.traffic.some(
        (t) =>
          t.lane === lane && Math.abs(t.z - z) < t.rig.halfLength + 2.5
      );
      if (overlaps) continue;

      const mesh = buildCoin(this.contactShadowTex);
      mesh.position.set(x, 0, z);
      this.scene.add(mesh);
      this.coins.push({ mesh, x, z, collected: false });
    }
  }

  private spawnBurst(
    x: number,
    y: number,
    z: number,
    count: number,
    mat: THREE.Material,
    speed = 10
  ) {
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() - 0.5) * speed * 1.6,
        vy: 2 + Math.random() * speed * 0.9,
        vz: (Math.random() - 0.5) * speed * 1.4,
        life: 0.45 + Math.random() * 0.45,
        maxLife: 0.9,
      });
    }
  }

  private emitTelemetry() {
    const isNitroActive =
      this.mode === 'PLAYING' && this.controls.nitro && this.nitroPct > 1;
    this.callbacks.onTelemetry({
      speedKmh: Math.round(this.playerSpeedMps * 3.6),
      maxSpeedKmh: this.currentCarSpec.topSpeedKmh,
      distanceM: Math.floor(this.distanceM),
      score: Math.floor(this.score),
      runCoins: this.runCoins,
      nitroPct: Math.round(this.nitroPct),
      isNitroActive,
      isBraking: this.mode === 'PLAYING' && this.controls.brake,
      overtakeStreak: this.overtakeStreak,
    });
  }

  private update(dt: number) {
    if (this.mode === 'PAUSED') return;

    const maxCarMps = this.currentCarSpec.topSpeedKmh / 3.6;

    // 1. Speed & Steering
    if (this.mode === 'START_MENU' || this.mode === 'CAR_SELECT') {
      // Smooth showcase cruise speed
      this.playerSpeedMps = THREE.MathUtils.damp(this.playerSpeedMps, 26, 3, dt);
      this.playerX = THREE.MathUtils.damp(this.playerX, 0, 3, dt);
      this.menuOrbitAngle += dt * 0.42;

      if (this.playerCar) {
        this.playerCar.group.position.set(this.playerX, 0, 0);
        this.playerCar.group.rotation.set(0, 0, 0);
        for (const f of this.playerCar.nitroFlames) f.visible = false;
      }

      // Gentle chase camera showcase
      const camX = Math.sin(this.menuOrbitAngle) * 2.8;
      this.camera.position.set(camX, 3.1, 7.6);
      _lookAt.set(0, 1.0, -4.5);
      this.camera.lookAt(_lookAt);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 56, 5, dt);
      this.camera.updateProjectionMatrix();
    } else if (this.mode === 'PLAYING') {
      const difficulty = Math.min(1, this.distanceM / 3000);
      const cruiseTargetMps = THREE.MathUtils.lerp(
        33,
        maxCarMps * 0.84,
        difficulty
      );

      const canNitro = this.controls.nitro && this.nitroPct > 0.8;
      const isBraking = this.controls.brake && !canNitro;

      if (canNitro && !this.wasNitroActive) {
        racingAudio.playNitroBurst();
      }
      this.wasNitroActive = canNitro;

      let targetSpeed = cruiseTargetMps;
      if (canNitro) {
        const nitroBoost = 16 + this.currentCarSpec.nitroPower * 1.4;
        targetSpeed = Math.min(maxCarMps + 20, cruiseTargetMps + nitroBoost);
        this.nitroPct = Math.max(0, this.nitroPct - dt * 26);
      } else {
        this.nitroPct = Math.min(100, this.nitroPct + dt * 6.5);
        if (isBraking) {
          targetSpeed = Math.max(19, cruiseTargetMps * 0.48);
        }
      }

      const accelRate = canNitro ? 6.5 : isBraking ? 7.5 : 2.8;
      this.playerSpeedMps = THREE.MathUtils.damp(
        this.playerSpeedMps,
        targetSpeed,
        accelRate,
        dt
      );

      // Lateral steering
      const steerDir = (this.controls.right ? 1 : 0) - (this.controls.left ? 1 : 0);
      const maxLateralSpeed = 8.5 + this.currentCarSpec.handling * 0.55;
      const targetLatVel = steerDir * maxLateralSpeed;
      this.lateralVel = THREE.MathUtils.damp(this.lateralVel, targetLatVel, 14, dt);

      this.playerX += this.lateralVel * dt;
      if (this.playerX < -PLAYER_X_LIMIT) {
        this.playerX = -PLAYER_X_LIMIT;
        this.lateralVel = 0;
      } else if (this.playerX > PLAYER_X_LIMIT) {
        this.playerX = PLAYER_X_LIMIT;
        this.lateralVel = 0;
      }

      // Distance & continuous score
      const dz = this.playerSpeedMps * dt;
      this.distanceM += dz;
      this.score += dz * (canNitro ? 1.8 : 1.0);

      // Update Car Visual Rig (roll, yaw, steering wheels, brake lights, nitro flames)
      if (this.playerCar) {
        this.playerCar.group.position.set(this.playerX, 0, 0);
        const targetRoll = -this.lateralVel * 0.011;
        const targetYaw = -this.lateralVel * 0.014;
        const targetPitch = isBraking ? 0.028 : canNitro ? -0.025 : 0;

        this.playerCar.group.rotation.z = THREE.MathUtils.damp(
          this.playerCar.group.rotation.z,
          targetRoll,
          12,
          dt
        );
        this.playerCar.group.rotation.y = THREE.MathUtils.damp(
          this.playerCar.group.rotation.y,
          targetYaw,
          12,
          dt
        );
        this.playerCar.group.rotation.x = THREE.MathUtils.damp(
          this.playerCar.group.rotation.x,
          targetPitch,
          10,
          dt
        );

        for (const pivot of this.playerCar.frontPivots) {
          pivot.rotation.y = THREE.MathUtils.damp(
            pivot.rotation.y,
            -steerDir * 0.28,
            14,
            dt
          );
        }

        this.playerCar.taillightMat.emissiveIntensity = isBraking
          ? 3.8
          : this.timeOfDay === 'NIGHT'
            ? 2.0
            : 1.1;

        for (const flame of this.playerCar.nitroFlames) {
          flame.visible = canNitro;
          if (canNitro) {
            flame.scale.set(
              0.9 + Math.random() * 0.3,
              0.9 + Math.random() * 0.3,
              0.8 + Math.random() * 0.65
            );
          }
        }

        if (canNitro && Math.random() > 0.45) {
          this.spawnBurst(
            this.playerX + (Math.random() - 0.5) * 0.9,
            0.3,
            2.3,
            1,
            this.nitroStreakMat,
            4
          );
        }
      }

      // Dynamic Chase Camera + Speed FOV
      const targetCamX = this.playerX * 0.62;
      this.camera.position.x = THREE.MathUtils.damp(
        this.camera.position.x,
        targetCamX,
        8,
        dt
      );
      this.camera.position.y = THREE.MathUtils.damp(
        this.camera.position.y,
        canNitro ? 3.35 : 3.65,
        6,
        dt
      );
      this.camera.position.z = THREE.MathUtils.damp(
        this.camera.position.z,
        canNitro ? 7.6 : 8.2,
        6,
        dt
      );

      _lookAt.set(this.playerX * 0.78, 1.05, -14);
      this.camera.lookAt(_lookAt);

      const targetFov = canNitro ? 72 : 58 + (this.playerSpeedMps / maxCarMps) * 6;
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 6, dt);
      this.camera.updateProjectionMatrix();

      // Update Engine Audio
      racingAudio.updateEngine(this.playerSpeedMps * 3.6, canNitro, isBraking);

      // Spawners
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTrafficWave();
        const minInterval = THREE.MathUtils.lerp(1.25, 0.56, difficulty);
        this.spawnTimer = minInterval + Math.random() * 0.45;
      }

      this.coinTimer -= dt;
      if (this.coinTimer <= 0) {
        this.spawnCoinLine();
        this.coinTimer = 2.6 + Math.random() * 1.8;
      }
    } else if (this.mode === 'GAME_OVER') {
      // Decelerate & spin crashed car smoothly
      this.crashTimer += dt;
      this.playerSpeedMps = THREE.MathUtils.damp(this.playerSpeedMps, 0, 3.2, dt);

      if (this.playerCar && this.crashTimer < 1.2) {
        this.playerCar.group.rotation.y += this.crashSpin * dt;
        this.crashSpin = THREE.MathUtils.damp(this.crashSpin, 0, 3.5, dt);
      }

      if (this.crashShake > 0) {
        this.crashShake = Math.max(0, this.crashShake - dt);
        const mag = (this.crashShake / 0.45) * 0.45;
        this.camera.position.x =
          this.playerX * 0.6 + (Math.random() - 0.5) * mag * 2;
        this.camera.position.y = 3.7 + (Math.random() - 0.5) * mag * 2;
      }
      _lookAt.set(this.playerX * 0.8, 0.9, -6);
      this.camera.lookAt(_lookAt);
    }

    // 2. Spin player wheels proportional to speed
    if (this.playerCar) {
      const wheelRot = (this.playerSpeedMps / 0.36) * dt;
      for (const w of this.playerCar.wheels) {
        w.rotation.x -= wheelRot;
      }
    }

    // 3. Scroll Road & Grass Textures
    const textureRepeatPerMeter = 14 / 250;
    this.roadTex.offset.y += this.playerSpeedMps * dt * textureRepeatPerMeter;
    this.grassTex.offset.y += this.playerSpeedMps * dt * (36 / 260);

    // 4. Scroll Roadside Scenery
    for (const prop of this.scenery) {
      prop.z += this.playerSpeedMps * dt;
      if (prop.z > 26) {
        prop.z -= 216;
      }
      prop.group.position.z = prop.z;
    }

    // 5. Update Traffic Vehicles & Check Collisions / Overtakes
    const playerHalfW = 0.84;
    const playerHalfL = 1.92;

    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const t = this.traffic[i];
      // Relative speed along +Z toward camera
      const relSpeed = this.playerSpeedMps - t.speedMps;
      t.z += relSpeed * dt;
      t.rig.group.position.z = t.z;

      const tWheelRot = (t.speedMps / 0.38) * dt;
      for (const w of t.rig.wheels) {
        w.rotation.x -= tWheelRot;
      }

      if (this.mode === 'PLAYING') {
        // Collision check
        const dx = Math.abs(this.playerX - t.x);
        const dz = Math.abs(t.z);
        const hitW = playerHalfW + t.rig.halfWidth * 0.88;
        const hitL = playerHalfL + t.rig.halfLength * 0.9;

        if (dx < hitW && dz < hitL) {
          this.triggerCrash();
          break;
        }

        // Overtake bonus when car cleanly passes behind player
        if (!t.overtaken && t.z > playerHalfL + t.rig.halfLength + 0.6) {
          t.overtaken = true;
          const isNearMiss = dx < t.rig.halfWidth + 1.55;
          const bonus = isNearMiss ? 100 : 50;
          this.score += bonus;
          this.overtakeStreak += 1;
          this.nitroPct = Math.min(100, this.nitroPct + (isNearMiss ? 10 : 5));
          racingAudio.playOvertake(isNearMiss);
          this.callbacks.onOvertake({
            id: this.overtakeId++,
            label: isNearMiss ? 'NEAR MISS' : 'OVERTAKE',
            points: bonus,
          });
        }
      }

      // Recycle or remove off-screen traffic
      if (t.z > 28 || t.z < -220) {
        this.scene.remove(t.rig.group);
        this.traffic.splice(i, 1);

        if (this.mode === 'START_MENU' || this.mode === 'CAR_SELECT') {
          this.spawnTrafficInLane(Math.floor(Math.random() * 4), -155 - Math.random() * 30);
        }
      }
    }

    // 6. Update Coins
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.z += this.playerSpeedMps * dt;
      c.mesh.position.z = c.z;
      c.mesh.rotation.y += dt * 3.8;

      if (this.mode === 'PLAYING' && !c.collected) {
        const dx = Math.abs(this.playerX - c.x);
        const dz = Math.abs(c.z);
        if (dx < 1.55 && dz < 2.3) {
          c.collected = true;
          this.runCoins += 1;
          this.score += 25;
          this.nitroPct = Math.min(100, this.nitroPct + 6);
          racingAudio.playCoin();
          this.spawnBurst(c.x, 0.9, c.z, 8, this.sparkMat, 7);
          this.callbacks.onCoinCollected(this.runCoins);
          this.scene.remove(c.mesh);
          this.coins.splice(i, 1);
          continue;
        }
      }

      if (c.z > 18) {
        this.scene.remove(c.mesh);
        this.coins.splice(i, 1);
      }
    }

    // 7. Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= 18 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y = Math.max(0.08, p.mesh.position.y + p.vy * dt);
      p.mesh.position.z += p.vz * dt;
      p.mesh.rotation.x += dt * 8;
      p.mesh.rotation.y += dt * 6;
      const scale = Math.max(0.1, p.life / p.maxLife);
      p.mesh.scale.setScalar(scale);
    }

    // 8. Throttled HUD Telemetry Updates (~15Hz)
    if (this.mode === 'PLAYING') {
      this.telemetryTimer += dt;
      if (this.telemetryTimer >= 0.065) {
        this.telemetryTimer = 0;
        this.emitTelemetry();
      }
    }
  }

  private triggerCrash() {
    this.mode = 'GAME_OVER';
    this.crashTimer = 0;
    this.crashSpin = (Math.random() > 0.5 ? 1 : -1) * 7.5;
    this.crashShake = this.prefersReducedMotion ? 0 : 0.45;
    this.wasNitroActive = false;

    if (this.playerCar) {
      for (const f of this.playerCar.nitroFlames) f.visible = false;
    }

    this.spawnBurst(this.playerX, 0.9, -1.2, 22, this.sparkMat, 14);
    this.spawnBurst(this.playerX, 0.8, -1.0, 14, this.debrisMat, 11);
    racingAudio.playCrash();

    const finalTelemetry: HudTelemetry = {
      speedKmh: 0,
      maxSpeedKmh: this.currentCarSpec.topSpeedKmh,
      distanceM: Math.floor(this.distanceM),
      score: Math.floor(this.score),
      runCoins: this.runCoins,
      nitroPct: Math.round(this.nitroPct),
      isNitroActive: false,
      isBraking: false,
      overtakeStreak: this.overtakeStreak,
    };

    this.callbacks.onCrash(finalTelemetry);
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private loop = () => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(rawDt, 0.05);

    this.update(dt);
    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.loop);
    } else {
      this.frameId = window.requestAnimationFrame(this.loop);
    }
  };

  private onResize() {
    if (this.disposed) return;
    const width = Math.max(this.container.clientWidth, 320);
    const height = Math.max(this.container.clientHeight, 240);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
  }

  public dispose() {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    racingAudio.stopEngine();

    window.removeEventListener('resize', this.handleResizeBound);
    this.renderer.domElement.removeEventListener(
      'webglcontextlost',
      this.handleContextLostBound
    );
    this.renderer.domElement.removeEventListener(
      'webglcontextrestored',
      this.handleContextRestoredBound
    );

    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });

    this.roadTex.dispose();
    this.grassTex.dispose();
    this.contactShadowTex.dispose();
    this.buildingDayTex.dispose();
    this.buildingNightTex.dispose();
    this.envRT.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
