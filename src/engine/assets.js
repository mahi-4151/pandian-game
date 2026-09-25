import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BASE_URL } from '../config.js';

const LOAD_TIMEOUT_MS = 12000;
const DECODER_TIMEOUT_MS = 4000;

/**
 * BoxGeometry stand-in used ONLY when a local GLB is missing or fails.
 * Real GLB loading is preserved — this never replaces a valid model.
 */
export function createBoxFallbackGltf(path = '') {
  const name = String(path).toLowerCase();
  const scene = new THREE.Group();
  scene.name = `fallback:${path || 'box'}`;

  const isChar = /hero|villain|character/.test(name);
  const isWeapon = /weapon|sword|bow|vel|valari|shield/.test(name);

  let geometry;
  let color;
  let y = 1;

  if (isChar) {
    geometry = new THREE.BoxGeometry(0.7, 1.85, 0.45);
    color = /villain/.test(name) ? 0x7a1d18 : 0xd4a017;
    y = 0.925;
  } else if (isWeapon) {
    geometry = new THREE.BoxGeometry(0.08, 1.1, 0.08);
    color = 0xb0b7c3;
    y = 0.55;
  } else if (/palace/.test(name)) {
    geometry = new THREE.BoxGeometry(8, 10, 6);
    color = 0xc4a574;
    y = 5;
  } else if (/temple/.test(name)) {
    geometry = new THREE.BoxGeometry(6, 7, 6);
    color = 0xe8d5a3;
    y = 3.5;
  } else if (/tower/.test(name)) {
    geometry = new THREE.BoxGeometry(2.2, 9, 2.2);
    color = 0x8a8070;
    y = 4.5;
  } else {
    geometry = new THREE.BoxGeometry(2, 2, 2);
    color = 0x888888;
    y = 1;
  }

  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.12 }),
  );
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  scene.add(mesh);

  if (isChar) {
    const hips = new THREE.Bone();
    hips.name = 'Hips';
    hips.position.set(0, 0.95, 0);
    const head = new THREE.Bone();
    head.name = 'Head';
    head.position.set(0, 0.8, 0);
    const rightHand = new THREE.Bone();
    rightHand.name = 'RightHand';
    rightHand.position.set(0.38, 0.1, 0.15);
    const leftHand = new THREE.Bone();
    leftHand.name = 'LeftHand';
    leftHand.position.set(-0.38, 0.1, 0.15);
    hips.add(head, rightHand, leftHand);
    scene.add(hips);
  }

  return { scene, animations: [], userData: { fallback: true, path } };
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out loading ${label}`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Thin wrapper around GLTFLoader: shared manager (so we can report a single
 * progress value to the loading screen), meshopt decoding for our compressed
 * assets, and a tiny cache so a model is only ever fetched once.
 *
 * Local project-relative GLB paths are used. A missing / failed GLB never
 * rejects — it resolves to a BoxGeometry stand-in so the game can boot.
 */
export class AssetLoader {
  constructor({ onProgress } = {}) {
    this.manager = new THREE.LoadingManager();
    this.cache = new Map();
    this.onProgress = onProgress;

    this.manager.onProgress = (_url, loaded, total) => {
      this.onProgress?.(total ? loaded / total : 0);
    };
    this.manager.onError = (url) => {
      console.warn('[pandya] asset error (will use fallback if needed):', url);
    };

    this.gltf = new GLTFLoader(this.manager).setPath(BASE_URL);
    this._decoderPromise = this.#initDecoder();
  }

  async #initDecoder() {
    try {
      const mod = await withTimeout(
        import('three/examples/jsm/libs/meshopt_decoder.module.js'),
        DECODER_TIMEOUT_MS,
        'meshopt decoder',
      );
      if (mod?.MeshoptDecoder) this.gltf.setMeshoptDecoder(mod.MeshoptDecoder);
    } catch (error) {
      console.warn('[pandya] Meshopt decoder unavailable; meshopt GLBs will use BoxGeometry fallback.', error);
    }
  }

  /** Loads a GLB once; later calls return a fresh SkeletonUtils-safe clone source. */
  load(path) {
    if (!this.cache.has(path)) {
      this.cache.set(path, this.#loadSafe(path));
    }
    return this.cache.get(path);
  }

  async #loadSafe(path) {
    await this._decoderPromise;

    // Never fetch unstable external/CDN model URLs.
    if (/^https?:\/\//i.test(String(path))) {
      console.warn('[pandya] ignoring external GLB URL, using BoxGeometry fallback:', path);
      return createBoxFallbackGltf(path);
    }

    try {
      const gltf = await withTimeout(this.gltf.loadAsync(path), LOAD_TIMEOUT_MS, path);
      gltf.scene.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        object.frustumCulled = false;
        const material = object.material;
        if (material && 'envMapIntensity' in material) material.envMapIntensity = 1.15;
      });
      return gltf;
    } catch (error) {
      console.warn('[pandya] GLB missing or failed — using BoxGeometry fallback:', path, error);
      return createBoxFallbackGltf(path);
    }
  }

  loadAll(paths) {
    return Promise.all(paths.map((item) => this.load(item)));
  }

  /** Loads a bitmap texture (for the war backdrop) once; caches the result. */
  loadTexture(path) {
    if (!this.textureCache) this.textureCache = new Map();
    if (!this.textureCache.has(path)) {
      const loader = new THREE.TextureLoader(this.manager).setPath(BASE_URL);
      loader.setCrossOrigin('anonymous');
      this.textureCache.set(
        path,
        withTimeout(loader.loadAsync(path), LOAD_TIMEOUT_MS, path).then((texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = 8;
          return texture;
        }),
      );
    }
    return this.textureCache.get(path);
  }
}
