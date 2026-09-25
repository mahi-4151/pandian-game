import * as THREE from "three"; 
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"; 
import { OrbitControls } from "three/addons/controls/OrbitControls.js"; 

// Shared wallet (wallet.js) — the SAME coins & pearls the whole game uses
// (map, battles, tasks). What the player earned in battle counts here too.
const wallet = window.PandyaWallet ? PandyaWallet.get() : { coins: 100, pearls: 50 };
let coins = wallet.coins; 
let pearls = wallet.pearls; 

// Shared lives pool (lives.js) — the same hearts the map shows.
let lives = window.PandyaLives ? PandyaLives.current().lives : 5; 

// Super Rare Temple build cost.
const TEMPLE_COINS = 6000; 
const TEMPLE_PEARLS = 100; 

// Save the wallet through the shared store so every page updates instantly.
function saveWallet(){ 
    if(window.PandyaWallet){ 
        PandyaWallet.set({ coins, pearls }); 
    } 
} 

document.getElementById("coinCount").innerText = coins; 
document.getElementById("pearlCount").innerText = pearls; 
document.getElementById("lives").innerText = lives; 

const loadingScreen = document.getElementById("loadingScreen"); 
const progressBar = document.getElementById("progressBar"); 

let progress = 0; 

const loading = setInterval(() => { 

    progress += 4; 
    progressBar.style.width = progress + "%"; 

    if(progress >= 100){ 

        clearInterval(loading); 

        setTimeout(() => { 
            loadingScreen.style.display = "none"; 
        },300); 

    } 

},120); 

const scene = new THREE.Scene(); 

const camera = new THREE.PerspectiveCamera( 
    60, 
    window.innerWidth / window.innerHeight, 
    0.1, 
    1000 
); 
 
camera.position.set(0,7,18); 
 
const renderer = new THREE.WebGLRenderer({ 
    canvas: document.getElementById("gameCanvas"), 
    antialias:true, 
    alpha:true 
}); 
 
renderer.setSize(window.innerWidth,window.innerHeight); 
renderer.setPixelRatio(window.devicePixelRatio); 
renderer.shadowMap.enabled = true; 

// Needed for the step-by-step (layer by layer) temple construction 
renderer.localClippingEnabled = true; 
 
// ================= LIGHTS ================= 
 
const ambient = new THREE.AmbientLight(0xffffff,1.5); 
scene.add(ambient); 
 
const sun = new THREE.DirectionalLight(0xfff2b5,3); 
sun.position.set(20,25,10); 
sun.castShadow = true; 

// Bigger shadow area so the temple's shadow is not cut off 
sun.shadow.mapSize.set(2048,2048); 
sun.shadow.camera.left = -15; 
sun.shadow.camera.right = 15; 
sun.shadow.camera.top = 20; 
sun.shadow.camera.bottom = -10; 
sun.shadow.camera.far = 80; 

scene.add(sun); 
 
// ================= BUILD PLATFORM ================= 
 
const platform = new THREE.Mesh( 
    new THREE.CylinderGeometry(5,5,0.4,40), 
    new THREE.MeshStandardMaterial({ 
        color:0x5b3b18, 
        roughness:0.8 
    }) 
); 
 
platform.position.y = -0.2; 
platform.receiveShadow = true; 
scene.add(platform); 
 
// ================= SUPER RARE TEMPLE MODEL ================= 
 
const loader = new GLTFLoader(); 
 
let temple = null; 
 
