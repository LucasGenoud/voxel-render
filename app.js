import { init as initRenderer, updateCubes } from "./renderer.js";

// DOM Elements
const codeEditor = document.getElementById("code-editor");
const runButton = document.getElementById("run-button");
const gridSizeInput = document.getElementById("grid-size");
const errorMessageDiv = document.getElementById("error-message");
const renderCanvas = document.getElementById("render-canvas");

// App State
let userVisibilityFunction = null;
let currentGridSize = 20;
let animationFrameId = null;
let currentTime = 0;

const AUTO_RELOAD_DEBOUNCE_MS = 750;

function getEditorCode() {
  return codeEditor.value;
}

function displayError(message) {
  errorMessageDiv.textContent = message;
  errorMessageDiv.style.display = message ? "block" : "none";
}

// Debounce utility
function debounce(func, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

/**
 * Compiles the user-provided JavaScript code into a function.
 * This function determines the visibility and color of each cube.
 *
 * @param {string} code The JavaScript code from the editor.
 * @returns {Function | null} A function that takes (x, y, z, size, time)
 * and returns one of the following:
 * - `false`, `null`, `undefined`: The cube is not visible.
 * - `true`: The cube is visible with the default color.
 * - A hex number (e.g., 0xff0000): The cube is visible with the specified color.
 */
function compileUserFunction(code) {
  displayError("");
  try {
    if (
      code.includes("document.") ||
      code.includes("window.") ||
      code.includes("eval(")
    ) {
      throw new Error(
        "Potentially unsafe code detected. Avoid direct DOM/BOM access."
      );
    }
    const func = new Function(
      "x",
      "y",
      "z",
      "size",
      "time",
      `
            "use strict";
            try {
                ${code}
                return false; // Default return if user code doesn't explicitly return
            } catch (e) {
                throw e; // Re-throw to be caught by the outer try-catch
            }
        `
    );
    return func;
  } catch (e) {
    const errorMessage = e.stack
      ? e.stack.split("\n").slice(0, 2).join("\n")
      : e.message;
    displayError(
      `Error: ${e.name}: ${errorMessage.replace("Function code: ", "")}`
    );
    return null;
  }
}

// Renders the current state based on global variables
function renderCurrentState() {
  if (!userVisibilityFunction) {
    return;
  }

  const newGridSize = parseInt(gridSizeInput.value, 10);
  if (isNaN(newGridSize) || newGridSize < 1 || newGridSize > 50) {
    displayError("Grid size must be between 1 and 50.");
    return;
  }
  currentGridSize = newGridSize;

  updateCubes(userVisibilityFunction, currentGridSize, currentTime);
}

// Compiles code, updates function, and manages rendering/animation
function processCodeAndRender() {
  const userCode = getEditorCode();
  const newFunction = compileUserFunction(userCode);

  if (newFunction) {
    userVisibilityFunction = newFunction;
    currentTime = 0; // Reset time on every successful code change
    if (animationFrameId === null) {
      startAnimationLoop();
    }
    renderCurrentState(); // Render immediately
  } else {
    stopAnimationLoop();
  }
}

const debouncedProcessCodeAndRender = debounce(
  processCodeAndRender,
  AUTO_RELOAD_DEBOUNCE_MS
);

// Animation Loop
function animationLoop() {
  currentTime += 1 / 60; // Increment time (approx 60 FPS)
  renderCurrentState();
  animationFrameId = requestAnimationFrame(animationLoop);
}

function startAnimationLoop() {
  if (!userVisibilityFunction) {
    stopAnimationLoop();
    return;
  }
  if (animationFrameId === null) {
    animationFrameId = requestAnimationFrame(animationLoop);
  }
}

function stopAnimationLoop() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// Event Listeners
runButton.addEventListener("click", processCodeAndRender);

gridSizeInput.addEventListener("change", () => {
  if (userVisibilityFunction) {
    // Re-render with the new grid size
    processCodeAndRender();
  }
});

// Auto-reload on code change
codeEditor.addEventListener("input", debouncedProcessCodeAndRender);

// Initialization
function main() {
  initRenderer(renderCanvas);
  gridSizeInput.value = currentGridSize;

  // Set the initial code in the textarea
  codeEditor.value = `// Your function can return:
// - false: The cube is invisible.
// - true: The cube is visible with the default color.
// - A hex color (e.g., 0xff0000 for red): The cube is visible with this color.

// Example 1: A simple sphere
function sphere() {
  const radius = size / 2 - 1;
  const cX = size / 2;
  const cY = size / 2;
  const cZ = size / 2;
  const distSq = (x - cX) * (x - cX) + (y - cY) * (y - cY) + (z - cZ) * (z - cZ);
  if (distSq < radius * radius) {
    // Return a color based on position
    const r = Math.floor((x / size) * 255);
    const g = Math.floor((y / size) * 255);
    const b = Math.floor((z / size) * 255);
    return (r << 16) | (g << 8) | b;
  }
  return false;
}

// Example 2: A colorful, animated wave
function wave() {
  const waveHeight = size / 2 +
    Math.sin(x / (size / 8) + time) * (size / 6) +
    Math.cos(z / (size / 8) + time) * (size / 6);

  if (y < waveHeight) {
    // Color the wave based on its height
    const green = y / waveHeight;
    const blue = 1 - green;
    return (Math.floor(green * 255) << 8) | Math.floor(blue * 255);
  }
  return false;
}

// Return the result of the function you want to see.
// Try switching to sphere()!
return wave();`;

  // Initial compilation and render of the default code
  processCodeAndRender();
}

main();
