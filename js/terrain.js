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
        this.cityNames = [];
        this.villageNames = [];
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
        
        // Name generation parts
        this.cityPrefixes = ["Elder", "Storm", "Iron", "High", "Dawn", "Dusk", "Moon", "Sun", "Star", "Dragon", "Crystal", "Silver", "Golden", "Shadow", "Frost"];
        this.citySuffixes = ["haven", "spire", "keep", "guard", "hold", "gate", "fall", "rise", "peak", "crown", "realm", "forge", "heart", "watch", "ward"];
        this.villagePrefixes = ["Green", "Red", "Blue", "Oak", "Pine", "Maple", "River", "Lake", "Hill", "Stone", "Wood", "Meadow", "Spring", "Summer", "Winter"];
        this.villageSuffixes = ["brook", "wood", "vale", "dale", "field", "stead", "ton", "ford", "cross", "bridge", "mill", "shore", "haven", "rest", "home"];
        
        // Create off-screen canvas for caching
        this.mapCache = document.createElement('canvas');
        this.mapCache.width = width;
        this.mapCache.height = height;
        this.mapCacheCtx = this.mapCache.getContext('2d');
        
        // Generate initial map data
        this.generateNewPoints();
    }

    generateRandomName(prefixes, suffixes, usedNames = []) {
        let name;
        let attempts = 0;
        const maxAttempts = 50;

        do {
            const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
            const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
            name = prefix + suffix;
            attempts++;
        } while (usedNames.includes(name) && attempts < maxAttempts);

        return name;
    }

    generateSettlementNames() {
        // Generate city names
        this.cityNames = [];
        for (let i = 0; i < this.cities.length; i++) {
            const name = this.generateRandomName(this.cityPrefixes, this.citySuffixes, this.cityNames);
            this.cityNames.push(name);
        }

        // Generate village names
        this.villageNames = [];
        for (let i = 0; i < this.villages.length; i++) {
            const name = this.generateRandomName(this.villagePrefixes, this.villageSuffixes, this.villageNames);
            this.villageNames.push(name);
        }
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
        const isValidSettlementLocation = (x, y, isCity = false) => {
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
            const delaunay = d3.Delaunay.from(this.points);
            
            // For cities, check a larger surrounding area
            const checkRadius = isCity ? 40 : 20;
            let validTiles = 0;
            let totalTiles = 0;
            let grassTiles = 0;
            let dryPlainsTiles = 0;
            
            // Check surrounding area in a grid pattern
            for (let dx = -checkRadius; dx <= checkRadius; dx += 5) {
                for (let dy = -checkRadius; dy <= checkRadius; dy += 5) {
                    const checkX = x + dx;
                    const checkY = y + dy;
                    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
                    
                    // Only count tiles within a circular area
                    if (distanceFromCenter <= checkRadius && 
                        checkX >= 0 && checkX < this.width && 
                        checkY >= 0 && checkY < this.height) {
                        totalTiles++;
                        const closestIndex = delaunay.find(checkX, checkY);
                        const terrainColor = this.colors[closestIndex];
                        
                        if (terrainColor === "#4CAF50") {
                            grassTiles++;
                            validTiles++;
                        } else if (terrainColor === "#8B4513") {
                            dryPlainsTiles++;
                            validTiles++;
                        }
                    }
                }
            }
            
            if (isCity) {
                // Cities need to be in mostly grassland areas (70% grass)
                return (grassTiles / totalTiles) >= 0.7 && totalTiles > 0;
            } else {
                // Villages can be in mixed terrain (50% valid terrain)
                return (validTiles / totalTiles) >= 0.5 && totalTiles > 0;
            }
        };

        // Function to find centers of large grassland areas
        const findGrasslandCenters = () => {
            const gridSize = 10;
            const grasslandScores = new Array(Math.ceil(this.width/gridSize))
                .fill(0)
                .map(() => new Array(Math.ceil(this.height/gridSize)).fill(0));
            
            // Calculate grassland density for each grid cell
            const delaunay = d3.Delaunay.from(this.points);
            for(let x = 0; x < this.width; x += gridSize) {
                for(let y = 0; y < this.height; y += gridSize) {
                    let grassCount = 0;
                    const checkRadius = 30;
                    
                    // Check surrounding area
                    for(let dx = -checkRadius; dx <= checkRadius; dx += 5) {
                        for(let dy = -checkRadius; dy <= checkRadius; dy += 5) {
                            const checkX = x + dx;
                            const checkY = y + dy;
                            const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
                            
                            if(distanceFromCenter <= checkRadius && 
                               checkX >= 0 && checkX < this.width && 
                               checkY >= 0 && checkY < this.height) {
                                const closestIndex = delaunay.find(checkX, checkY);
                                if(this.colors[closestIndex] === "#4CAF50") {
                                    grassCount++;
                                }
                            }
                        }
                    }
                    
                    grasslandScores[Math.floor(x/gridSize)][Math.floor(y/gridSize)] = grassCount;
                }
            }
            
            // Find local maxima in grassland scores
            const centers = [];
            const minScore = 100;
            
            for(let x = 1; x < grasslandScores.length - 1; x++) {
                for(let y = 1; y < grasslandScores[x].length - 1; y++) {
                    const score = grasslandScores[x][y];
                    if(score < minScore) continue;
                    
                    // Check if it's a local maximum
                    let isMax = true;
                    for(let dx = -1; dx <= 1; dx++) {
                        for(let dy = -1; dy <= 1; dy++) {
                            if(dx === 0 && dy === 0) continue;
                            if(grasslandScores[x + dx][y + dy] > score) {
                                isMax = false;
                                break;
                            }
                        }
                        if(!isMax) break;
                    }
                    
                    if(isMax) {
                        centers.push({
                            x: (x + 0.5) * gridSize,
                            y: (y + 0.5) * gridSize,
                            score: score
                        });
                    }
                }
            }
            
            // Sort centers by score and return the best ones
            return centers.sort((a, b) => b.score - a.score);
        };

        // Generate cities in the centers of grassland areas
        const grasslandCenters = findGrasslandCenters();
        this.cities = [];
        
        // Randomly decide how many cities to generate (1-3)
        const numCities = Math.floor(Math.random() * 3) + 1;
        
        // Take the top centers that are far enough apart
        const minCityDistance = 100;
        for(const center of grasslandCenters) {
            const isFarFromOtherCities = this.cities.every(([cx, cy]) => {
                const dx = center.x - cx;
                const dy = center.y - cy;
                return Math.sqrt(dx * dx + dy * dy) >= minCityDistance;
            });
            
            if(isFarFromOtherCities) {
                this.cities.push([center.x, center.y]);
                if(this.cities.length >= numCities) break;
            }
        }

        // Generate villages on valid terrain
        this.villages = [];
        let attempts = 0;
        // Randomly decide how many villages to generate (2-4)
        const numVillages = Math.floor(Math.random() * 3) + 2;
        
        while (this.villages.length < numVillages && attempts < 1000) {
            const x = Math.random() * this.width;
            const y = Math.random() * this.height;
            if (isValidSettlementLocation(x, y, false)) {
                // Check if the location is far enough from cities
                const minDistanceToCity = 60;
                const minDistanceToVillage = 40;
                
                const isFarFromCities = this.cities.every(([cx, cy]) => {
                    const dx = x - cx;
                    const dy = y - cy;
                    return Math.sqrt(dx * dx + dy * dy) >= minDistanceToCity;
                });
                
                const isFarFromVillages = this.villages.every(([vx, vy]) => {
                    const dx = x - vx;
                    const dy = y - vy;
                    return Math.sqrt(dx * dx + dy * dy) >= minDistanceToVillage;
                });
                
                if (isFarFromCities && isFarFromVillages) {
                    this.villages.push([x, y]);
                }
            }
            attempts++;
        }

        // Generate names for all settlements
        this.generateSettlementNames();

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
        
        // Draw settlements into the cache
        this.renderCitiesAndVillagesToCache();
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
        this.ctx.restore();
    }

    renderCitiesAndVillages() {
        const gridSize = 2;

        // Draw settlement areas
        this.cities.forEach(([x, y], index) => {
            if (x >= 0 && x <= this.width && y >= 0 && y <= this.height) {
                // Draw city area (smaller settlement)
                const citySize = 12; // Reduced from 16 to 12
                const startX = Math.floor(x - citySize/2);
                const startY = Math.floor(y - citySize/2);

                // Draw darker border
                this.ctx.fillStyle = "#8B0000";
                for(let px = startX; px < startX + citySize; px += gridSize) {
                    for(let py = startY; py < startY + citySize; py += gridSize) {
                        if(px === startX || px >= startX + citySize - gridSize || 
                           py === startY || py >= startY + citySize - gridSize) {
                            this.ctx.fillRect(px, py, gridSize, gridSize);
                        }
                    }
                }

                // Draw inner area
                this.ctx.fillStyle = "#CD5C5C";
                for(let px = startX + gridSize; px < startX + citySize - gridSize; px += gridSize) {
                    for(let py = startY + gridSize; py < startY + citySize - gridSize; py += gridSize) {
                        this.ctx.fillRect(px, py, gridSize, gridSize);
                    }
                }

                // Draw label with background
                this.ctx.font = "bold 12px Arial";
                const text = this.cityNames[index];
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
                const villageSize = 10;
                const startX = Math.floor(x - villageSize/2);
                const startY = Math.floor(y - villageSize/2);

                // Draw darker border
                this.ctx.fillStyle = "#00008B";
                for(let px = startX; px < startX + villageSize; px += gridSize) {
                    for(let py = startY; py < startY + villageSize; py += gridSize) {
                        if(px === startX || px >= startX + villageSize - gridSize || 
                           py === startY || py >= startY + villageSize - gridSize) {
                            this.ctx.fillRect(px, py, gridSize, gridSize);
                        }
                    }
                }

                // Draw inner area
                this.ctx.fillStyle = "#4169E1";
                for(let px = startX + gridSize; px < startX + villageSize - gridSize; px += gridSize) {
                    for(let py = startY + gridSize; py < startY + villageSize - gridSize; py += gridSize) {
                        this.ctx.fillRect(px, py, gridSize, gridSize);
                    }
                }

                // Draw label with background
                this.ctx.font = "bold 12px Arial";
                const text = this.villageNames[index];
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

    renderCitiesAndVillagesToCache() {
        const ctx = this.mapCacheCtx;
        const gridSize = 2;

        // Draw cities
        this.cities.forEach(([x, y], index) => {
            if (x >= 0 && x <= this.width && y >= 0 && y <= this.height) {
                const citySize = 12;
                const startX = Math.floor(x - citySize/2);
                const startY = Math.floor(y - citySize/2);

                ctx.fillStyle = "#8B0000";
                for(let px = startX; px < startX + citySize; px += gridSize) {
                    for(let py = startY; py < startY + citySize; py += gridSize) {
                        if(px === startX || px >= startX + citySize - gridSize || 
                           py === startY || py >= startY + citySize - gridSize) {
                            ctx.fillRect(px, py, gridSize, gridSize);
                        }
                    }
                }

                ctx.fillStyle = "#CD5C5C";
                for(let px = startX + gridSize; px < startX + citySize - gridSize; px += gridSize) {
                    for(let py = startY + gridSize; py < startY + citySize - gridSize; py += gridSize) {
                        ctx.fillRect(px, py, gridSize, gridSize);
                    }
                }

                ctx.font = "bold 12px Arial";
                const text = this.cityNames[index];
                const textWidth = ctx.measureText(text).width;
                
                ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
                ctx.fillRect(x - textWidth/2 - 4, y - 24, textWidth + 8, 16);
                
                ctx.fillStyle = "#8B0000";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(text, x, y - 16);
            }
        });

        // Draw villages
        this.villages.forEach(([x, y], index) => {
            if (x >= 0 && x <= this.width && y >= 0 && y <= this.height) {
                const villageSize = 10;
                const startX = Math.floor(x - villageSize/2);
                const startY = Math.floor(y - villageSize/2);

                ctx.fillStyle = "#00008B";
                for(let px = startX; px < startX + villageSize; px += gridSize) {
                    for(let py = startY; py < startY + villageSize; py += gridSize) {
                        if(px === startX || px >= startX + villageSize - gridSize || 
                           py === startY || py >= startY + villageSize - gridSize) {
                            ctx.fillRect(px, py, gridSize, gridSize);
                        }
                    }
                }

                ctx.fillStyle = "#4169E1";
                for(let px = startX + gridSize; px < startX + villageSize - gridSize; px += gridSize) {
                    for(let py = startY + gridSize; py < startY + villageSize - gridSize; py += gridSize) {
                        ctx.fillRect(px, py, gridSize, gridSize);
                    }
                }

                ctx.font = "bold 12px Arial";
                const text = this.villageNames[index];
                const textWidth = ctx.measureText(text).width;
                
                ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
                ctx.fillRect(x - textWidth/2 - 4, y - 24, textWidth + 8, 16);
                
                ctx.fillStyle = "#00008B";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(text, x, y - 16);
            }
        });
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
        
        // Draw the cached map with everything included
        this.ctx.translate(this.panX, this.panY);
        this.ctx.scale(this.zoomLevel, this.zoomLevel);
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.drawImage(this.mapCache, 0, 0);
        
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