function placeTempleModel(model, label){

    temple = model;

    temple.rotation.y = Math.PI;

    // Fit the super rare temple to the build platform (realistic size)
    const templeBox = new THREE.Box3().setFromObject(temple);
    const templeSize = new THREE.Vector3();
    templeBox.getSize(templeSize);

    const templeScale = Math.min(9 / (templeSize.y || 1), 9.4 / Math.max(templeSize.x, templeSize.z, 1));

    temple.scale.set(templeScale,templeScale,templeScale);

    // Re-measure after scaling and place the base exactly on the platform (y = 0)
    const fittedBox = new THREE.Box3().setFromObject(temple);
    const fittedCenter = new THREE.Vector3();
    fittedBox.getCenter(fittedCenter);

    temple.position.x = -fittedCenter.x;
    temple.position.z = -fittedCenter.z;
    temple.position.y = -fittedBox.min.y;

    // Hidden until BUILD is clicked
    temple.visible = false;

    temple.traverse((child)=>{
        if(child.isMesh){
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    scene.add(temple);

    console.log(label);

}

function templeBoxFallback(){
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(6, 7, 6),
        new THREE.MeshStandardMaterial({ color: 0xe8d5a3, roughness: 0.82, metalness: 0.12 })
    );
    mesh.position.y = 3.5;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.add(mesh);
    return group;
}

loader.load(

    "./pandyar3/assets/models/temple.2.glb",

    (gltf)=>{
        placeTempleModel(gltf.scene, "Super Rare Temple (temple.2.glb) Loaded Successfully");
    },

    undefined,

    (error)=>{
        console.warn(error);
        placeTempleModel(templeBoxFallback(), "temple.2.glb missing — using BoxGeometry fallback");
    }

);
 
// ================= CAMERA CONTROL ================= 
 
const controls = new OrbitControls(camera,renderer.domElement); 
 
controls.enablePan = false; 
controls.enableZoom = true; 
controls.enableRotate = true; 
 
controls.minDistance = 10; 
controls.maxDistance = 25; 
 
controls.maxPolarAngle = Math.PI / 2.2; 
 
controls.target.set(0,3,0); 
 
controls.update(); 
 
// ================= BUILD TEMPLE ================= 
 
const buildBtn = document.getElementById("buildBtn"); 
const buildEffect = document.getElementById("buildEffect"); 
const completeBtn = document.getElementById("completeBtn"); 
const buildEffectText = document.getElementById("buildEffectText"); 

// Ring that marks the current build level (used in animate loop for pulse) 
let activeBuildRing = null; 

// ================= NOT ENOUGH COINS & PEARLS MESSAGE ================= 

const fundPopup = document.getElementById("fundPopup"); 

function showFundPopup(){ 

    // Tell the player exactly how many Coins & Pearls they CURRENTLY own —
    // so they can see why the Super Rare Temple cannot be built yet.
    document.getElementById("fundCoinsNow").innerText = coins; 
    document.getElementById("fundPearlsNow").innerText = pearls; 

    document.getElementById("fundCoins").innerText = coins; 
    document.getElementById("fundPearls").innerText = pearls; 

    fundPopup.style.display = "flex"; 

} 

document.getElementById("fundOkBtn").onclick = ()=>{ 

    fundPopup.style.display = "none"; 

}; 

buildBtn.onclick = ()=>{ 

    if(!temple){ 
        alert("Temple model is still loading..."); 
        return; 
    } 

    if(coins < TEMPLE_COINS || pearls < TEMPLE_PEARLS){ 

        // ❌ Player does not have enough Coins and Pearls → show message 
        showFundPopup(); 
        return; 

    } 

    // The temple budget is NOT taken here — starting the build is free.
    // The 6000 Coins + 100 Pearls are charged once, when the mission is
    // completed (see COMPLETE MISSION below).

    buildBtn.disabled = true; 
    buildBtn.innerText = "BUILDING TEMPLE..."; 

    buildEffect.style.display = "flex"; 

    temple.visible = true; 

    // ========== STEP BY STEP CONSTRUCTION OF temple.2.glb ========== 

    // Collect every material of the temple model 
    const templeMaterials = new Set(); 

    temple.traverse((child)=>{ 
        if(child.isMesh){ 
            const mats = Array.isArray(child.material) ? child.material : [child.material]; 
            mats.forEach((m)=>templeMaterials.add(m)); 
        } 
    }); 

    // Clip plane that reveals the temple from bottom to top, step by step 
    const buildClipPlane = new THREE.Plane(new THREE.Vector3(0,-1,0), 0); 

    templeMaterials.forEach((m)=>{ 
        m.clippingPlanes = [buildClipPlane]; 
        m.clipShadows = true; 
        m.needsUpdate = true; 
    }); 

    const buildBox = new THREE.Box3().setFromObject(temple); 
    const buildBase = buildBox.min.y; 
    const buildTop = buildBox.max.y; 
    const buildHeight = buildTop - buildBase; 

    const totalSteps = 14; 
    const stepHeight = buildHeight / totalSteps; 

    buildClipPlane.constant = buildBase; 

    // Golden construction ring that marks the current building level 
    const templeFootprint = Math.max( 
        buildBox.max.x - buildBox.min.x, 
        buildBox.max.z - buildBox.min.z 
    ); 

    const buildRing = new THREE.Mesh( 
        new THREE.TorusGeometry(templeFootprint * 0.62, 0.07, 8, 48), 
        new THREE.MeshBasicMaterial({ color:0xffd04e, transparent:true, opacity:0.9 }) 
    ); 

    buildRing.rotation.x = Math.PI / 2; 
    buildRing.position.set(0, buildBase, 0); 

    scene.add(buildRing); 
    activeBuildRing = buildRing; 

    let currentStep = 0; 

    const buildAnimation = setInterval(()=>{ 

        currentStep++; 

        const buildY = Math.min(buildBase + (currentStep * stepHeight), buildTop); 

        // One more layer of the temple appears 
        buildClipPlane.constant = buildY; 
        buildRing.position.y = buildY; 

        const percent = Math.round(((buildY - buildBase) / buildHeight) * 100); 

        buildEffectText.innerText = "🛕 Building the Super Rare Temple... " + percent + "%"; 

        if(currentStep >= totalSteps){ 

            clearInterval(buildAnimation); 

            // Build finished → show the FULL super rare temple model 
            templeMaterials.forEach((m)=>{ 
                m.clippingPlanes = null; 
                m.needsUpdate = true; 
            }); 

            scene.remove(buildRing); 
            buildRing.geometry.dispose(); 
            buildRing.material.dispose(); 
            activeBuildRing = null; 

            buildEffect.style.display = "none"; 

            buildBtn.style.display = "none"; 

            completeBtn.style.display = "inline-block"; 

        } 

    },230); 

}; 
 
// ================= COMPLETE MISSION ================= 
 
let missionCompleted = false; 
 
completeBtn.onclick = ()=>{ 
 
    // Guard so the budget can only be charged once per visit.
    if(missionCompleted) return; 
    missionCompleted = true; 
 
    // Completing the mission SPENDS the temple budget — the wallet is
    // decremented, never refunded. Coins/pearls never go below 0.
    coins = Math.max(0, coins - TEMPLE_COINS); 
    pearls = Math.max(0, pearls - TEMPLE_PEARLS); 
 
    document.getElementById("coinCount").innerText = coins; 
    document.getElementById("pearlCount").innerText = pearls; 
 
    saveWallet(); 
 
    // Unlock Task 3 
    localStorage.setItem("pandyaUnlockedTask",3); 
 
    document.getElementById("missionPopup").style.display = "flex"; 
 
}; 
 
// ================= CONTINUE ================= 
 
document.getElementById("continueBtn").onclick = ()=>{ 
 
    window.location.href = "task.html"; 
 
}; 
 
// ================= RESIZE ================= 
 
window.addEventListener("resize",()=>{ 
 
    camera.aspect = window.innerWidth / window.innerHeight; 
    camera.updateProjectionMatrix(); 

    renderer.setSize(window.innerWidth,window.innerHeight); 

}); 

// ================= ANIMATION LOOP ================= 

function animate(){ 

    requestAnimationFrame(animate); 

    // Gentle pulse of the golden construction ring while building 
    if(activeBuildRing){ 
        const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.04; 
        activeBuildRing.scale.set(pulse,pulse,1); 
    } 

    renderer.render(scene,camera); 

} 

animate(); 
