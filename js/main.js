const canvas = document.getElementById("mapCanvas");
if (!canvas) {
    console.error("Could not find canvas element!");
}
const ctx = canvas.getContext("2d");
if (!ctx) {
    console.error("Could not get canvas context!");
}

// Check if required libraries are loaded
if (typeof d3 === 'undefined') {
    console.error("D3 library is not loaded!");
}
if (typeof SimplexNoise === 'undefined') {
    console.error("SimplexNoise library is not loaded!");
}

const toggleButton = document.getElementById("toggleMode");
const newMapButton = document.getElementById("newMap");
const toggleMenuButton = document.getElementById("toggleMenu");
const toggleSnowCheckbox = document.getElementById("toggleSnow");
const toggleRockyCheckbox = document.getElementById("toggleRocky");
const toggleGrasslandCheckbox = document.getElementById("toggleGrassland");
const toggleDryPlainsCheckbox = document.getElementById("toggleDryPlains");
const toggleWaterCheckbox = document.getElementById("toggleWater");
const ariaCities = document.getElementById("ariaCities");
const terrainMenu = document.getElementById("terrainMenu");
const mapWidthInput = document.getElementById("mapWidth");
const mapHeightInput = document.getElementById("mapHeight");
const resizeMapButton = document.getElementById("resizeMap");

// Verify all UI elements are found
[
    {elem: toggleButton, name: "toggleMode"},
    {elem: newMapButton, name: "newMap"},
    {elem: toggleMenuButton, name: "toggleMenu"},
    {elem: toggleSnowCheckbox, name: "toggleSnow"},
    {elem: toggleRockyCheckbox, name: "toggleRocky"},
    {elem: toggleGrasslandCheckbox, name: "toggleGrassland"},
    {elem: toggleDryPlainsCheckbox, name: "toggleDryPlains"},
    {elem: toggleWaterCheckbox, name: "toggleWater"},
    {elem: ariaCities, name: "ariaCities"},
    {elem: terrainMenu, name: "terrainMenu"},
    {elem: mapWidthInput, name: "mapWidth"},
    {elem: mapHeightInput, name: "mapHeight"},
    {elem: resizeMapButton, name: "resizeMap"}
].forEach(({elem, name}) => {
    if (!elem) {
        console.error(`Could not find element with id: ${name}`);
    }
});

let isPixelMode = true;
let points = [];
let colors = [];
let cities = [];
let villages = [];

// Add pan and zoom variables
let panX = 0;
let panY = 0;
let zoomLevel = 1;

let terrainTypes = {
    snow: true,
    rocky: true,
    grassland: true,
    dryPlains: true,
    water: true
};

function setCanvasSize() {
    try {
        const width = parseInt(mapWidthInput.value);
        const height = parseInt(mapHeightInput.value);
        if (isNaN(width) || isNaN(height)) {
            throw new Error("Invalid width or height values");
        }
        canvas.width = width;
        canvas.height = height;
        console.log(`Canvas size set to ${width}x${height}`);
    } catch (error) {
        console.error("Error setting canvas size:", error);
    }
}

// Initialize Simplex noise with error handling
let simplex;
try {
    simplex = new SimplexNoise();
    console.log("SimplexNoise initialized successfully");
} catch (error) {
    console.error("Error initializing SimplexNoise:", error);
}

// Set initial canvas size
setCanvasSize();

// Default map generation with error handling
try {
    console.log("Starting point generation...");
    generateNewPoints();
    console.log(`Generated ${points.length} points`);
    console.log("Starting pixel map generation...");
    generatePixelMap();
    console.log("Map generation complete");
} catch (error) {
    console.error("Error during initial map generation:", error);
}