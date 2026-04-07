import * as THREE from "three";

function createEarthTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return null;
  }

  const ocean = ctx.createRadialGradient(420, 360, 80, 512, 512, 520);
  ocean.addColorStop(0, "#3e86c6");
  ocean.addColorStop(0.45, "#1e5a97");
  ocean.addColorStop(1, "#0a1d33");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const continents = [
    { x: 280, y: 340, rx: 180, ry: 108, rot: -0.4, color: "#68b07c" },
    { x: 630, y: 560, rx: 210, ry: 132, rot: 0.26, color: "#4f9965" },
    { x: 580, y: 270, rx: 128, ry: 84, rot: 0.8, color: "#87c896" },
    { x: 356, y: 664, rx: 162, ry: 92, rot: -0.2, color: "#5a9d6f" },
  ];

  continents.forEach((blob) => {
    ctx.save();
    ctx.translate(blob.x, blob.y);
    ctx.rotate(blob.rot);
    ctx.fillStyle = blob.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, blob.rx, blob.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.beginPath();
    ctx.ellipse(-blob.rx * 0.18, -blob.ry * 0.24, blob.rx * 0.32, blob.ry * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  for (let index = 0; index < 22; index += 1) {
    ctx.fillStyle = `rgba(255,255,255,${0.04 + Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      80 + Math.random() * 150,
      16 + Math.random() * 30,
      Math.random() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  return new THREE.CanvasTexture(canvas);
}

export default class ThreeFlightBackdrop {
  constructor({ parent, width, height }) {
    this.parent = parent;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "three-flight-layer";
    this.parent.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height, false);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, width / height, 0.1, 200);
    this.camera.position.set(0, 1.2, 20);

    this.scene.add(new THREE.AmbientLight(0xa7d8ff, 1.4));

    this.sunLight = new THREE.DirectionalLight(0xfff0d4, 2.6);
    this.sunLight.position.set(8, 5, 10);
    this.scene.add(this.sunLight);

    this.rimLight = new THREE.DirectionalLight(0x63c6ff, 1.2);
    this.rimLight.position.set(-6, -3, 6);
    this.scene.add(this.rimLight);

    this.planetGroup = new THREE.Group();
    this.scene.add(this.planetGroup);

    const earthTexture = createEarthTexture();
    const earthMaterial = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0.04,
      map: earthTexture,
      transparent: true,
    });
    this.earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(5.2, 64, 64),
      earthMaterial,
    );
    this.planetGroup.add(this.earthMesh);

    const atmosphereMaterial = new THREE.MeshBasicMaterial({
      color: 0x77d7ff,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    this.atmosphereMesh = new THREE.Mesh(
      new THREE.SphereGeometry(5.72, 48, 48),
      atmosphereMaterial,
    );
    this.planetGroup.add(this.atmosphereMesh);

    const cloudMaterial = new THREE.MeshStandardMaterial({
      color: 0xf5fbff,
      transparent: true,
      opacity: 0.12,
      roughness: 1,
    });
    this.cloudMesh = new THREE.Mesh(
      new THREE.SphereGeometry(5.34, 48, 48),
      cloudMaterial,
    );
    this.planetGroup.add(this.cloudMesh);

    const moonMaterial = new THREE.MeshStandardMaterial({
      color: 0xbbbcc4,
      roughness: 1,
      metalness: 0,
      transparent: true,
    });
    this.moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 24, 24),
      moonMaterial,
    );
    this.moonMesh.position.set(-8.5, 4.4, -7);
    this.scene.add(this.moonMesh);

    const starGeometry = new THREE.BufferGeometry();
    const starCount = 1200;
    const positions = new Float32Array(starCount * 3);
    for (let index = 0; index < starCount; index += 1) {
      positions[index * 3] = (Math.random() - 0.5) * 120;
      positions[index * 3 + 1] = (Math.random() - 0.5) * 90;
      positions[index * 3 + 2] = -25 - Math.random() * 80;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: 0xd5ebff,
      size: 0.18,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.starField = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.starField);
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  update(state) {
    const altitudeProgress = THREE.MathUtils.clamp(state.altitude / 260, 0, 1);
    const departureProgress = THREE.MathUtils.clamp(state.altitude / 430, 0, 1);
    const cinematicPlanetFade = 1 - THREE.MathUtils.clamp((state.altitude - 36) / 150, 0, 1);

    this.earthMesh.rotation.y += 0.0018;
    this.cloudMesh.rotation.y += 0.0024;
    this.moonMesh.rotation.y += 0.0012;

    this.planetGroup.position.set(
      THREE.MathUtils.lerp(-2.8, -7.8, departureProgress),
      THREE.MathUtils.lerp(-6.3, -9.6, departureProgress),
      THREE.MathUtils.lerp(-5.5, -15, departureProgress),
    );
    const earthScale = THREE.MathUtils.lerp(1.32, 0.54, departureProgress);
    this.planetGroup.scale.setScalar(earthScale);

    this.earthMesh.material.opacity = THREE.MathUtils.lerp(0.98, 0.12, 1 - cinematicPlanetFade);
    this.atmosphereMesh.material.opacity =
      THREE.MathUtils.lerp(0.22, 0.03, 1 - cinematicPlanetFade);
    this.cloudMesh.material.opacity =
      THREE.MathUtils.lerp(0.15, 0.02, 1 - cinematicPlanetFade);
    this.moonMesh.material.opacity =
      THREE.MathUtils.lerp(0.65, 0.18, 1 - cinematicPlanetFade);

    this.camera.position.x = THREE.MathUtils.lerp(0.55, 0, altitudeProgress);
    this.camera.position.y = THREE.MathUtils.lerp(0.8, 1.9, altitudeProgress);
    this.camera.position.z = THREE.MathUtils.lerp(16, 22, departureProgress);
    this.camera.lookAt(
      THREE.MathUtils.lerp(1.1, -1.6, departureProgress),
      THREE.MathUtils.lerp(-1.4, -4.2, departureProgress),
      -6.8,
    );

    this.starField.rotation.y += 0.00018;
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.scene.traverse((object) => {
      if (object.geometry) {
        object.geometry.dispose();
      }
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach((material) => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    });
    this.renderer.dispose();
    this.canvas.remove();
  }
}
