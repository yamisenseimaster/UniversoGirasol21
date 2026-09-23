import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { flowerUrls, heartUrls, phrases } from './content';

function canvasTexture(draw, width = 512, height = width) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function glowTexture() {
  return canvasTexture((ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(.08, 'rgba(255,255,255,.6)');
    g.addColorStop(.3, 'rgba(255,255,255,.1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  });
}

function nebulaTexture() {
  // Soft irregular clouds share one texture; their layers move independently.
  return canvasTexture((ctx, size) => {
    for (let i = 0; i < 95; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * size * .29;
      const x = size / 2 + Math.cos(angle) * radius;
      const y = size / 2 + Math.sin(angle) * radius * .65;
      const spread = size * (.06 + Math.random() * .17);
      const g = ctx.createRadialGradient(x, y, 0, x, y, spread);
      g.addColorStop(0, 'rgba(255,255,255,.065)');
      g.addColorStop(.4, 'rgba(255,255,255,.028)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(x - spread, y - spread, spread * 2, spread * 2);
    }
  });
}

export default function Galaxy({ active, paused, resetKey, onError, onReady }) {
  const mount = useRef(null);
  const state = useRef({ paused, active }); state.current = { paused, active };
  const controlsRef = useRef(null);
  useEffect(() => { controlsRef.current?.reset(); }, [resetKey]);

  useEffect(() => {
    const host = mount.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' }); }
    catch { onError('Tu navegador no pudo iniciar la vista 3D. Prueba activar la aceleración gráfica.'); onReady(); return; }
    let needsRender = true;
    const mobile = host.clientWidth < 700;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.5 : 1.8));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    host.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x080511, .00055);
    const camera = new THREE.PerspectiveCamera(62, 1, .1, 2200);
    camera.position.set(0, 88, mobile ? 335 : 265);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = .045;
    controls.enablePan = false; controls.minDistance = 155; controls.maxDistance = 520;
    controls.autoRotateSpeed = .18; controls.maxPolarAngle = Math.PI * .83;
    controls.minPolarAngle = Math.PI * .15;
    controls.saveState(); controlsRef.current = controls;
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), .52, .55, .82);
    composer.addPass(bloom); composer.addPass(new OutputPass());
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setSize(w, h); composer.setSize(w, h);
      needsRender = true;
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();
    const textures = new Set();
    const glowMap = glowTexture(); textures.add(glowMap);
    const addGlow = (color, scale, position, opacity) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
      sprite.scale.set(scale, scale, 1); sprite.position.copy(position); scene.add(sprite); return sprite;
    };
    addGlow(0x763ad0, 1050, new THREE.Vector3(-320, 65, -400), .4);
    addGlow(0xc46430, 950, new THREE.Vector3(340, -140, -410), .28);
    addGlow(0x254ba7, 1100, new THREE.Vector3(40, 320, -570), .3);
    const centralGlow = addGlow(0xffa137, 290, new THREE.Vector3(), .72);
    const cloudMap = nebulaTexture(); textures.add(cloudMap);
    const cloudColors = [0x8955bd, 0xc77163, 0x557cbf, 0xbd853e];
    const clouds = Array.from({ length: mobile ? 6 : 9 }, (_, i) => {
      const angle = i * 2.39996;
      const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudMap, color: cloudColors[i % 4], transparent: true, opacity: .28, blending: THREE.AdditiveBlending, depthWrite: false }));
      const size = 370 + (i % 3) * 100;
      cloud.position.set(Math.cos(angle) * 190, Math.sin(angle) * 95, -160 - (i % 3) * 90);
      cloud.scale.set(size, size * .72, 1);
      cloud.userData = { size, x: cloud.position.x, y: cloud.position.y, phase: angle };
      scene.add(cloud); return cloud;
    });

    // Thousands of independently twinkling stars, in a single draw call.
    const starCount = mobile ? 3500 : 6500;
    const starPositions = new Float32Array(starCount * 3);
    const starSizes = new Float32Array(starCount);
    const phases = new Float32Array(starCount);
    for (let i = 0; i < starCount; i++) {
      const r = 500 + Math.random() * 900, a = Math.random() * Math.PI * 2, y = Math.random() * 2 - 1;
      starPositions.set([r * Math.sqrt(1 - y * y) * Math.cos(a), r * y, r * Math.sqrt(1 - y * y) * Math.sin(a)], i * 3);
      starSizes[i] = Math.random() > .97 ? 4 : 1 + Math.random() * 1.8;
      phases[i] = Math.random() * Math.PI * 2;
    }
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starsGeometry.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));
    starsGeometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    const starsMaterial = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: renderer.getPixelRatio() } },
      vertexShader: `attribute float aSize; attribute float aPhase; varying float vLight; uniform float uTime; uniform float uPixelRatio;
        void main(){vLight=.58+.42*sin(uTime*.65+aPhase); vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv; gl_PointSize=aSize*uPixelRatio;}`,
      fragmentShader: `varying float vLight; void main(){float d=length(gl_PointCoord-.5); float a=smoothstep(.5,.08,d); gl_FragColor=vec4(vec3(1.,.91,.76)*vLight,a);}`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(starsGeometry, starsMaterial));

    // Spiral arms are actual 3D particles, not a background image.
    const galaxy = new THREE.Group(); galaxy.rotation.z = -.18; scene.add(galaxy);
    const count = mobile ? 15000 : 28000;
    const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
    const inner = new THREE.Color('#fff0a0'), outer = new THREE.Color('#9c6196');
    for (let i = 0; i < count; i++) {
      const radius = 24 + Math.pow(Math.random(), .7) * 170;
      const arm = (i % 5) / 5 * Math.PI * 2;
      const angle = arm + radius * .035;
      const spread = 2 + radius * .11;
      const noise = () => (Math.random() - .5) * (Math.random() - .5) * 4;
      positions.set([Math.cos(angle) * radius + noise() * spread, noise() * (2 + radius * .028), Math.sin(angle) * radius + noise() * spread], i * 3);
      const color = inner.clone().lerp(outer, Math.pow(radius / 200, .8));
      colors.set([color.r, color.g, color.b], i * 3);
    }
    const spiralGeometry = new THREE.BufferGeometry();
    spiralGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    spiralGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const spiralTime = { value: 0 };
    const spiralMaterial = new THREE.PointsMaterial({ map: glowMap, size: 2.2, vertexColors: true, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending });
    spiralMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uSpiralTime = spiralTime;
      shader.vertexShader = 'uniform float uSpiralTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float radius = length(position.xz);
        float drift = uSpiralTime * .027 / (1.0 + radius * .012);
        float c = cos(drift), s = sin(drift);
        transformed.x = position.x * c - position.z * s;
        transformed.z = position.x * s + position.z * c;
        transformed.y += sin(radius * .045 - uSpiralTime * .35) * 1.35;
      `);
    };
    galaxy.add(new THREE.Points(spiralGeometry, spiralMaterial));
    const dustPositions = new Float32Array((mobile ? 240 : 480) * 3);
    for (let i = 0; i < dustPositions.length; i += 3) {
      const a = Math.random() * Math.PI * 2, r = 45 + Math.random() * 160;
      dustPositions.set([Math.cos(a) * r, (Math.random() - .5) * 65, Math.sin(a) * r], i);
    }
    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ map: glowMap, color: 0xffdf8f, size: 3.3, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending }));
    galaxy.add(dust);
    const core = new THREE.Mesh(new THREE.SphereGeometry(17, 48, 32), new THREE.MeshBasicMaterial({ color: 0x020104 }));
    galaxy.add(core);
    for (let i = 0; i < 14; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(19 + i * 1.35, i === 0 ? .62 : .15 + Math.random() * .28, 6, 180), new THREE.MeshBasicMaterial({ color: i < 3 ? 0xffeab0 : 0xeaa039, transparent: true, opacity: 1 - i * .055, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.rotation.x = Math.PI / 2; galaxy.add(ring);
    }

    let disposed = false;
    const floating = [];
    const loader = new THREE.TextureLoader();
    const decorations = [
      ...flowerUrls.map((url) => ({ url, kind: 'flower', count: mobile ? 28 : 42 })),
      ...heartUrls.map((url) => ({ url, kind: 'heart', count: mobile ? 8 : 12 })),
    ];
    const decorationLoads = decorations.map(({ url, kind, count }, imageIndex) => new Promise((resolve) => {
      const map = loader.load(url, (loaded) => {
        if (disposed) { loaded.dispose(); resolve(); return; }
        loaded.colorSpace = THREE.SRGBColorSpace;
        renderer.initTexture(loaded);
        const aspect = loaded.image.width / loaded.image.height;
        for (let i = 0; i < count; i++) {
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: loaded, transparent: true, depthWrite: false, opacity: .94, toneMapped: false }));
          const size = kind === 'heart' ? 9 + Math.random() * 9 : 13 + Math.random() * 13;
          sprite.scale.set(size * aspect, size, 1);
          sprite.userData = { angle: Math.random() * Math.PI * 2, radius: 80 + Math.random() * 160, height: (Math.random() - .5) * 165, phase: Math.random() * 6, speed: .013 + imageIndex * .005, kind, size, aspect };
          scene.add(sprite); floating.push(sprite);
        }
        resolve();
      }, undefined, () => { if (!disposed) onError('No se pudo cargar una imagen de la galaxia.'); resolve(); });
      textures.add(map);
    }));
    const addWords = async () => {
      if (disposed) return;
      const wordMaps = [];
      for (let i = 0; i < phrases.length; i++) {
        // Upload a few labels at a time so the sunflower stays responsive.
        if (i % 4 === 0) await new Promise((resolve) => requestAnimationFrame(resolve));
        if (disposed) return;
        const phrase = phrases[i];
        const map = canvasTexture((ctx, width, height) => {
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = "500 44px 'DM Sans', sans-serif";
          ctx.fillStyle = '#ffefbc'; ctx.shadowColor = '#ffa827'; ctx.shadowBlur = 12;
          ctx.fillText(phrase, width / 2, height / 2, width - 40);
        }, 1024, 128);
        textures.add(map); renderer.initTexture(map); wordMaps.push(map);
      }
      for (let i = 0; i < (mobile ? 64 : 96); i++) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: wordMaps[i % wordMaps.length], transparent: true, depthWrite: false, opacity: .85, toneMapped: false }));
        const width = 57 + Math.random() * 15;
        sprite.scale.set(width, width / 8, 1);
        sprite.userData = { angle: i * 2.39996, radius: 92 + (i % 6) * 26, height: ((i * 47) % 190) - 95, phase: i, speed: .01, kind: 'word' };
        scene.add(sprite); floating.push(sprite);
      }
    };
    let fontTimeout;
    const wordsLoaded = Promise.race([
      document.fonts.load("500 44px 'DM Sans'").catch(() => {}),
      new Promise((resolve) => { fontTimeout = setTimeout(resolve, 2500); }),
    ]).then(() => { clearTimeout(fontTimeout); return addWords(); });
    let shadersReady = false, warmedFrames = 0, readySignaled = false;
    Promise.all([...decorationLoads, wordsLoaded]).then(async () => {
      if (disposed) return;
      await renderer.compileAsync(scene, camera);
      if (!disposed) shadersReady = true;
    }).catch(() => {
      if (!disposed) {
        onError('No se pudo preparar la galaxia. Recarga la página para reintentar.');
        onReady();
      }
    });

    const meteors = Array.from({ length: mobile ? 7 : 12 }, (_, i) => {
      const direction = new THREE.Vector3(1, -.25 - Math.random() * .4, .08).normalize();
      const length = 28 + Math.random() * 32;
      const points = [], colors = [];
      for (let j = 0; j < 12; j++) {
        const fade = 1 - j / 11;
        points.push(direction.clone().multiplyScalar(-length * j / 11));
        colors.push(fade, fade * .88, fade * .65);
      }
      const g = new THREE.BufferGeometry().setFromPoints(points);
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowMap, color: 0xffe5b2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      head.scale.set(7, 7, 1); line.add(head);
      line.userData = { offset: i * 1.15, period: 10 + Math.random() * 5, duration: 1.8 + Math.random(), direction, start: new THREE.Vector3(-260 + Math.random() * 130, 60 + Math.random() * 190, -260 + Math.random() * 360), head };
      scene.add(line); return line;
    });
    const clock = new THREE.Clock(); let time = 0, frame;
    const render = () => {
      frame = requestAnimationFrame(render);
      const delta = Math.min(clock.getDelta(), .05);
      if (!shadersReady || (!state.current.active && readySignaled && !needsRender)) return;
      const paused = state.current.paused || !state.current.active;
      controls.enabled = state.current.active;
      if (!paused) time += delta;
      controls.autoRotate = !paused; controls.update(delta);
      starsMaterial.uniforms.uTime.value = time;
      spiralTime.value = time;
      galaxy.rotation.y = time * .018;
      galaxy.rotation.z = -.18 + Math.sin(time * .09) * .025;
      centralGlow.material.opacity = .7 + Math.sin(time * .45) * .035;
      dust.rotation.y = -time * .022;
      dust.position.y = Math.sin(time * .28) * 2;
      dust.material.opacity = .46 + Math.sin(time * .6) * .07;
      clouds.forEach((cloud) => {
        const d = cloud.userData;
        const breath = 1 + Math.sin(time * .1 + d.phase) * .065;
        cloud.scale.set(d.size * breath, d.size * .72 * breath, 1);
        cloud.position.x = d.x + Math.sin(time * .045 + d.phase) * 16;
        cloud.position.y = d.y + Math.cos(time * .06 + d.phase) * 10;
        cloud.material.rotation = d.phase + Math.sin(time * .045 + d.phase) * .12;
        cloud.material.opacity = .26 + Math.sin(time * .12 + d.phase) * .035;
      });
      floating.forEach((sprite) => {
        const d = sprite.userData, angle = d.angle + time * d.speed;
        sprite.position.set(Math.cos(angle) * d.radius, d.height + Math.sin(time * .35 + d.phase) * 4, Math.sin(angle) * d.radius);
        if (d.kind !== 'word') {
          sprite.material.rotation = Math.sin(time * .25 + d.phase) * .16;
          const breath = d.kind === 'heart'
            ? 1 + Math.pow(Math.max(0, Math.sin(time * 2.4 + d.phase)), 6) * .1
            : 1 + Math.sin(time * .55 + d.phase) * .035;
          sprite.scale.set(d.size * d.aspect * breath, d.size * breath, 1);
        }
        const distance = camera.position.distanceTo(sprite.position);
        sprite.material.opacity = THREE.MathUtils.clamp((distance - 28) / 80, 0, 1) * (d.kind === 'word' ? .85 : .94);
      });
      meteors.forEach((meteor) => {
        const d = meteor.userData;
        const phase = (time + d.offset) % d.period;
        const opacity = paused || phase > d.duration ? 0 : Math.sin(phase / d.duration * Math.PI) * .9;
        meteor.material.opacity = opacity;
        d.head.material.opacity = opacity;
        meteor.position.copy(d.start).addScaledVector(d.direction, phase * 230);
      });
      composer.render();
      needsRender = false;
      // Warm the bloom passes and GPU buffers before allowing the reveal.
      if (!readySignaled && ++warmedFrames >= 3) {
        readySignaled = true;
        onReady();
      }
    };
    render();
    const contextLost = (event) => { event.preventDefault(); onError('La vista 3D se interrumpió. Recarga la página para volver a entrar.'); };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    return () => {
      disposed = true; clearTimeout(fontTimeout); cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); controlsRef.current = null;
      scene.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
      textures.forEach((map) => map.dispose()); composer.passes.forEach((pass) => pass.dispose?.()); composer.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', contextLost); renderer.dispose(); renderer.domElement.remove();
    };
  }, [onError, onReady]);
  return <div ref={mount} className="galaxy-canvas" aria-label="Galaxia 3D: arrastra para girar y usa la rueda o dos dedos para acercarte" />;
}
