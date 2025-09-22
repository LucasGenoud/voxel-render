import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

let scene, camera, renderer, controls;
let instancedCubeMesh;
let cubeMaterial;
const cubeGeometry = new THREE.BoxGeometry(1, 1, 1); // Unit cube

const MAX_CUBES = 50 * 50 * 50; // Pre-allocate for max grid size

export function init(canvasElement) {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x282c34);

  camera = new THREE.PerspectiveCamera(
    75,
    canvasElement.clientWidth / canvasElement.clientHeight,
    0.1,
    1000
  );
  camera.position.set(15, 15, 15); // Initial camera position

  renderer = new THREE.WebGLRenderer({
    canvas: canvasElement,
    antialias: true,
  });
  renderer.setSize(canvasElement.clientWidth, canvasElement.clientHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 20, 5);
  scene.add(directionalLight);

  // Controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Material for cubes
  cubeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, // White base color
  });

  // Instanced Mesh for performance
  instancedCubeMesh = new THREE.InstancedMesh(
    cubeGeometry,
    cubeMaterial,
    MAX_CUBES
  );
  instancedCubeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // Create color buffer manually
  const colorArray = new Float32Array(MAX_CUBES * 3);
  for (let i = 0; i < MAX_CUBES; i++) {
    colorArray[i * 3] = 0.38; // R for default blue
    colorArray[i * 3 + 1] = 0.69; // G for default blue
    colorArray[i * 3 + 2] = 0.94; // B for default blue
  }

  instancedCubeMesh.instanceColor = new THREE.InstancedBufferAttribute(
    colorArray,
    3
  );
  instancedCubeMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

  scene.add(instancedCubeMesh);

  // Handle window resize
  window.addEventListener("resize", () => {
    camera.aspect = canvasElement.clientWidth / canvasElement.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(canvasElement.clientWidth, canvasElement.clientHeight);
  });

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

export function updateCubes(visibilityFunction, gridSize, time = 0) {
  if (!visibilityFunction || !instancedCubeMesh) return;

  console.time("UpdateCubesLogic");
  const dummy = new THREE.Object3D();
  const tempColor = new THREE.Color();
  let visibleCount = 0;
  const offset = gridSize / 2 - 0.5;

  // Get reference to the color array
  const colorArray = instancedCubeMesh.instanceColor.array;

  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      for (let z = 0; z < gridSize; z++) {
        let result = false;
        try {
          result = visibilityFunction(x, y, z, gridSize, time);
        } catch (e) {
          console.error(`Error in user function at (${x},${y},${z}):`, e);
          continue;
        }

        if (result) {
          if (visibleCount < MAX_CUBES) {
            // Set position
            dummy.position.set(x - offset, y - offset, z - offset);
            dummy.updateMatrix();
            instancedCubeMesh.setMatrixAt(visibleCount, dummy.matrix);

            // Set color directly in the array
            if (typeof result === "number" && result !== true && result !== 1) {
              // User returned a hex color
              tempColor.setHex(result);
              colorArray[visibleCount * 3] = tempColor.r;
              colorArray[visibleCount * 3 + 1] = tempColor.g;
              colorArray[visibleCount * 3 + 2] = tempColor.b;
            } else {
              // Default color (blue)
              colorArray[visibleCount * 3] = 0.38;
              colorArray[visibleCount * 3 + 1] = 0.69;
              colorArray[visibleCount * 3 + 2] = 0.94;
            }

            visibleCount++;
          } else {
            console.warn("Max cube limit reached in InstancedMesh.");
            x = y = z = gridSize; // break all loops
          }
        }
      }
    }
  }

  instancedCubeMesh.count = visibleCount;
  instancedCubeMesh.instanceMatrix.needsUpdate = true;
  instancedCubeMesh.instanceColor.needsUpdate = true;

  console.timeEnd("UpdateCubesLogic");

  // Adjust camera to look at the center of the grid
  if (visibleCount > 0) {
    const center = new THREE.Vector3(0, 0, 0);
    camera.lookAt(center);
    if (camera.position.equals(new THREE.Vector3(15, 15, 15)) && gridSize > 0) {
      camera.position.set(gridSize * 1.2, gridSize * 1.2, gridSize * 1.2);
    }
  }
  controls.target.set(0, 0, 0);
}

// Optional: Function to set default cube color
export function setCubeColor(hexColor) {
  if (cubeMaterial) {
    cubeMaterial.color.setHex(hexColor);
  }
}
