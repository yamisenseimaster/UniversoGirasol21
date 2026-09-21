import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { flowerUrls, phrases } from './content';

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

export default function Galaxy({ paused, resetKey, onError }) {
  const mount = useRef(null);
  const state = useRef({ paused }); state.current.paused = paused;
  const controlsRef = useRef(null);
  useEffect(() => { controlsRef.current?.reset(); }, [resetKey]);

  useEffect(() => {
    const host = mount.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'high-performance' }); }
    catch { onError('Tu navegador no pudo iniciar la vista 3D. Prueba activar la aceleración gráfica.'); return; }
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
    addGlow(0xffa137, 290, new THREE.Vector3(), .72);

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
    galaxy.add(new THREE.Points(spiralGeometry, new THREE.PointsMaterial({ map: glowMap, size: 2.2, vertexColors: true, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending })));
    const core = new THREE.Mesh(new THREE.SphereGeometry(17, 48, 32), new THREE.MeshBasicMaterial({ color: 0x020104 }));
    galaxy.add(core);
    for (let i = 0; i < 14; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(19 + i * 1.35, i === 0 ? .62 : .15 + Math.random() * .28, 6, 180), new THREE.MeshBasicMaterial({ color: i < 3 ? 0xffeab0 : 0xeaa039, transparent: true, opacity: 1 - i * .055, blending: THREE.AdditiveBlending, depthWrite: false }));
      ring.rotation.x = Math.PI / 2; galaxy.add(ring);
    }

    let disposed = false;
    const floating = [];
    const loader = new THREE.TextureLoader();
    flowerUrls.forEach((url, imageIndex) => {
      const map = loader.load(url, (loaded) => {
        if (disposed) { loaded.dispose(); return; }
        loaded.colorSpace = THREE.SRGBColorSpace;
        const aspect = loaded.image.width / loaded.image.height;
        for (let i = 0; i < (mobile ? 14 : 22); i++) {
          const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: loaded, transparent: true, depthWrite: false, opacity: .94, toneMapped: false }));
          const size = 13 + Math.random() * 13;
          sprite.scale.set(size * aspect, size, 1);
          sprite.userData = { angle: Math.random() * Math.PI * 2, radius: 80 + Math.random() * 160, height: (Math.random() - .5) * 155, phase: Math.random() * 6, speed: .013 + imageIndex * .005, kind: 'flower' };
          scene.add(sprite); floating.push(sprite);
        }
      }, undefined, () => { if (!disposed) onError('No se pudo cargar una imagen de girasol.'); });
      textures.add(map);
    });
    const addWords = () => {
      if (disposed) return;
      const wordMaps = phrases.map((phrase) => {
        const map = canvasTexture((ctx, width, height) => {
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.font = "500 44px 'DM Sans', sans-serif";
          ctx.fillStyle = '#ffefbc'; ctx.shadowColor = '#ffa827'; ctx.shadowBlur = 12;
          ctx.fillText(phrase, width / 2, height / 2, width - 40);
        }, 1024, 128);
        textures.add(map); return map;
      });
      for (let i = 0; i < (mobile ? 48 : 76); i++) {
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: wordMaps[i % wordMaps.length], transparent: true, depthWrite: false, opacity: .85, toneMapped: false }));
        const width = 57 + Math.random() * 15;
        sprite.scale.set(width, width / 8, 1);
        sprite.userData = { angle: i * 2.39996, radius: 92 + (i % 6) * 26, height: ((i * 47) % 190) - 95, phase: i, speed: .01, kind: 'word' };
        scene.add(sprite); floating.push(sprite);
      }
    };
    document.fonts.load("500 44px 'DM Sans'").catch(() => {}).then(addWords);

    const meteors = Array.from({ length: 3 }, (_, i) => {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(-34, 12, 0)]);
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffe5b2, transparent: true, opacity: 0, blending: THREE.AdditiveBlending }));
      line.userData.offset = i * 5.3; scene.add(line); return line;
    });
    const clock = new THREE.Clock(); let time = 0, frame;
    const render = () => {
      frame = requestAnimationFrame(render);
      const delta = Math.min(clock.getDelta(), .05);
      const paused = state.current.paused;
      if (!paused) time += delta;
      controls.autoRotate = !paused; controls.update(delta);
      starsMaterial.uniforms.uTime.value = time;
      galaxy.rotation.y = time * .018;
      floating.forEach((sprite) => {
        const d = sprite.userData, angle = d.angle + time * d.speed;
        sprite.position.set(Math.cos(angle) * d.radius, d.height + Math.sin(time * .35 + d.phase) * 4, Math.sin(angle) * d.radius);
        if (d.kind === 'flower') sprite.material.rotation = Math.sin(time * .25 + d.phase) * .12;
        const distance = camera.position.distanceTo(sprite.position);
        sprite.material.opacity = THREE.MathUtils.clamp((distance - 28) / 80, 0, 1) * (d.kind === 'word' ? .85 : .94);
      });
      meteors.forEach((meteor) => {
        const phase = (time + meteor.userData.offset) % 18;
        meteor.material.opacity = paused || phase > 1.8 ? 0 : Math.sin(phase / 1.8 * Math.PI) * .8;
        meteor.position.set(-200 + phase * 280, 160 - phase * 95, -240);
      });
      composer.render();
    };
    render();
    const contextLost = (event) => { event.preventDefault(); onError('La vista 3D se interrumpió. Recarga la página para volver a entrar.'); };
    renderer.domElement.addEventListener('webglcontextlost', contextLost);
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); controls.dispose(); controlsRef.current = null;
      scene.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
      textures.forEach((map) => map.dispose()); composer.passes.forEach((pass) => pass.dispose?.()); composer.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', contextLost); renderer.dispose(); renderer.domElement.remove();
    };
  }, [onError]);
  return <div ref={mount} className="galaxy-canvas" aria-label="Galaxia 3D: arrastra para girar y usa la rueda o dos dedos para acercarte" />;
}
