import { useEffect, useRef } from 'react';
import * as THREE from 'three';

function texture(draw, size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  return new THREE.CanvasTexture(canvas);
}

function glowTexture() {
  return texture((ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,206,98,.46)');
    g.addColorStop(.35, 'rgba(220,124,38,.16)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  });
}

function ringTexture() {
  return texture((ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, 84, c, c, 246);
    g.addColorStop(0, '#fff4bb'); g.addColorStop(.18, '#ffd55b');
    g.addColorStop(.34, '#a8601a'); g.addColorStop(.38, '#f6ba39');
    g.addColorStop(.7, '#c7811e'); g.addColorStop(1, '#edaa37');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c, c, 246, 0, Math.PI * 2);
    ctx.arc(c, c, 84, 0, Math.PI * 2, true); ctx.fill();
    for (let i = 0; i < 70; i++) {
      ctx.strokeStyle = i % 5 ? 'rgba(66,24,7,.16)' : 'rgba(255,239,172,.42)';
      ctx.lineWidth = i % 5 ? 1 : 2;
      ctx.beginPath(); ctx.arc(c, c, 87 + i * 2.25, 0, Math.PI * 2); ctx.stroke();
    }
  });
}

function flowerTexture() {
  return texture((ctx, s) => {
    ctx.translate(s / 2, s / 2);
    ctx.shadowColor = '#ffbe42'; ctx.shadowBlur = 20;
    for (let i = 0; i < 12; i++) {
      ctx.save(); ctx.rotate(i * Math.PI / 6);
      const g = ctx.createLinearGradient(0, -105, 0, -28);
      g.addColorStop(0, '#ffe59a'); g.addColorStop(.5, '#ffc83e'); g.addColorStop(1, '#c57815');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, -68, 17, 40, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.shadowBlur = 0; ctx.fillStyle = '#5b2e1c';
    ctx.beginPath(); ctx.arc(0, 0, 37, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#a9632a';
    for (let i = 0; i < 34; i++) {
      const r = Math.sqrt(i / 34) * 31, a = i * 2.39996;
      ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, 1.3, 0, Math.PI * 2); ctx.fill();
    }
  }, 256);
}

export default function Galaxy({ active, reducedMotion }) {
  const mount = useRef(null);
  const activity = useRef(active);
  activity.current = active;

  useEffect(() => {
    const host = mount.current;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(56, 1, .1, 2500);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);
    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(host); resize();

    const positions = new Float32Array(1500 * 3);
    for (let i = 0; i < 1500; i++) {
      const r = 280 + Math.random() * 1000, a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1;
      positions.set([r * Math.sqrt(1 - u * u) * Math.cos(a), r * u, r * Math.sqrt(1 - u * u) * Math.sin(a)], i * 3);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffedd1, size: 1.65, transparent: true, opacity: .75 })));

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(420, 420, 1); scene.add(glow);
    const ring = new THREE.Mesh(new THREE.RingGeometry(43, 126, 160), new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = Math.PI * .37; scene.add(ring);
    const core = new THREE.Mesh(new THREE.SphereGeometry(39, 48, 32), new THREE.MeshBasicMaterial({ color: 0x08070c }));
    core.position.z = 2; scene.add(core);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(40, 1.1, 8, 128), new THREE.MeshBasicMaterial({ color: 0xffd46b, transparent: true, opacity: .65 }));
    halo.position.z = 2; scene.add(halo);

    const flowerMap = flowerTexture();
    const flowers = Array.from({ length: 22 }, (_, i) => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: flowerMap, transparent: true, depthWrite: false, opacity: .9 }));
      const size = 12 + Math.random() * 18;
      sprite.scale.set(size, size, 1);
      sprite.userData = { angle: Math.random() * Math.PI * 2, radius: 145 + Math.random() * 155, y: (Math.random() - .5) * 180, speed: .0002 + Math.random() * .00035, offset: i };
      scene.add(sprite); return sprite;
    });

    let targetX = .12, targetY = 0, rotX = .12, rotY = 0, targetDistance = 365, distance = 365;
    let dragging = false, lastX = 0, lastY = 0, pinch = 0;
    const down = (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; host.setPointerCapture(e.pointerId); };
    const move = (e) => {
      if (!dragging) return;
      targetY -= (e.clientX - lastX) * .004;
      targetX = Math.max(-.75, Math.min(.75, targetX + (e.clientY - lastY) * .003));
      lastX = e.clientX; lastY = e.clientY;
    };
    const up = () => { dragging = false; };
    const wheel = (e) => { targetDistance = Math.max(265, Math.min(560, targetDistance + e.deltaY * .18)); };
    const touch = (e) => {
      if (e.touches.length !== 2) return;
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      if (pinch) targetDistance = Math.max(265, Math.min(560, targetDistance + (pinch - d) * .5));
      pinch = d;
    };
    const touchEnd = () => { pinch = 0; };
    host.addEventListener('pointerdown', down); host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', up); host.addEventListener('pointercancel', up);
    host.addEventListener('wheel', wheel, { passive: true });
    host.addEventListener('touchmove', touch, { passive: true }); host.addEventListener('touchend', touchEnd);

    const clock = new THREE.Clock(); let frame;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), .05);
      rotX += (targetX - rotX) * .05; rotY += (targetY - rotY) * .05;
      distance += (targetDistance - distance) * .06;
      if (!reducedMotion && activity.current) ring.rotation.z += delta * .1;
      flowers.forEach((flower) => {
        const data = flower.userData;
        if (!reducedMotion && activity.current) data.angle += data.speed * delta * 60;
        flower.position.set(Math.cos(data.angle) * data.radius, data.y + Math.sin(data.angle * 2 + data.offset) * 3, Math.sin(data.angle) * data.radius);
      });
      camera.position.set(distance * Math.sin(rotY) * Math.cos(rotX), distance * Math.sin(rotX), distance * Math.cos(rotY) * Math.cos(rotX));
      camera.lookAt(0, 0, 0); renderer.render(scene, camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      host.removeEventListener('pointerdown', down); host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerup', up); host.removeEventListener('pointercancel', up);
      host.removeEventListener('wheel', wheel); host.removeEventListener('touchmove', touch); host.removeEventListener('touchend', touchEnd);
      scene.traverse((object) => {
        object.geometry?.dispose();
        if (object.material) {
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => { if (material.map && material.map !== flowerMap) material.map.dispose(); material.dispose(); });
        }
      });
      flowerMap.dispose(); renderer.dispose(); host.removeChild(renderer.domElement);
    };
  }, [reducedMotion]);
  return <div ref={mount} className="galaxy-canvas" aria-hidden="true" />;
}
