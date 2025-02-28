const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
const toggleButton = document.getElementById("toggleMode");
const newMapButton = document.getElementById("newMap");
const regenerateMapButton = document.getElementById("regenerateMap");
const ariaCities = document.getElementById("ariaCities");

let isPixelMode = true;
let points = [];
let colors = [];
let cities = [];

canvas.width = 800;
canvas.height = 600;

// Ensure D3.js is loaded
if (typeof d3 === "undefined") {
    alert("D3.js is required for Voronoi generation. Please include d3-delaunay.");
    throw new Error("D3.js is missing.");
}

function generateVoronoiMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const delaunay = d3.Delaunay.from(points);
    const voronoi = delaunay.voronoi([0, 0, canvas.width, canvas.height]);

    for (let i = 0; i < points.length; i++) {
        ctx.beginPath();
        voronoi.renderCell(i, ctx);
        ctx.fillStyle = colors[i]; // Ensure colors are applied
        ctx.fill();
        ctx.strokeStyle = "black";
        ctx.stroke();
    }

    generateCities();
}

function generatePixelMap() {
    const gridSize = 10;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const delaunay = d3.Delaunay.from(points);

    for (let x = 0; x < canvas.width; x += gridSize) {
        for (let y = 0; y < canvas.height; y += gridSize) {
            let closestIndex = delaunay.find(x + gridSize / 2, y + gridSize / 2);
            ctx.fillStyle = colors[closestIndex]; // Ensure colors are applied
            ctx.fillRect(x, y, gridSize, gridSize);
        }
    }

    generateCities();
}

function generateCities() {
    ctx.fillStyle = "red";
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ariaCities.innerHTML = ""; // Clear previous city information

    cities.forEach(([x, y], index) => {
        if (x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height) {
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillText("City " + (index + 1), x, y - 10);

            // Add city information to the hidden element
            const cityInfo = document.createElement("div");
            cityInfo.textContent = `City ${index + 1}: (${x.toFixed(2)}, ${y.toFixed(2)})`;
            ariaCities.appendChild(cityInfo);
        }
    });
}

function generateNewPoints() {
    points = Array.from({ length: 2000 }, () => [Math.random() * canvas.width, Math.random() * canvas.height]);

    // Assign terrain types using elevation simulation
    colors = points.map(([x, y]) => {
        let elevation = Math.random(); // Simulated elevation value (0 to 1)

        if (elevation > 0.8) return "#FFFFFF"; // Snowy mountains
        if (elevation > 0.6) return "#A9A9A9"; // Rocky terrain
        if (elevation > 0.4) return "#4CAF50"; // Grassland
        if (elevation > 0.2) return "#8B4513"; // Dry plains
        return "#1E90FF"; // Water
    });

    cities = Array.from({ length: 10 }, () => [
        Math.random() * canvas.width,
        Math.random() * canvas.height
    ]);
}

// Ensure mode toggle works
toggleButton.addEventListener("click", () => {
    isPixelMode = !isPixelMode;
    if (isPixelMode) {
        generatePixelMap();
    } else {
        generateVoronoiMap();
    }
});

// Ensure new map button regenerates properly
newMapButton.addEventListener("click", () => {
    generateNewPoints();
    if (isPixelMode) {
        generatePixelMap();
    } else {
        generateVoronoiMap();
    }
});

// Ensure regenerate button works
regenerateMapButton.addEventListener("click", () => {
    if (isPixelMode) {
        generatePixelMap();
    } else {
        generateVoronoiMap();
    }
});

// Default map generation
generateNewPoints();
generatePixelMap();
