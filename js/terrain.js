class MapObject {
    constructor(canvas, width, height) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.width = width;
        this.height = height;
        this.points = [];
        this.colors = [];
        this.cities = [];
        this.villages = [];
        this.panX = 0;
        this.panY = 0;
        this.zoomLevel = 1;
        this.renderMode = 'pixel'; // 'pixel', 'voronoi', or 'smooth'
        this.terrainTypes = {
            snow: true,
            rocky: true,
            grassland: true,
            dryPlains: true,
            water: true
        };
        
        // Create off-screen canvas for caching
        this.mapCache = document.createElement('canvas');
        this.mapCache.width = width;
        this.mapCache.height = height;
        this.mapCacheCtx = this.mapCache.getContext('2d');
        
        // Generate initial map data
        this.generateNewPoints();
    }

    generateNewPoints() {
        const seed = Math.random();
        const simplex = new SimplexNoise(seed);

        // Add padding to the points generation
        const padding = Math.max(this.width, this.height) * 0.2;
        const paddedWidth = this.width + padding * 2;
        const paddedHeight = this.height + padding * 2;

        this.points = Array.from({ length: 3000 }, () => [
            (Math.random() * paddedWidth) - padding,
            (Math.random() * paddedHeight) - padding
        ]);

        this.colors = this.points.map(([x, y]) => {
            // Calculate normalized coordinates from the center
            let nx = (x + padding) / paddedWidth - 0.5;
            let ny = (y + padding) / paddedHeight - 0.5;
            let distance = Math.sqrt(nx * nx + ny * ny) / Math.sqrt(0.5);
            
            // Stronger edge fade
            let edgeFade = Math.pow(1 - Math.min(1, distance * 1.2), 1.5);
            
            // Use multiple noise layers for more natural terrain
            let elevation = 0;
            elevation += (simplex.noise2D(x / 200, y / 200) + 1) / 2 * 0.5;
            elevation += (simplex.noise2D(x / 100, y / 100) + 1) / 2 * 0.3;
            elevation += (simplex.noise2D(x / 50, y / 50) + 1) / 2 * 0.2;
            
            elevation *= edgeFade;

            // Use exact same water color as endless water
            if (elevation > 0.7) return "#FFFFFF";
            if (elevation > 0.55) return "#A9A9A9";
            if (elevation > 0.35) return "#4CAF50";
            if (elevation > 0.25) return "#8B4513";
            return "#1E90FF";  // Consistent water color
        });

        // Function to check if a point is on valid terrain (grass or dry plains)
        const isValidSettlementLocation = (x, y) => {
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
            const closestIndex = d3.Delaunay.from(this.points).find(x, y);
            const terrainColor = this.colors[closestIndex];
            return terrainColor === "#4CAF50" || terrainColor === "#8B4513"; // Grass or dry plains
        };

        // Generate very few cities on valid terrain
        this.cities = [];
        let attempts = 0;
        while (this.cities.length < 3 && attempts < 1000) { // Reduced from 5 to 3 cities
            const x = Math.random() * this.width;
            const y = Math.random() * this.height;
            if (isValidSettlementLocation(x, y)) {
                this.cities.push([x, y]);
            }
            attempts++;
        }

        // Generate fewer villages on valid terrain
        this.villages = [];
        attempts = 0;
        while (this.villages.length < 4 && attempts < 1000) { // Reduced from 8 to 4 villages
            const x = Math.random() * this.width;
            const y = Math.random() * this.height;
            if (isValidSettlementLocation(x, y)) {
                this.villages.push([x, y]);
            }
            attempts++;
        }

        this.generateMapCache();
    }

    generateMapCache() {
        // Clear the cache canvas
        this.mapCacheCtx.clearRect(0, 0, this.width, this.height);

        switch (this.renderMode) {
            case 'pixel':
                this.renderPixelToCache();
                break;
            case 'voronoi':
                this.renderVoronoiToCache();
                break;
            case 'smooth':
                this.renderSmoothToCache();
                break;
        }
    }

    renderVoronoiToCache() {
        const padding = Math.max(this.width, this.height) * 0.2;
        const delaunay = d3.Delaunay.from(this.points);
        const voronoi = delaunay.voronoi([-padding, -padding, this.width + padding, this.height + padding]);

        // Draw base water
        this.mapCacheCtx.fillStyle = "#1E90FF";
        this.mapCacheCtx.fillRect(0, 0, this.width, this.height);

        // Draw terrain cells
        for (let i = 0; i < this.points.length; i++) {
            const [x, y] = this.points[i];
            // Only draw if the point could affect the visible area
            if (x >= -padding && x <= this.width + padding && 
                y >= -padding && y <= this.height + padding) {
                if (this.shouldRenderTerrain(this.colors[i])) {
                    this.mapCacheCtx.beginPath();
                    voronoi.renderCell(i, this.mapCacheCtx);
                    this.mapCacheCtx.fillStyle = this.colors[i];
                    this.mapCacheCtx.fill();
                } else {
                    this.mapCacheCtx.beginPath();
                    voronoi.renderCell(i, this.mapCacheCtx);
                    this.mapCacheCtx.fillStyle = this.getRandomSelectedColor();
                    this.mapCacheCtx.fill();
                }
            }
        }
    }

    renderPixelToCache() {
        const gridSize = 2;
        const padding = Math.max(this.width, this.height) * 0.2;
        const delaunay = d3.Delaunay.from(this.points);
        
        // Disable image smoothing for crisp pixels
        this.mapCacheCtx.imageSmoothingEnabled = false;

        // Draw base water
        this.mapCacheCtx.fillStyle = "#1E90FF";
        this.mapCacheCtx.fillRect(0, 0, this.width, this.height);

        // Draw terrain pixels
        for (let x = -padding; x < this.width + padding; x += gridSize) {
            for (let y = -padding; y < this.height + padding; y += gridSize) {
                if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
                    let closestIndex = delaunay.find(x + gridSize / 2, y + gridSize / 2);
                    if (this.shouldRenderTerrain(this.colors[closestIndex])) {
                        this.mapCacheCtx.fillStyle = this.colors[closestIndex];
                        this.mapCacheCtx.fillRect(x, y, gridSize, gridSize);
                    } else {
                        this.mapCacheCtx.fillStyle = this.getRandomSelectedColor();
                        this.mapCacheCtx.fillRect(x, y, gridSize, gridSize);
                    }
                }
            }
        }
    }

    renderSmoothToCache() {
        const ctx = this.mapCacheCtx;
        const resolution = 8;
        const padding = this.width * 0.1;
        const totalWidth = this.width + (padding * 2);
        const totalHeight = this.height + (padding * 2);
        const gridSize = totalWidth / resolution;
        
        // Create a heightmap using simplex noise
        const heightMap = new Array(resolution + 2).fill(0)
            .map(() => new Array(resolution + 2).fill(0));
        
        const seed = Math.random();
        const simplex = new SimplexNoise(seed);
        
        // Generate smooth height values with padding
        for (let x = 0; x <= resolution + 1; x++) {
            for (let y = 0; y <= resolution + 1; y++) {
                // Convert to normalized coordinates (-0.5 to 0.5)
                const nx = (x * gridSize - padding) / this.width - 0.5;
                const ny = (y * gridSize - padding) / this.height - 0.5;
                const distance = Math.sqrt(nx * nx + ny * ny) / Math.sqrt(0.5);
                
                // Stronger edge fade for smoother water transition
                const edgeFade = Math.max(0, 1 - (distance * 1.2));
                
                // Use multiple octaves of noise for more natural terrain
                let elevation = 0;
                elevation += (simplex.noise2D(x / 3, y / 3) + 1) / 2 * 0.5;
                elevation += (simplex.noise2D(x * 1.5, y * 1.5) + 1) / 2 * 0.25;
                elevation += (simplex.noise2D(x * 3, y * 3) + 1) / 2 * 0.125;
                
                // Apply edge fade
                heightMap[x][y] = elevation * edgeFade;
            }
        }

        // Create gradient for each terrain type except water
        const terrainGradients = {
            dryPlains: ctx.createLinearGradient(0, 0, totalWidth, totalHeight),
            grassland: ctx.createLinearGradient(0, 0, totalWidth, totalHeight),
            rocky: ctx.createLinearGradient(0, 0, totalWidth, totalHeight),
            snow: ctx.createLinearGradient(0, 0, totalWidth, totalHeight)
        };

        // Set up gradient colors (excluding water)
        terrainGradients.dryPlains.addColorStop(0, '#8B4513');
        terrainGradients.dryPlains.addColorStop(0.5, '#A0522D');
        terrainGradients.dryPlains.addColorStop(1, '#8B4513');
        
        terrainGradients.grassland.addColorStop(0, '#4CAF50');
        terrainGradients.grassland.addColorStop(0.5, '#45A049');
        terrainGradients.grassland.addColorStop(1, '#4CAF50');
        
        terrainGradients.rocky.addColorStop(0, '#A9A9A9');
        terrainGradients.rocky.addColorStop(0.5, '#808080');
        terrainGradients.rocky.addColorStop(1, '#A9A9A9');
        
        terrainGradients.snow.addColorStop(0, '#FFFFFF');
        terrainGradients.snow.addColorStop(0.5, '#F0F0F0');
        terrainGradients.snow.addColorStop(1, '#FFFFFF');

        // Clear with water background using the same color as endless water
        ctx.fillStyle = '#1E90FF';
        ctx.fillRect(0, 0, this.width, this.height);

        // Draw smooth terrain with padding
        ctx.save();
        ctx.translate(-padding, -padding);

        for (let x = 0; x < resolution + 1; x++) {
            for (let y = 0; y < resolution + 1; y++) {
                const elevation = heightMap[x][y];
                
                ctx.beginPath();
                ctx.moveTo(x * gridSize, y * gridSize);
                
                // Create smooth curves between grid points using bezier curves
                const nextX = (x + 1) * gridSize;
                const nextY = (y + 1) * gridSize;
                const controlX = (x + 0.5) * gridSize;
                const controlY = (y + 0.5) * gridSize;
                
                ctx.bezierCurveTo(
                    controlX, y * gridSize,
                    nextX, controlY,
                    nextX, nextY
                );
                
                // For water, use solid color instead of gradient
                if (elevation <= 0.25) {
                    // Skip drawing water to keep the base water color
                    continue;
                } else if (elevation > 0.7) {
                    ctx.fillStyle = this.terrainTypes.snow ? terrainGradients.snow : this.getRandomSelectedGradient(terrainGradients);
                } else if (elevation > 0.55) {
                    ctx.fillStyle = this.terrainTypes.rocky ? terrainGradients.rocky : this.getRandomSelectedGradient(terrainGradients);
                } else if (elevation > 0.35) {
                    ctx.fillStyle = this.terrainTypes.grassland ? terrainGradients.grassland : this.getRandomSelectedGradient(terrainGradients);
                } else if (elevation > 0.25) {
                    ctx.fillStyle = this.terrainTypes.dryPlains ? terrainGradients.dryPlains : this.getRandomSelectedGradient(terrainGradients);
                }
                
                ctx.fill();
            }
        }
        
        ctx.restore();
    }

    getRandomSelectedGradient(gradients) {
        const selectedGradients = [];
        if (this.terrainTypes.snow) selectedGradients.push(gradients.snow);
        if (this.terrainTypes.rocky) selectedGradients.push(gradients.rocky);
        if (this.terrainTypes.grassland) selectedGradients.push(gradients.grassland);
        if (this.terrainTypes.dryPlains) selectedGradients.push(gradients.dryPlains);
        // Water is handled separately now
        return selectedGradients[Math.floor(Math.random() * selectedGradients.length)];
    }

    shouldRenderTerrain(color) {
        switch (color) {
            case "#FFFFFF": return this.terrainTypes.snow;
            case "#A9A9A9": return this.terrainTypes.rocky;
            case "#4CAF50": return this.terrainTypes.grassland;
            case "#8B4513": return this.terrainTypes.dryPlains;
            case "#1E90FF": return this.terrainTypes.water;
            default: return true;
        }
    }

    getRandomSelectedColor() {
        const selectedColors = [];
        if (this.terrainTypes.snow) selectedColors.push("#FFFFFF");
        if (this.terrainTypes.rocky) selectedColors.push("#A9A9A9");
        if (this.terrainTypes.grassland) selectedColors.push("#4CAF50");
        if (this.terrainTypes.dryPlains) selectedColors.push("#8B4513");
        if (this.terrainTypes.water) selectedColors.push("#1E90FF");
        return selectedColors[Math.floor(Math.random() * selectedColors.length)];
    }

    renderVoronoi() {
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw endless water background
        const viewportWidth = this.width / this.zoomLevel;
        const viewportHeight = this.height / this.zoomLevel;
        const offsetX = -this.panX / this.zoomLevel;
        const offsetY = -this.panY / this.zoomLevel;
        
        this.ctx.fillStyle = "#1E90FF";
        this.ctx.fillRect(offsetX - viewportWidth, offsetY - viewportHeight, 
                         viewportWidth * 3, viewportHeight * 3);
        
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoomLevel, this.zoomLevel);

        const delaunay = d3.Delaunay.from(this.points);
        const voronoi = delaunay.voronoi([0, 0, this.width, this.height]);

        for (let i = 0; i < this.points.length; i++) {
            if (this.shouldRenderTerrain(this.colors[i])) {
                this.ctx.beginPath();
                voronoi.renderCell(i, this.ctx);
                this.ctx.fillStyle = this.colors[i];
                this.ctx.fill();
            } else {
                this.ctx.beginPath();
                voronoi.renderCell(i, this.ctx);
                this.ctx.fillStyle = this.getRandomSelectedColor();
                this.ctx.fill();
            }
        }

        this.renderCitiesAndVillages();
        this.renderPaths();
        this.ctx.restore();
    }

    renderPixel() {
        const gridSize = 2;
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw endless water background
        const viewportWidth = this.width / this.zoomLevel;
        const viewportHeight = this.height / this.zoomLevel;
        const offsetX = -this.panX / this.zoomLevel;
        const offsetY = -this.panY / this.zoomLevel;
        
        this.ctx.fillStyle = "#1E90FF";
        this.ctx.fillRect(offsetX - viewportWidth, offsetY - viewportHeight, 
                         viewportWidth * 3, viewportHeight * 3);
        
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoomLevel, this.zoomLevel);

        const delaunay = d3.Delaunay.from(this.points);

        // Disable image smoothing for crisp pixels
        this.ctx.imageSmoothingEnabled = false;

        for (let x = 0; x < this.width; x += gridSize) {
            for (let y = 0; y < this.height; y += gridSize) {
                let closestIndex = delaunay.find(x + gridSize / 2, y + gridSize / 2);
                if (this.shouldRenderTerrain(this.colors[closestIndex])) {
                    this.ctx.fillStyle = this.colors[closestIndex];
                    this.ctx.fillRect(x, y, gridSize, gridSize);
                } else {
                    this.ctx.fillStyle = this.getRandomSelectedColor();
                    this.ctx.fillRect(x, y, gridSize, gridSize);
                }
            }
        }

        this.renderCitiesAndVillages();
        this.renderPaths();
        this.ctx.restore();
    }

    renderCitiesAndVillages() {
        const gridSize = 2; // Match the pixel size used in renderPixelToCache

        // Draw settlement areas
        this.cities.forEach(([x, y], index) => {
            if (x >= 0 && x <= this.width && y >= 0 && y <= this.height) {
                // Draw city area (larger settlement)
                const citySize = 16; // 8x8 pixels
                const startX = Math.floor(x - citySize/2);
                const startY = Math.floor(y - citySize/2);

                // Draw darker border
                this.ctx.fillStyle = "#8B0000"; // Dark red
                for(let px = startX; px < startX + citySize; px += gridSize) {
                    for(let py = startY; py < startY + citySize; py += gridSize) {
                        if(px === startX || px >= startX + citySize - gridSize || 
                           py === startY || py >= startY + citySize - gridSize) {
                            this.ctx.fillRect(px, py, gridSize, gridSize);
                        }
                    }
                }

                // Draw inner area
                this.ctx.fillStyle = "#CD5C5C"; // Indian Red
                for(let px = startX + gridSize; px < startX + citySize - gridSize; px += gridSize) {
                    for(let py = startY + gridSize; py < startY + citySize - gridSize; py += gridSize) {
                        this.ctx.fillRect(px, py, gridSize, gridSize);
                    }
                }

                // Draw label with background
                this.ctx.font = "bold 12px Arial";
                const text = "City " + (index + 1);
                const textWidth = this.ctx.measureText(text).width;
                
                this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
                this.ctx.fillRect(x - textWidth/2 - 4, y - 24, textWidth + 8, 16);
                
                this.ctx.fillStyle = "#8B0000";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(text, x, y - 16);
            }
        });

        this.villages.forEach(([x, y], index) => {
            if (x >= 0 && x <= this.width && y >= 0 && y <= this.height) {
                // Draw village area (smaller settlement)
                const villageSize = 10; // 5x5 pixels
                const startX = Math.floor(x - villageSize/2);
                const startY = Math.floor(y - villageSize/2);

                // Draw darker border
                this.ctx.fillStyle = "#00008B"; // Dark blue
                for(let px = startX; px < startX + villageSize; px += gridSize) {
                    for(let py = startY; py < startY + villageSize; py += gridSize) {
                        if(px === startX || px >= startX + villageSize - gridSize || 
                           py === startY || py >= startY + villageSize - gridSize) {
                            this.ctx.fillRect(px, py, gridSize, gridSize);
                        }
                    }
                }

                // Draw inner area
                this.ctx.fillStyle = "#4169E1"; // Royal Blue
                for(let px = startX + gridSize; px < startX + villageSize - gridSize; px += gridSize) {
                    for(let py = startY + gridSize; py < startY + villageSize - gridSize; py += gridSize) {
                        this.ctx.fillRect(px, py, gridSize, gridSize);
                    }
                }

                // Draw label with background
                this.ctx.font = "bold 12px Arial";
                const text = "Village " + (index + 1);
                const textWidth = this.ctx.measureText(text).width;
                
                this.ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
                this.ctx.fillRect(x - textWidth/2 - 4, y - 24, textWidth + 8, 16);
                
                this.ctx.fillStyle = "#00008B";
                this.ctx.textAlign = "center";
                this.ctx.textBaseline = "middle";
                this.ctx.fillText(text, x, y - 16);
            }
        });
    }

    renderPaths() {
        // Draw paths between settlements
        this.ctx.strokeStyle = "#8B4513";
        this.ctx.lineWidth = 2;
        const gridSize = 2;

        // Function to draw pixelated path
        const drawPixelatedPath = (x1, y1, x2, y2) => {
            const dx = Math.abs(x2 - x1);
            const dy = Math.abs(y2 - y1);
            const sx = x1 < x2 ? gridSize : -gridSize;
            const sy = y1 < y2 ? gridSize : -gridSize;
            let err = dx - dy;
            
            let x = x1;
            let y = y1;

            while (true) {
                this.ctx.fillRect(x, y, gridSize, gridSize);
                
                if (Math.abs(x - x2) < gridSize && Math.abs(y - y2) < gridSize) break;
                
                const e2 = 2 * err;
                if (e2 > -dy) {
                    err -= dy;
                    x += sx;
                }
                if (e2 < dx) {
                    err += dx;
                    y += sy;
                }
            }
        };

        // Draw paths between cities
        this.ctx.fillStyle = "#8B4513";
        for (let i = 0; i < this.cities.length - 1; i++) {
            const [x1, y1] = this.cities[i];
            const [x2, y2] = this.cities[i + 1];
            drawPixelatedPath(x1, y1, x2, y2);
        }

        // Draw paths between villages (slightly thinner)
        this.ctx.fillStyle = "#A0522D";
        for (let i = 0; i < this.villages.length - 1; i++) {
            const [x1, y1] = this.villages[i];
            const [x2, y2] = this.villages[i + 1];
            drawPixelatedPath(x1, y1, x2, y2);
        }
    }

    render() {
        this.ctx.save();
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Draw endless water background
        const viewportWidth = this.width / this.zoomLevel;
        const viewportHeight = this.height / this.zoomLevel;
        const offsetX = -this.panX / this.zoomLevel;
        const offsetY = -this.panY / this.zoomLevel;
        
        this.ctx.fillStyle = "#1E90FF";
        this.ctx.fillRect(offsetX - viewportWidth, offsetY - viewportHeight, 
                         viewportWidth * 3, viewportHeight * 3);
        
        // Draw the cached map
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(this.mapCache, 0, 0);

        // Draw cities, villages and paths on top
        this.renderCitiesAndVillages();
        this.renderPaths();
        this.ctx.restore();
    }

    setSize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
        this.mapCache.width = width;
        this.mapCache.height = height;
        this.generateNewPoints();
    }

    setPan(x, y) {
        this.panX = x;
        this.panY = y;
        this.render();
    }

    setZoom(level) {
        this.zoomLevel = level;
        this.render();
    }

    togglePixelMode() {
        this.isPixelMode = !this.isPixelMode;
        this.generateMapCache();
        this.render();
    }

    setTerrainType(type, enabled) {
        this.terrainTypes[type] = enabled;
        this.generateMapCache();
        this.render();
    }
}