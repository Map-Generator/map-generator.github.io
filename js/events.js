// Initialize map object
const mapObject = new MapObject(canvas, parseInt(mapWidthInput.value), parseInt(mapHeightInput.value));

// Ensure mode toggle works
toggleButton.addEventListener("click", () => {
    mapObject.cycleRenderMode();
});

// Ensure new map button regenerates properly
newMapButton.addEventListener("click", () => {
    mapObject.generateNewPoints();
    mapObject.render();
});

// Toggle terrain menu
toggleMenuButton.addEventListener("click", () => {
    terrainMenu.style.display = terrainMenu.style.display === "none" ? "block" : "none";
});

// Toggle terrain checkboxes
toggleSnowCheckbox.addEventListener("change", () => {
    mapObject.setTerrainType('snow', toggleSnowCheckbox.checked);
});

toggleRockyCheckbox.addEventListener("change", () => {
    mapObject.setTerrainType('rocky', toggleRockyCheckbox.checked);
});

toggleGrasslandCheckbox.addEventListener("change", () => {
    mapObject.setTerrainType('grassland', toggleGrasslandCheckbox.checked);
});

toggleDryPlainsCheckbox.addEventListener("change", () => {
    mapObject.setTerrainType('dryPlains', toggleDryPlainsCheckbox.checked);
});

toggleWaterCheckbox.addEventListener("change", () => {
    mapObject.setTerrainType('water', toggleWaterCheckbox.checked);
});

// Handle map resizing
resizeMapButton.addEventListener("click", () => {
    mapObject.setSize(parseInt(mapWidthInput.value), parseInt(mapHeightInput.value));
});

// Pan and zoom state
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let minZoom = 0.5;
let maxZoom = 4;

// Add zoom controls to the page
const zoomControls = document.createElement('div');
zoomControls.className = 'zoom-controls';
zoomControls.innerHTML = `
    <button id="zoomIn" title="Zoom in">+</button>
    <button id="zoomOut" title="Zoom out">−</button>
    <button id="resetView" title="Reset view">⟲</button>
`;
document.body.appendChild(zoomControls);

// Mouse wheel zoom
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate point before zoom
    const pointXBeforeZoom = (mouseX - mapObject.panX) / mapObject.zoomLevel;
    const pointYBeforeZoom = (mouseY - mapObject.panY) / mapObject.zoomLevel;

    // Adjust zoom level
    const zoomDelta = -e.deltaY * 0.001;
    const newZoom = Math.max(minZoom, Math.min(maxZoom, mapObject.zoomLevel * (1 + zoomDelta)));
    mapObject.setZoom(newZoom);

    // Adjust pan to keep the point under mouse cursor
    mapObject.setPan(
        mouseX - pointXBeforeZoom * newZoom,
        mouseY - pointYBeforeZoom * newZoom
    );
});

// Mouse drag pan
canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    canvas.style.cursor = 'grabbing';
});

window.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const deltaX = e.clientX - lastMouseX;
        const deltaY = e.clientY - lastMouseY;
        
        mapObject.setPan(
            mapObject.panX + deltaX,
            mapObject.panY + deltaY
        );
        
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    }
});

window.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = 'grab';
});

// Zoom control buttons
document.getElementById('zoomIn').addEventListener('click', () => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const pointXBeforeZoom = (centerX - mapObject.panX) / mapObject.zoomLevel;
    const pointYBeforeZoom = (centerY - mapObject.panY) / mapObject.zoomLevel;
    
    const newZoom = Math.min(maxZoom, mapObject.zoomLevel * 1.2);
    mapObject.setZoom(newZoom);
    
    mapObject.setPan(
        centerX - pointXBeforeZoom * newZoom,
        centerY - pointYBeforeZoom * newZoom
    );
});

document.getElementById('zoomOut').addEventListener('click', () => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const pointXBeforeZoom = (centerX - mapObject.panX) / mapObject.zoomLevel;
    const pointYBeforeZoom = (centerY - mapObject.panY) / mapObject.zoomLevel;
    
    const newZoom = Math.max(minZoom, mapObject.zoomLevel / 1.2);
    mapObject.setZoom(newZoom);
    
    mapObject.setPan(
        centerX - pointXBeforeZoom * newZoom,
        centerY - pointYBeforeZoom * newZoom
    );
});

document.getElementById('resetView').addEventListener('click', () => {
    mapObject.setPan(0, 0);
    mapObject.setZoom(1);
});

// Touch support
canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        isDragging = true;
        lastMouseX = e.touches[0].clientX;
        lastMouseY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
        isDragging = false;
        lastTouchDistance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
    }
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (isDragging && e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - lastMouseX;
        const deltaY = e.touches[0].clientY - lastMouseY;
        
        mapObject.setPan(
            mapObject.panX + deltaX,
            mapObject.panY + deltaY
        );
        
        lastMouseX = e.touches[0].clientX;
        lastMouseY = e.touches[0].clientY;
    } else if (e.touches.length === 2) {
        const distance = Math.hypot(
            e.touches[0].clientX - e.touches[1].clientX,
            e.touches[0].clientY - e.touches[1].clientY
        );
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        if (lastTouchDistance > 0) {
            const rect = canvas.getBoundingClientRect();
            const pointXBeforeZoom = (centerX - rect.left - mapObject.panX) / mapObject.zoomLevel;
            const pointYBeforeZoom = (centerY - rect.top - mapObject.panY) / mapObject.zoomLevel;
            
            const scale = distance / lastTouchDistance;
            const newZoom = Math.max(minZoom, Math.min(maxZoom, mapObject.zoomLevel * scale));
            mapObject.setZoom(newZoom);
            
            mapObject.setPan(
                centerX - rect.left - pointXBeforeZoom * newZoom,
                centerY - rect.top - pointYBeforeZoom * newZoom
            );
        }
        lastTouchDistance = distance;
    }
});

canvas.addEventListener('touchend', () => {
    isDragging = false;
    lastTouchDistance = 0;
});
