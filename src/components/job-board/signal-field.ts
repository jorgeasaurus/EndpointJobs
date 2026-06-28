import * as THREE from "three";

const nodeCount = 132;
const routeCount = 88;
const viewportHeight = 7.4;
const routeLowColor = new THREE.Color("#10b981");
const routeHighColor = new THREE.Color("#ccff00");

type SignalNode = {
  baseX: number;
  baseY: number;
  color: THREE.Color;
  driftX: number;
  driftY: number;
  phase: number;
  scale: number;
  speed: number;
  z: number;
};

type SignalRoute = {
  from: number;
  to: number;
};

export function mountEndpointSignalField(
  hostElement: HTMLDivElement,
  fieldElement: HTMLDivElement
) {
  const renderer = createRenderer();

  if (!renderer) {
    return undefined;
  }

  const webglRenderer = renderer;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -20, 20);
  const signalGroup = new THREE.Group();
  const nodes = createSignalNodes();
  const routes = createSignalRoutes(nodes);
  const nodeGeometry = new THREE.CircleGeometry(0.032, 16);
  const nodeMaterial = new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.82,
    transparent: true,
    vertexColors: true
  });
  const nodeMesh = new THREE.InstancedMesh(nodeGeometry, nodeMaterial, nodes.length);
  const linePositions = new Float32Array(routes.length * 2 * 3);
  const lineColors = new Float32Array(routes.length * 2 * 3);
  const routeGeometry = new THREE.BufferGeometry();
  const routeMaterial = new THREE.LineBasicMaterial({
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    opacity: 0.26,
    transparent: true,
    vertexColors: true
  });
  const routeLines = new THREE.LineSegments(routeGeometry, routeMaterial);
  const dummy = new THREE.Object3D();
  const positions = nodes.map(() => new THREE.Vector3());
  let width = 1;
  let height = 1;
  let animationFrame = 0;

  webglRenderer.domElement.dataset.endpointSignalCanvas = "true";
  hostElement.appendChild(webglRenderer.domElement);
  fieldElement.classList.add("parallax-field--three");

  for (let index = 0; index < nodes.length; index += 1) {
    nodeMesh.setColorAt(index, nodes[index].color);
  }

  routeGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
  routeGeometry.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));
  signalGroup.add(routeLines);
  signalGroup.add(nodeMesh);
  scene.add(signalGroup);

  function resize() {
    const bounds = hostElement.getBoundingClientRect();

    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);

    const aspect = width / height;
    const worldWidth = viewportHeight * aspect;
    const worldHeight = viewportHeight;

    camera.left = -worldWidth / 2;
    camera.right = worldWidth / 2;
    camera.top = worldHeight / 2;
    camera.bottom = -worldHeight / 2;
    camera.position.z = 8;
    camera.updateProjectionMatrix();
    webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    webglRenderer.setSize(width, height, false);
  }

  function render(time: number) {
    const seconds = time * 0.001;
    const aspect = width / height;
    const worldWidth = viewportHeight * aspect;

    signalGroup.rotation.z = Math.sin(seconds * 0.08) * 0.018;
    signalGroup.position.y = Math.sin(seconds * 0.11) * 0.08;

    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      const pulse = Math.sin(seconds * node.speed + node.phase);
      const x =
        node.baseX * worldWidth * 0.5 +
        Math.sin(seconds * 0.18 + node.phase) * node.driftX;
      const y =
        node.baseY * viewportHeight * 0.5 +
        Math.cos(seconds * 0.16 + node.phase * 1.17) * node.driftY;
      const scale = node.scale * (1 + pulse * 0.22);

      positions[index].set(x, y, node.z);
      dummy.position.copy(positions[index]);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      nodeMesh.setMatrixAt(index, dummy.matrix);
    }

    nodeMesh.instanceMatrix.needsUpdate = true;
    updateRoutes(routes, positions, linePositions, lineColors, seconds);
    routeGeometry.attributes.position.needsUpdate = true;
    routeGeometry.attributes.color.needsUpdate = true;

    webglRenderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(render);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(hostElement);
  resize();
  animationFrame = window.requestAnimationFrame(render);

  return () => {
    window.cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect();
    fieldElement.classList.remove("parallax-field--three");
    hostElement.removeChild(webglRenderer.domElement);
    nodeGeometry.dispose();
    nodeMaterial.dispose();
    routeGeometry.dispose();
    routeMaterial.dispose();
    webglRenderer.dispose();
  };
}

function createRenderer() {
  try {
    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "low-power"
    });

    renderer.setClearColor(0x000000, 0);
    return renderer;
  } catch {
    return null;
  }
}

function createSignalNodes() {
  let seed = 4729;
  const nodes: SignalNode[] = [];
  const lime = new THREE.Color("#ccff00");
  const emerald = new THREE.Color("#10b981");
  const white = new THREE.Color("#ebebeb");

  function random() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  for (let index = 0; index < nodeCount; index += 1) {
    const lane = index % 11;
    const baseX = -1.08 + random() * 2.16;
    const baseY = -0.98 + random() * 2.18;
    const color = index % 9 === 0 ? lime : index % 4 === 0 ? emerald : white;

    nodes.push({
      baseX: baseX + Math.sin(lane) * 0.025,
      baseY,
      color,
      driftX: 0.025 + random() * 0.095,
      driftY: 0.018 + random() * 0.072,
      phase: random() * Math.PI * 2,
      scale: index % 9 === 0 ? 1.62 : index % 4 === 0 ? 1.18 : 0.7 + random() * 0.42,
      speed: 0.62 + random() * 0.72,
      z: -1.8 + random() * 2.6
    });
  }

  return nodes;
}

function createSignalRoutes(nodes: SignalNode[]) {
  const candidates: Array<{ distance: number; from: number; to: number }> = [];

  for (let from = 0; from < nodes.length; from += 1) {
    for (let to = from + 1; to < nodes.length; to += 1) {
      const x = nodes[from].baseX - nodes[to].baseX;
      const y = nodes[from].baseY - nodes[to].baseY;
      const distance = Math.sqrt(x * x + y * y);

      if (distance < 0.34) {
        candidates.push({ distance, from, to });
      }
    }
  }

  return candidates
    .sort((first, second) => first.distance - second.distance)
    .slice(0, routeCount)
    .map(({ from, to }): SignalRoute => ({ from, to }));
}

function updateRoutes(
  routes: SignalRoute[],
  positions: THREE.Vector3[],
  linePositions: Float32Array,
  lineColors: Float32Array,
  seconds: number
) {
  for (let index = 0; index < routes.length; index += 1) {
    const route = routes[index];
    const from = positions[route.from];
    const to = positions[route.to];
    const offset = index * 6;
    const signal = ((Math.sin(seconds * 0.9 + index * 0.37) + 1) / 2) * 0.72;
    const red = routeLowColor.r + (routeHighColor.r - routeLowColor.r) * signal;
    const green = routeLowColor.g + (routeHighColor.g - routeLowColor.g) * signal;
    const blue = routeLowColor.b + (routeHighColor.b - routeLowColor.b) * signal;

    linePositions[offset] = from.x;
    linePositions[offset + 1] = from.y;
    linePositions[offset + 2] = from.z;
    linePositions[offset + 3] = to.x;
    linePositions[offset + 4] = to.y;
    linePositions[offset + 5] = to.z;

    lineColors[offset] = red * 0.72;
    lineColors[offset + 1] = green * 0.72;
    lineColors[offset + 2] = blue * 0.72;
    lineColors[offset + 3] = red;
    lineColors[offset + 4] = green;
    lineColors[offset + 5] = blue;
  }
}
