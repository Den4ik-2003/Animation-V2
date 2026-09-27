(function () {
  const root = document.getElementById("ssbBlock");
  const canvas = document.getElementById("ssbCanvas");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const w0 = window.innerWidth;
  const mobile = w0 < 700;
  const laptop = w0 >= 700 && w0 < 1300;
  const COUNT = mobile ? 1600 : laptop ? 4500 : 7000;
  const RING_COUNT = mobile ? 1 : 3;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
  camera.position.z = 620;

  function size() {
    const w = root.clientWidth,
      h = root.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  size();
  window.addEventListener("resize", size);

  const glowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    const rad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    rad.addColorStop(0, "rgba(0,255,102,0.55)");
    rad.addColorStop(1, "rgba(0,255,102,0)");
    g.fillStyle = rad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
    }),
  );
  glow.scale.set(1400, 1400, 1);
  glow.position.z = -300;
  scene.add(glow);

  const R = mobile ? 130 : 190;
  const positions = new Float32Array(COUNT * 3);
  const basePos = new Float32Array(COUNT * 3);
  const sizes = new Float32Array(COUNT);
  const alphas = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const u = Math.random(),
      v = Math.random();
    const theta = 2 * Math.PI * u,
      phi = Math.acos(2 * v - 1);
    const x = R * Math.sin(phi) * Math.cos(theta);
    const y = R * Math.sin(phi) * Math.sin(theta);
    const z = R * Math.cos(phi);
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    basePos[i * 3] = x;
    basePos[i * 3 + 1] = y;
    basePos[i * 3 + 2] = z;
    sizes[i] = Math.random() * 2.4 + 0.6;
    alphas[i] = Math.random() * 0.6 + 0.3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const dotTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d");
    const r = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    r.addColorStop(0, "rgba(210,255,225,1)");
    r.addColorStop(0.4, "rgba(0,255,102,.9)");
    r.addColorStop(1, "rgba(0,255,102,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  })();
  const mat = new THREE.PointsMaterial({
    map: dotTex,
    size: mobile ? 3.4 : 2.6,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0.85,
    sizeAttenuation: true,
    vertexColors: false,
  });
  const sphere = new THREE.Points(geo, mat);
  scene.add(sphere);

  const torus = new THREE.Mesh(
    new THREE.TorusGeometry(R * 0.55, 1.1, 8, 60),
    new THREE.MeshBasicMaterial({
      color: 0x00ff66,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    }),
  );
  scene.add(torus);

  const rings = [];
  for (let i = 0; i < RING_COUNT; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(R * 0.8 + i * 22, R * 0.8 + i * 22 + 1.4, 80),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.12 - i * 0.02,
        side: THREE.DoubleSide,
      }),
    );
    ring.rotation.x = Math.PI / 2 + i * 0.5;
    ring.rotation.y = i * 0.7;
    scene.add(ring);
    rings.push(ring);
  }

  const textEl = root.querySelector(".ssb-text");

  let targetRotX = 0,
    targetRotY = 0,
    curRotX = 0,
    curRotY = 0;
  let mouseX = 0,
    mouseY = 0,
    mouseActive = false;
  let clickTime = -10,
    exploded = false;
  const waves = []; // {start,life}

  function onMove(nx, ny) {
    mouseX = nx;
    mouseY = ny;
    mouseActive = true;
    targetRotY = nx * 0.6;
    targetRotX = -ny * 0.4;
  }
  root.addEventListener("mousemove", (e) => {
    const r = root.getBoundingClientRect();
    onMove(
      ((e.clientX - r.left) / r.width - 0.5) * 2,
      ((e.clientY - r.top) / r.height - 0.5) * 2,
    );
  });
  root.addEventListener(
    "touchmove",
    (e) => {
      if (!e.touches[0]) return;
      const r = root.getBoundingClientRect();
      const t = e.touches[0];
      onMove(
        ((t.clientX - r.left) / r.width - 0.5) * 2,
        ((t.clientY - r.top) / r.height - 0.5) * 2,
      );
    },
    { passive: true },
  );
  root.addEventListener("mouseleave", () => {
    mouseActive = false;
    targetRotX = 0;
    targetRotY = 0;
  });

  function triggerExplosion() {
    clickTime = clock.getElapsedTime();
    exploded = true;
    waves.push({ start: clock.getElapsedTime(), life: 1.6 });
    gsap.fromTo(
      sphere.scale,
      { x: 1.15, y: 1.15, z: 1.15 },
      { x: 1, y: 1, z: 1, duration: 0.9, ease: "elastic.out(1,0.4)" },
    );
  }
  root.addEventListener("click", triggerExplosion);

  let hoverBoost = 0;
  root.addEventListener("mouseenter", () => {
    gsap.to(
      { v: hoverBoost },
      {
        v: 1,
        duration: 0.6,
        onUpdate: function () {
          hoverBoost = this.targets()[0].v;
        },
      },
    );
  });
  root.addEventListener("mouseleave", () => {
    gsap.to(
      { v: hoverBoost },
      {
        v: 0,
        duration: 0.6,
        onUpdate: function () {
          hoverBoost = this.targets()[0].v;
        },
      },
    );
  });

  let inView = false;
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        inView = en.isIntersecting;
        gsap.to(sphere.scale, {
          x: inView ? 1 : 0.5,
          y: inView ? 1 : 0.5,
          z: inView ? 1 : 0.5,
          duration: 1.1,
          ease: "power3.out",
        });
        gsap.to(textEl, {
          opacity: inView ? 1 : 0,
          filter: inView ? "blur(0px)" : "blur(14px)",
          duration: 1.1,
          ease: "power3.out",
        });
      });
    },
    { threshold: 0.3 },
  );
  io.observe(root);

  const clock = new THREE.Clock();
  const posAttr = geo.attributes.position;

  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    const dt = Math.min(clock.getDelta(), 0.05);

    curRotX += (targetRotX - curRotX) * 0.06;
    curRotY += (targetRotY - curRotY) * 0.06;
    sphere.rotation.y = t * 0.12 + curRotY;
    sphere.rotation.x = curRotX * 0.6;
    torus.rotation.y = -t * 0.25;
    torus.rotation.x = t * 0.1;
    rings.forEach((r, i) => {
      r.rotation.z = t * (0.15 + i * 0.08) * (i % 2 ? 1 : -1);
    });

    let explodeFactor = 0;
    if (exploded) {
      const dtE = t - clickTime;
      if (dtE < 0.9) {
        explodeFactor = Math.sin(Math.min(dtE / 0.9, 1) * Math.PI);
      } else {
        exploded = false;
      }
    }

    for (let i = waves.length - 1; i >= 0; i--) {
      const wv = waves[i];
      const age = t - wv.start;
      if (age > wv.life) waves.splice(i, 1);
    }

    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      let bx = basePos[ix],
        by = basePos[ix + 1],
        bz = basePos[ix + 2];
      const dist = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
      let mul = 1;
      if (explodeFactor > 0) {
        mul += explodeFactor * 1.8;
      }

      for (const wv of waves) {
        const age = t - wv.start;
        const waveR = age * 260;
        const d = Math.abs(dist - waveR);
        if (d < 24) {
          mul += (1 - d / 24) * 0.35 * (1 - age / wv.life);
        }
      }
      posAttr.array[ix] = bx * mul;
      posAttr.array[ix + 1] = by * mul;
      posAttr.array[ix + 2] = bz * mul;
    }
    posAttr.needsUpdate = true;

    mat.opacity = 0.75 + hoverBoost * 0.2;
    glow.material.opacity = 0.4 + hoverBoost * 0.25 + Math.sin(t * 0.6) * 0.03;

    renderer.render(scene, camera);
  }
  if (!reduced) animate();
  else renderer.render(scene, camera);

  if (!reduced) {
    setInterval(() => {
      waves.push({ start: clock.getElapsedTime(), life: 1.8 });
    }, 3400);
  }
})();
