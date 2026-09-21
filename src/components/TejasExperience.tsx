import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { RICE_VARIETIES, RiceVariety } from '../types/variety';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  ArrowRight, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  ChevronRight, 
  ShoppingBag, 
  ArrowLeft, 
  Maximize2, 
  Minimize2,
  Sliders,
  Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TejasExperienceProps {
  onExploreStore?: () => void;
  onBack?: () => void;
}

export default function TejasExperience({ onExploreStore, onBack }: TejasExperienceProps) {
  const navigate = useNavigate();
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Experience States
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [activeVariety, setActiveVariety] = useState<RiceVariety>(RICE_VARIETIES[0]);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPointerInteracting, setIsPointerInteracting] = useState<boolean>(false);

  // Mouse / Pointer coords normalized (-1 to 1)
  const pointerRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const progressRef = useRef<number>(0);
  progressRef.current = scrollProgress;

  // Active variety ref for Three.js render loop
  const activeVarietyRef = useRef<RiceVariety>(activeVariety);
  activeVarietyRef.current = activeVariety;

  // Audio tone synthesizer for ambient peaceful experience
  const audioCtxRef = useRef<AudioContext | null>(null);
  const playWindChime = useCallback(() => {
    if (isMuted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const freqs = [523.25, 659.25, 783.99, 1046.5];
      const freq = freqs[Math.floor(Math.random() * freqs.length)];
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 1.2);
    } catch {}
  }, [isMuted]);

  // Handle variety switch
  const handleSelectVariety = (v: RiceVariety) => {
    setActiveVariety(v);
    playWindChime();
  };

  // Jump to specific scene progress
  const jumpToScene = (targetProgress: number) => {
    setScrollProgress(targetProgress);
    playWindChime();
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mountRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // --------------------------------------------------------------------------
  // THREE.JS SCENE SETUP & ANIMATION LOOP
  // --------------------------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = mountRef.current;
    if (!canvas || !container) return;

    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || window.innerHeight;

    // 1. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    // 2. Scene & Camera
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#F8F6F0');
    scene.fog = new THREE.FogExp2('#F3EFE6', 0.022);

    const camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 100);
    camera.position.set(0, 0.45, 14);

    // 3. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xfffaed, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffeecb, 2.2);
    sunLight.position.set(8, 16, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 40;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    const skyFillLight = new THREE.DirectionalLight(0xd9e8dd, 0.7);
    skyFillLight.position.set(-8, -2, -6);
    scene.add(skyFillLight);

    // 4. Ground Waterlogged Paddy Plane
    const groundGeo = new THREE.PlaneGeometry(80, 80, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x223525,
      roughness: 0.18,
      metalness: 0.35,
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.5;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // 5. Swaying Paddy Field Stalks (Scene 1 & 2)
    const stalksGroup = new THREE.Group();
    const bladeGeo = new THREE.ConeGeometry(0.045, 2.6, 5);
    bladeGeo.translate(0, 1.3, 0);

    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0x47633e,
      roughness: 0.6,
    });

    const ripeBladeMat = new THREE.MeshStandardMaterial({
      color: 0xc49b38,
      roughness: 0.5,
    });

    const stalkCount = 280;
    const stalksData: { mesh: THREE.Mesh; baseX: number; baseZ: number; phase: number; freq: number }[] = [];

    for (let i = 0; i < stalkCount; i++) {
      const isRipe = Math.random() > 0.45;
      const mesh = new THREE.Mesh(bladeGeo, isRipe ? ripeBladeMat : bladeMat);
      const row = Math.floor(i / 20);
      const col = i % 20;
      const x = (col - 10) * 0.9 + (Math.random() - 0.5) * 0.4;
      const z = (row - 7) * 0.9 + (Math.random() - 0.5) * 0.4;
      
      mesh.position.set(x, -0.5, z);
      mesh.rotation.y = Math.random() * Math.PI * 2;
      mesh.rotation.z = (Math.random() - 0.5) * 0.2;
      mesh.scale.setScalar(0.7 + Math.random() * 0.6);
      mesh.castShadow = true;
      stalksGroup.add(mesh);

      stalksData.push({
        mesh,
        baseX: x,
        baseZ: z,
        phase: Math.random() * Math.PI * 2,
        freq: 1.2 + Math.random() * 0.8
      });
    }
    scene.add(stalksGroup);

    // 6. Natural Hand / Palm Representation (Scene 3 & 4)
    const handGroup = new THREE.Group();
    handGroup.position.set(0, -0.15, 6.2);

    // Organic cupped palm shape
    const palmGeo = new THREE.SphereGeometry(1.2, 32, 16);
    palmGeo.scale(1.2, 0.35, 1.5);
    const palmMat = new THREE.MeshStandardMaterial({
      color: 0xdfb496,
      roughness: 0.75,
      metalness: 0.05,
    });
    const palmMesh = new THREE.Mesh(palmGeo, palmMat);
    palmMesh.position.set(0, 0, 0);
    palmMesh.receiveShadow = true;
    handGroup.add(palmMesh);

    // Finger contours
    for (let f = -2; f <= 2; f++) {
      const fingerGeo = new THREE.CapsuleGeometry(0.18, 1.1, 8, 16);
      const fingerMesh = new THREE.Mesh(fingerGeo, palmMat);
      fingerMesh.rotation.x = Math.PI / 2.3;
      fingerMesh.position.set(f * 0.42, 0.08, -1.2);
      handGroup.add(fingerMesh);
    }

    // Reference grains sitting resting in palm
    const palmGrainsCount = 35;
    const palmGrainGeo = new THREE.SphereGeometry(0.1, 16, 12);
    palmGrainGeo.scale(0.35, 1.0, 0.4);
    const palmGrainMat = new THREE.MeshStandardMaterial({
      color: 0xf5eedb,
      roughness: 0.35,
    });
    const palmGrainsMesh = new THREE.InstancedMesh(palmGrainGeo, palmGrainMat, palmGrainsCount);
    const dummyObj = new THREE.Object3D();
    for (let i = 0; i < palmGrainsCount; i++) {
      const angle = (i / palmGrainsCount) * Math.PI * 2;
      const rad = Math.sqrt(Math.random()) * 0.65;
      dummyObj.position.set(
        Math.cos(angle) * rad,
        0.22 + Math.random() * 0.08,
        Math.sin(angle) * rad * 1.2
      );
      dummyObj.rotation.set(
        Math.random() * 0.4,
        Math.random() * Math.PI,
        Math.random() * 0.4
      );
      dummyObj.scale.setScalar(1.2 + Math.random() * 0.4);
      dummyObj.updateMatrix();
      palmGrainsMesh.setMatrixAt(i, dummyObj.matrix);
    }
    palmGrainsMesh.instanceMatrix.needsUpdate = true;
    handGroup.add(palmGrainsMesh);
    scene.add(handGroup);

    // 7. Orbiting Varieties Ring (Scene 4: Variety Select)
    const varietyOrbitGroup = new THREE.Group();
    varietyOrbitGroup.position.set(0, 0.7, 5.5);
    
    const varietyNodeCount = RICE_VARIETIES.length;
    const varietyMeshes: THREE.Mesh[] = [];
    RICE_VARIETIES.forEach((_, idx) => {
      const vGeo = new THREE.SphereGeometry(0.2, 24, 16);
      vGeo.scale(0.4, 1.1, 0.45);
      const vMat = new THREE.MeshPhysicalMaterial({
        color: 0xfcf9f0,
        roughness: 0.25,
        transmission: 0.4,
        ior: 1.45,
        thickness: 0.8,
      });
      const vMesh = new THREE.Mesh(vGeo, vMat);
      varietyOrbitGroup.add(vMesh);
      varietyMeshes.push(vMesh);
    });
    scene.add(varietyOrbitGroup);

    // 8. The Macro Hero Grain with Translucent Subsurface Light Scattering
    const heroGrainGeo = new THREE.SphereGeometry(1.0, 64, 48);
    heroGrainGeo.scale(0.32, 1.0, 0.38); // Stretched slender grain ratio
    
    // Taper top tip
    const posAttr = heroGrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const y = posAttr.getY(i);
      if (y > 0.4) {
        const factor = 1 - (y - 0.4) * 0.55;
        posAttr.setX(i, posAttr.getX(i) * factor);
        posAttr.setZ(i, posAttr.getZ(i) * factor);
      }
    }
    heroGrainGeo.computeVertexNormals();

    const heroGrainMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(activeVarietyRef.current.shaderParams.baseColor),
      roughness: activeVarietyRef.current.shaderParams.roughness,
      transmission: activeVarietyRef.current.shaderParams.transmission,
      ior: activeVarietyRef.current.shaderParams.ior,
      thickness: 1.4,
      attenuationColor: new THREE.Color(activeVarietyRef.current.shaderParams.subsurfaceColor),
      attenuationDistance: activeVarietyRef.current.shaderParams.translucencyDepth,
      clearcoat: 0.2,
      clearcoatRoughness: 0.25,
      specularIntensity: 0.9,
    });

    const heroGrainMesh = new THREE.Mesh(heroGrainGeo, heroGrainMat);
    heroGrainMesh.position.set(0, 0.15, 0);
    heroGrainMesh.castShadow = true;
    scene.add(heroGrainMesh);

    // 9. Falling Instanced Grain Stream (Scene 7 & 8)
    const CASCADE_COUNT = 450;
    const streamGrainGeo = new THREE.SphereGeometry(0.12, 16, 12);
    streamGrainGeo.scale(0.35, 1.0, 0.4);
    const streamGrainMat = new THREE.MeshStandardMaterial({
      color: 0xfbf8ee,
      roughness: 0.3,
    });
    const instancedStream = new THREE.InstancedMesh(streamGrainGeo, streamGrainMat, CASCADE_COUNT);
    instancedStream.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(instancedStream);

    // 10. The Tejas Canvassing Sack & Pedestal (Scene 9 & 10)
    const bagGroup = new THREE.Group();
    bagGroup.position.set(0, -0.6, 2.5);

    // Pedestal
    const pedestalGeo = new THREE.CylinderGeometry(2.2, 2.4, 0.5, 48);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0xede8dc,
      roughness: 0.85,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.3;
    pedestal.receiveShadow = true;
    bagGroup.add(pedestal);

    // Minimal shadow disc
    const shadowDiscGeo = new THREE.CircleGeometry(2.8, 32);
    const shadowDiscMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.12,
    });
    const shadowDisc = new THREE.Mesh(shadowDiscGeo, shadowDiscMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = -0.04;
    bagGroup.add(shadowDisc);

    // Burlap Kraft Bag body
    const bagBodyGeo = new THREE.CylinderGeometry(1.2, 1.05, 2.2, 32);
    bagBodyGeo.scale(1.0, 1.0, 0.75); // Flatter rice bag profile
    const bagBodyMat = new THREE.MeshStandardMaterial({
      color: 0xe8dfc8, // Warm Husk
      roughness: 0.92,
      bumpScale: 0.05,
    });
    const bagBody = new THREE.Mesh(bagBodyGeo, bagBodyMat);
    bagBody.position.y = 1.05;
    bagBody.castShadow = true;
    bagGroup.add(bagBody);

    // Forest Green Branding Band across Bag
    const bandGeo = new THREE.CylinderGeometry(1.205, 1.15, 0.7, 32);
    bandGeo.scale(1.0, 1.0, 0.752);
    const bandMat = new THREE.MeshStandardMaterial({
      color: 0x1b3022, // Forest Canopy
      roughness: 0.45,
    });
    const brandBand = new THREE.Mesh(bandGeo, bandMat);
    brandBand.position.y = 1.25;
    bagGroup.add(brandBand);

    // Top Stitched Edge / Hem
    const hemGeo = new THREE.TorusGeometry(1.15, 0.08, 12, 32);
    hemGeo.scale(1.0, 1.0, 0.75);
    hemGeo.rotateX(Math.PI / 2);
    const hemMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Gold stitch
      roughness: 0.6,
    });
    const bagHem = new THREE.Mesh(hemGeo, hemMat);
    bagHem.position.y = 2.15;
    bagGroup.add(bagHem);

    // Canvas Grain Inspection Window (Oval)
    const windowGeo = new THREE.SphereGeometry(0.35, 24, 16);
    windowGeo.scale(0.8, 1.2, 0.1);
    const windowMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.85,
      roughness: 0.1,
      transparent: true,
      opacity: 0.9,
    });
    const inspectWindow = new THREE.Mesh(windowGeo, windowMat);
    inspectWindow.position.set(0, 0.65, 0.78);
    bagGroup.add(inspectWindow);

    scene.add(bagGroup);

    // ------------------------------------------------------------------------
    // RENDER LOOP WITH CONTINUOUS CAMERA CHOREOGRAPHY
    // ------------------------------------------------------------------------
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const render = () => {
      const elapsedTime = clock.getElapsedTime();
      const p = progressRef.current;
      const ptr = pointerRef.current;

      // Smooth pointer lerp
      ptr.x += (ptr.targetX - ptr.x) * 0.05;
      ptr.y += (ptr.targetY - ptr.y) * 0.05;

      // Sync active variety shader colors
      const curVar = activeVarietyRef.current;
      heroGrainMat.color.set(curVar.shaderParams.baseColor);
      heroGrainMat.roughness = curVar.shaderParams.roughness;
      heroGrainMat.transmission = curVar.shaderParams.transmission;
      heroGrainMat.ior = curVar.shaderParams.ior;
      heroGrainMat.attenuationColor.set(curVar.shaderParams.subsurfaceColor);
      heroGrainMat.attenuationDistance = curVar.shaderParams.translucencyDepth;

      // 1. Swaying paddy blades animation
      stalksData.forEach((s) => {
        const wind = Math.sin(elapsedTime * s.freq + s.phase) * 0.12;
        s.mesh.rotation.z = wind;
        s.mesh.rotation.x = Math.cos(elapsedTime * 0.8 + s.phase) * 0.05;
      });

      // 2. Camera Choreography (0.00 -> 1.00)
      if (p < 0.18) {
        // SCENE 01: THE FARM (Low glide through mist and golden stalks)
        const t = p / 0.18;
        camera.position.set(
          ptr.x * 0.4,
          0.45 + t * 0.35,
          14 - t * 4.5
        );
        camera.lookAt(0, 0.25 + t * 0.1, 0);
        stalksGroup.visible = true;
        handGroup.visible = false;
        varietyOrbitGroup.visible = false;
        heroGrainMesh.visible = false;
        instancedStream.visible = false;
        bagGroup.visible = false;
      } else if (p < 0.38) {
        // SCENE 02-03: THE HARVEST & THE HAND
        const t = (p - 0.18) / 0.20;
        stalksGroup.visible = true;
        handGroup.visible = true;
        varietyOrbitGroup.visible = false;
        heroGrainMesh.visible = false;
        instancedStream.visible = false;
        bagGroup.visible = false;

        // Camera moves close to hand
        camera.position.set(
          0.3 * (1 - t) + ptr.x * 0.3,
          0.8 - t * 0.15 + ptr.y * 0.2,
          9.5 - t * 2.8
        );
        camera.lookAt(0, -0.05, 6.2);

        // Hand lifts and collects grains
        handGroup.position.y = -0.5 + t * 0.35;
        handGroup.rotation.z = Math.sin(t * Math.PI) * 0.08;
      } else if (p < 0.56) {
        // SCENE 04: VARIETY SELECTION (Orbiting ring above palm)
        const t = (p - 0.38) / 0.18;
        stalksGroup.visible = false;
        handGroup.visible = true;
        varietyOrbitGroup.visible = true;
        heroGrainMesh.visible = false;
        instancedStream.visible = false;
        bagGroup.visible = false;

        camera.position.set(
          Math.sin(t * 0.8) * 1.2 + ptr.x * 0.4,
          0.9 - t * 0.1 - ptr.y * 0.3,
          7.2 - t * 1.5
        );
        camera.lookAt(0, 0.4, 5.5);

        // Orbit variety nodes in 3D arc
        varietyOrbitGroup.rotation.y = elapsedTime * 0.35 + t * Math.PI * 0.5;
        varietyMeshes.forEach((mesh, idx) => {
          const angle = (idx / varietyNodeCount) * Math.PI * 2;
          const rad = 1.6;
          mesh.position.set(
            Math.cos(angle) * rad,
            Math.sin(angle * 2) * 0.2,
            Math.sin(angle) * rad
          );
          mesh.rotation.y += 0.02;
        });
      } else if (p < 0.76) {
        // SCENE 05-06: THE HERO GRAIN & QUALITY LABELS (Macro Subsurface Inspection)
        const t = (p - 0.56) / 0.20;
        stalksGroup.visible = false;
        handGroup.visible = false;
        varietyOrbitGroup.visible = false;
        heroGrainMesh.visible = true;
        instancedStream.visible = false;
        bagGroup.visible = false;

        // Camera orbits smoothly around hero grain
        const orbitAngle = t * Math.PI * 1.2;
        const orbitRadius = 2.8 - Math.sin(t * Math.PI) * 0.4;
        camera.position.set(
          Math.sin(orbitAngle) * orbitRadius + ptr.x * 0.35,
          0.3 + Math.cos(orbitAngle * 0.5) * 0.3 - ptr.y * 0.35,
          Math.cos(orbitAngle) * orbitRadius
        );
        camera.lookAt(0, 0.15, 0);

        // Slow cinematic rotation of grain with gentle bobbing
        heroGrainMesh.rotation.y = elapsedTime * 0.2 + t * 2.5;
        heroGrainMesh.rotation.x = Math.sin(elapsedTime * 0.6) * 0.12;
        heroGrainMesh.scale.setScalar(1.0 + Math.sin(t * Math.PI) * 0.3);
      } else if (p < 0.90) {
        // SCENE 07-08: THE DESCENT (Instanced Gravity Cascade)
        const t = (p - 0.76) / 0.14;
        stalksGroup.visible = false;
        handGroup.visible = false;
        varietyOrbitGroup.visible = false;
        heroGrainMesh.visible = false;
        instancedStream.visible = true;
        bagGroup.visible = true;

        // Pull camera back to see falling shower into sack
        camera.position.set(
          ptr.x * 0.5,
          1.8 + t * 0.8,
          6.2 + t * 2.5
        );
        camera.lookAt(0, 0.6, 2.5);

        // Update 450 falling grains
        for (let i = 0; i < CASCADE_COUNT; i++) {
          const seed = i * 223.7;
          const speed = 1.0 + (i % 6) * 0.25;
          const initialY = 9.0 + (i % 35) * 0.4;
          const currentY = initialY - (t * 18.0 * speed) + (Math.sin(seed + elapsedTime) * 0.2);
          const settledY = Math.max(0.4, currentY); // Settle into bag top

          // Subtle cursor repulsion wake
          const repulseX = ptr.x * 0.6 * Math.max(0, 1 - Math.abs(settledY - 1.5));

          dummyObj.position.set(
            Math.sin(seed + elapsedTime * 0.5) * (0.65 + (i % 3) * 0.18) + repulseX,
            settledY,
            2.5 + Math.cos(seed) * 0.5
          );
          dummyObj.rotation.set(seed + elapsedTime * 2, seed * 1.5, elapsedTime);
          dummyObj.scale.setScalar(0.9 + (i % 4) * 0.15);
          dummyObj.updateMatrix();
          instancedStream.setMatrixAt(i, dummyObj.matrix);
        }
        instancedStream.instanceMatrix.needsUpdate = true;
      } else {
        // SCENE 09-10: TEJAS CANVASSING SACK ON PEDESTAL & FINAL CTA
        const t = (p - 0.90) / 0.10;
        stalksGroup.visible = false;
        handGroup.visible = false;
        varietyOrbitGroup.visible = false;
        heroGrainMesh.visible = false;
        instancedStream.visible = false;
        bagGroup.visible = true;

        // Elegant isometric 3/4 hero camera framing
        camera.position.set(
          1.4 * (1 - t * 0.3) + ptr.x * 0.3,
          1.8 + t * 0.3 - ptr.y * 0.2,
          7.2 - t * 0.5
        );
        camera.lookAt(0, 0.7, 2.5);

        // Bag gentle idle breathing
        bagGroup.rotation.y = Math.sin(elapsedTime * 0.4) * 0.05;
      }

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      groundGeo.dispose();
      bladeGeo.dispose();
      palmGeo.dispose();
      heroGrainGeo.dispose();
      streamGrainGeo.dispose();
      pedestalGeo.dispose();
    };
  }, []);

  // --------------------------------------------------------------------------
  // AUTO-PLAY ENGINE (Matches continuous 10s video clip)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!isPlaying) return;
    let animId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const delta = (now - lastTime) / 1000;
      lastTime = now;

      // 12 seconds loop for cinematic comfortable pace
      setScrollProgress((prev) => {
        const next = prev + delta * 0.085;
        if (next >= 1.0) {
          // Pause at end briefly or loop
          return 0.0;
        }
        return next;
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying]);

  // --------------------------------------------------------------------------
  // USER SCROLL & MOUSE INTERACTION
  // --------------------------------------------------------------------------
  const handleWheel = (e: React.WheelEvent) => {
    setIsPlaying(false);
    setScrollProgress((prev) => {
      const next = Math.max(0, Math.min(1.0, prev + e.deltaY * 0.00065));
      return next;
    });
  };

  const touchStartY = useRef<number>(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setIsPlaying(false);
    const deltaY = touchStartY.current - e.touches[0].clientY;
    touchStartY.current = e.touches[0].clientY;
    setScrollProgress((prev) => {
      return Math.max(0, Math.min(1.0, prev + deltaY * 0.0018));
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = mountRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
    pointerRef.current.targetX = x;
    pointerRef.current.targetY = y;
  };

  // Chapter mapping for rapid navigation
  const scenes = [
    { name: 'Field', chapter: '01', progress: 0.05 },
    { name: 'Harvest', chapter: '02', progress: 0.25 },
    { name: 'Varieties', chapter: '03', progress: 0.45 },
    { name: 'Macro Grain', chapter: '04', progress: 0.65 },
    { name: 'Descent', chapter: '05', progress: 0.82 },
    { name: 'Packaging', chapter: '06', progress: 0.96 },
  ];

  return (
    <div
      ref={mountRef}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onMouseMove={handleMouseMove}
      className="relative w-full h-screen overflow-hidden select-none bg-[#F8F6F0] dark:bg-[#07130e] text-[#1B3022] dark:text-[#E8DFC8]"
      style={{ fontFamily: '"Open Sans", sans-serif' }}
    >
      {/* 3D WebGL Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block cursor-grab active:cursor-grabbing z-0"
      />

      {/* Subtle atmospheric vignette gradient */}
      <div className="absolute inset-0 pointer-events-none z-1 bg-radial from-transparent via-transparent to-[#F8F6F0]/50 dark:to-black/60" />

      {/* =================================================================== */}
      {/* TOP BRAND HEADER NAVIGATION (Minimal Luxury Open Sans)              */}
      {/* =================================================================== */}
      <header className="absolute top-0 left-0 right-0 p-5 sm:p-8 flex items-center justify-between z-20 pointer-events-none">
        <div className="flex items-center gap-3 pointer-events-auto">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-full bg-white/70 dark:bg-black/40 backdrop-blur-md border border-[#1B3022]/15 dark:border-white/10 text-[#1B3022] dark:text-white hover:bg-white transition-all cursor-pointer shadow-xs"
              title="Return"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate('/about')}
              className="p-2 rounded-full bg-white/70 dark:bg-black/40 backdrop-blur-md border border-[#1B3022]/15 dark:border-white/10 text-[#1B3022] dark:text-white hover:bg-white transition-all cursor-pointer shadow-xs"
              title="Return to About Us"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div className="flex items-center gap-2.5 bg-white/80 dark:bg-black/50 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#1B3022]/10 dark:border-white/10 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#1B3022] dark:bg-emerald-400 animate-pulse" />
            <span className="font-extrabold text-[12px] tracking-[0.22em] uppercase text-[#1B3022] dark:text-white">
              TEJAS CANVASSING
            </span>
            <span className="text-[10px] tracking-wider text-[#1B3022]/50 dark:text-white/40 hidden sm:inline">
              · 3D GRAIN JOURNEY
            </span>
          </div>
        </div>

        {/* Action Controls (Play/Pause, Sound, Fullscreen, Store) */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Play / Pause */}
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-md border border-[#1B3022]/15 dark:border-white/10 text-[#1B3022] dark:text-white text-[11px] font-bold uppercase tracking-wider hover:bg-white transition-all cursor-pointer shadow-xs"
            title={isPlaying ? "Pause cinematic tour" : "Play cinematic tour"}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3 h-3 text-[#D4AF37] fill-[#D4AF37]" />
                <span className="hidden sm:inline">Tour</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-[#1B3022] dark:text-emerald-400 fill-current" />
                <span className="hidden sm:inline">Play</span>
              </>
            )}
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => {
              setIsMuted(!isMuted);
              if (isMuted) playWindChime();
            }}
            className="p-2 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-md border border-[#1B3022]/15 dark:border-white/10 text-[#1B3022] dark:text-white hover:bg-white transition-all cursor-pointer shadow-xs"
            title={isMuted ? "Unmute atmospheric chimes" : "Mute audio"}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 opacity-60" /> : <Volume2 className="w-3.5 h-3.5 text-[#D4AF37]" />}
          </button>

          {/* Reset progress */}
          <button
            type="button"
            onClick={() => setScrollProgress(0)}
            className="p-2 rounded-full bg-white/80 dark:bg-black/50 backdrop-blur-md border border-[#1B3022]/15 dark:border-white/10 text-[#1B3022] dark:text-white hover:bg-white transition-all cursor-pointer shadow-xs hidden sm:block"
            title="Restart Journey"
          >
            <RotateCcw className="w-3.5 h-3.5 opacity-75" />
          </button>

          {/* Store Direct Link */}
          <button
            type="button"
            onClick={() => {
              if (onExploreStore) onExploreStore();
              else navigate('/store');
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#1B3022] text-white hover:bg-[#122318] text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm ml-1"
          >
            <ShoppingBag className="w-3.5 h-3.5 text-[#D4AF37]" />
            <span>Store</span>
          </button>
        </div>
      </header>

      {/* =================================================================== */}
      {/* DYNAMIC SCENE STORY OVERLAYS (0.00 -> 1.00)                         */}
      {/* =================================================================== */}

      {/* SCENE 01: FROM THE FIELD (Progress 0.00 - 0.18) */}
      <div
        className={`absolute bottom-24 sm:bottom-28 left-6 sm:left-14 max-w-md z-10 transition-all duration-500 pointer-events-none ${
          scrollProgress < 0.18 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <span className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#D4AF37] block mb-2">
          CHAPTER 01 / ORIGIN
        </span>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-[-0.03em] leading-[1.04] text-[#1B3022] dark:text-white mb-3">
          FROM THE FIELD
        </h1>
        <p className="text-base sm:text-lg font-light text-[#1B3022]/80 dark:text-white/80 leading-relaxed max-w-sm">
          Every grain begins with where it is grown — nurtured along fertile river deltas and harvested by dedicated grower families.
        </p>
      </div>

      {/* SCENE 02-03: THE HARVEST & THE HAND (Progress 0.18 - 0.38) */}
      <div
        className={`absolute top-28 sm:top-36 right-6 sm:right-16 text-right max-w-sm z-10 transition-all duration-500 pointer-events-none ${
          scrollProgress >= 0.18 && scrollProgress < 0.38 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'
        }`}
      >
        <div className="inline-flex items-center gap-2 bg-white/70 dark:bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-[#1B3022]/10 dark:border-white/10 mb-2">
          <span className="text-[10px] font-mono font-bold text-[#D4AF37]">
            GPS: [19.8253° N, 85.8078° E]
          </span>
        </div>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-[-0.02em] leading-tight text-[#1B3022] dark:text-white mb-2">
          SELECTED WITH CARE
        </h2>
        <p className="text-sm sm:text-base font-light text-[#1B3022]/80 dark:text-white/80 leading-relaxed">
          Culled by hand from mature, golden nodding stalks. Dehusked into pure, pristine, unbroken kernel formations.
        </p>
      </div>

      {/* SCENE 04: VARIETY SELECTION ORBIT (Progress 0.38 - 0.56) */}
      <div
        className={`absolute inset-x-0 bottom-24 sm:bottom-28 z-20 flex flex-col items-center justify-center px-4 transition-all duration-500 ${
          scrollProgress >= 0.38 && scrollProgress < 0.56 ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-8 pointer-events-none'
        }`}
      >
        <div className="text-center mb-3">
          <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#D4AF37] block">
            CHAPTER 03 / VARIETAL ARCHITECTURE
          </span>
          <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1B3022] dark:text-white">
            Choose Your Heritage Grain
          </h3>
        </div>

        {/* Variety Selector Pill Bar */}
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 max-w-2xl bg-white/85 dark:bg-black/70 backdrop-blur-xl p-2 rounded-2xl sm:rounded-full border border-[#1B3022]/15 dark:border-white/15 shadow-xl">
          {RICE_VARIETIES.map((v) => {
            const isSelected = activeVariety.id === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => handleSelectVariety(v)}
                className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#1B3022] text-white shadow-sm ring-2 ring-[#D4AF37]'
                    : 'text-[#1B3022] dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />}
                <span>{v.name}</span>
                <span className="text-[9px] opacity-60 uppercase tracking-tight ml-0.5">
                  ({v.category})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SCENE 05-06: MACRO GRAIN QUALITY LABELS (Progress 0.56 - 0.76) */}
      <div
        className={`absolute inset-0 z-15 pointer-events-none transition-all duration-500 ${
          scrollProgress >= 0.56 && scrollProgress < 0.76 ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top Floating Badge */}
        <div className="absolute top-24 left-1/2 -translate-x-1/2 text-center">
          <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#D4AF37] block mb-0.5">
            {activeVariety.origin}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1B3022] dark:text-white">
            {activeVariety.name}
          </h2>
          <span className="inline-block mt-1 text-[11px] font-bold px-3 py-0.5 rounded-full bg-[#D4AF37]/20 text-[#1B3022] dark:text-[#D4AF37] border border-[#D4AF37]/40">
            {activeVariety.packagingDetails.badgeText}
          </span>
        </div>

        {/* Metric A: Long Grain Annotation (Top Left) */}
        <div className="absolute top-[30%] left-6 sm:left-[14%] max-w-[200px]">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] ring-4 ring-[#D4AF37]/20" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1B3022]/60 dark:text-white/60">
              LONG GRAIN
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#1B3022] dark:text-white tabular-nums">
            {activeVariety.lengthMm} <span className="text-sm font-normal">mm</span>
          </div>
          <p className="text-[11px] text-[#1B3022]/70 dark:text-white/70 font-light mt-0.5">
            Slender elongation ratio with uniform mill finish.
          </p>
          <div className="w-16 h-px bg-[#1B3022]/20 dark:bg-white/20 mt-2" />
        </div>

        {/* Metric B: Premium Grade Annotation (Right) */}
        <div className="absolute top-[48%] right-6 sm:right-[14%] max-w-[210px] text-right">
          <div className="flex items-center justify-end gap-2 mb-1">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1B3022]/60 dark:text-white/60">
              PREMIUM GRADE
            </span>
            <span className="w-2 h-2 rounded-full bg-[#1B3022] dark:bg-emerald-400 ring-4 ring-[#1B3022]/20" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#1B3022] dark:text-white tabular-nums">
            {activeVariety.purityPercent}%
          </div>
          <p className="text-[11px] text-[#1B3022]/70 dark:text-white/70 font-light mt-0.5">
            Zero chalkiness, deep translucent pericarp integrity.
          </p>
          <div className="w-16 h-px bg-[#1B3022]/20 dark:bg-white/20 mt-2 ml-auto" />
        </div>

        {/* Metric C: Quality Grade & Elongation (Bottom Left) */}
        <div className="absolute bottom-[24%] left-8 sm:left-[18%] max-w-[220px]">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#D4AF37] ring-4 ring-[#D4AF37]/20" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-[#1B3022]/60 dark:text-white/60">
              QUALITY GRADE
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#1B3022] dark:text-white tabular-nums">
            {activeVariety.elongationRatio}x
          </div>
          <p className="text-[11px] text-[#1B3022]/70 dark:text-white/70 font-light mt-0.5">
            Moisture: {activeVariety.moisturePercent}% · Non-sticky texture.
          </p>
        </div>
      </div>

      {/* SCENE 07-08: THE DESCENT STREAM (Progress 0.76 - 0.90) */}
      <div
        className={`absolute top-28 left-1/2 -translate-x-1/2 text-center max-w-sm z-10 transition-all duration-500 pointer-events-none ${
          scrollProgress >= 0.76 && scrollProgress < 0.90 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'
        }`}
      >
        <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#D4AF37] block mb-1">
          CHAPTER 05 / CASCADE & SEAL
        </span>
        <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#1B3022] dark:text-white">
          THE DESCENT
        </h3>
        <p className="text-xs sm:text-sm font-light text-[#1B3022]/75 dark:text-white/75 mt-1">
          Fluid gravitational cascade into hermetically protected packaging sacks.
        </p>
      </div>

      {/* SCENE 09-10: THE TEJAS CANVASSING SACK & HERO CTA (Progress 0.90 - 1.00) */}
      <div
        className={`absolute bottom-20 sm:bottom-24 inset-x-0 flex flex-col items-center text-center z-20 px-4 transition-all duration-500 ${
          scrollProgress >= 0.90 ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-8 pointer-events-none'
        }`}
      >
        <span className="text-[11px] font-bold tracking-[0.25em] uppercase text-[#D4AF37] mb-1 block">
          CURATED HARVEST PACKAGING
        </span>
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-[-0.02em] text-[#1B3022] dark:text-white mb-2">
          TEJAS CANVASSING
        </h2>
        <p className="text-sm sm:text-base font-light text-[#1B3022]/80 dark:text-white/80 max-w-md mb-6">
          “More Than Rice. A Stronger Tomorrow.”
        </p>

        {/* Primary CTA button matching video */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (onExploreStore) onExploreStore();
              else navigate('/store');
            }}
            className="px-8 py-4 rounded-full bg-[#1B3022] hover:bg-[#122318] text-white text-xs sm:text-sm font-bold tracking-[0.15em] uppercase transition-all shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-2 group"
          >
            <span>VIEW RICE VARIETIES</span>
            <ArrowRight className="w-4 h-4 text-[#D4AF37] group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/about')}
            className="px-6 py-3.5 rounded-full bg-white/80 dark:bg-black/50 hover:bg-white text-[#1B3022] dark:text-white text-xs font-semibold tracking-wider uppercase border border-[#1B3022]/15 dark:border-white/15 transition-all cursor-pointer shadow-xs"
          >
            Explore Brand Story
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* BOTTOM SCENE STEPPER & SCRUBBER BAR                                 */}
      {/* =================================================================== */}
      <footer className="absolute bottom-4 sm:bottom-6 inset-x-0 px-6 sm:px-12 flex items-center justify-between z-20 pointer-events-auto">
        
        {/* Left: Quick Chapter Stepper */}
        <div className="flex items-center gap-1 sm:gap-2 bg-white/75 dark:bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-[#1B3022]/10 dark:border-white/10 shadow-xs overflow-x-auto no-scrollbar max-w-[70vw] sm:max-w-none">
          {scenes.map((s, idx) => {
            const isActive = Math.abs(scrollProgress - s.progress) < 0.12;
            return (
              <button
                key={s.chapter}
                type="button"
                onClick={() => jumpToScene(s.progress)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#1B3022] text-white shadow-xs'
                    : 'text-[#1B3022]/60 dark:text-white/50 hover:text-[#1B3022] dark:hover:text-white'
                }`}
              >
                <span>{s.chapter}</span>
                <span className="hidden md:inline ml-1 font-normal">{s.name}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Fullscreen Toggle */}
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-2 rounded-full bg-white/75 dark:bg-black/60 backdrop-blur-md border border-[#1B3022]/10 dark:border-white/10 text-[#1B3022] dark:text-white hover:bg-white transition-all cursor-pointer shadow-xs"
          title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </footer>

      {/* =================================================================== */}
      {/* RIGHT RAIL SCROLL PROGRESS INDICATOR                                */}
      {/* =================================================================== */}
      <div className="absolute right-4 sm:right-8 top-1/2 -translate-y-1/2 flex flex-col items-center gap-3 z-20 pointer-events-none">
        <span className="text-[9px] font-mono font-bold tracking-widest text-[#1B3022]/40 dark:text-white/40 rotate-90 origin-center mb-4">
          {Math.round(scrollProgress * 100)}%
        </span>
        
        {/* Track */}
        <div className="w-1 h-36 bg-[#1B3022]/10 dark:bg-white/15 rounded-full relative overflow-hidden">
          <div
            className="w-full bg-[#1B3022] dark:bg-[#D4AF37] rounded-full transition-all duration-75"
            style={{ height: `${Math.max(4, scrollProgress * 100)}%` }}
          />
        </div>

        <span className="text-[9px] font-mono text-[#D4AF37] font-bold mt-2">
          3D
        </span>
      </div>
    </div>
  );
}
