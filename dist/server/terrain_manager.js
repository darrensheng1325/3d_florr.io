"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerTerrainManager = void 0;
const heightmap_1 = require("../shared/heightmap");
class ServerTerrainManager {
    constructor(config) {
        this.heightmap = null;
        this.isInitialized = false;
        this.config = {
            heightmap: {
                width: 100,
                height: 100,
                resolution: 1,
                heights: [],
                minHeight: -5,
                maxHeight: 5
            },
            material: {
                type: 'phong',
                color: 0x8B4513,
                roughness: 0.8,
                metalness: 0.1
            },
            collision: {
                enabled: true,
                precision: 'medium'
            },
            rendering: {
                wireframe: false,
                showNormals: false,
                chunkSize: 32,
                maxChunks: 16
            },
            ...config
        };
    }
    async initialize() {
        if (this.isInitialized)
            return;
        // Generate default heightmap if none provided
        if (!this.heightmap) {
            this.heightmap = heightmap_1.HeightmapUtils.generateHeightmap({
                width: this.config.heightmap.width,
                height: this.config.heightmap.height,
                resolution: this.config.heightmap.resolution,
                algorithm: 'perlin',
                seed: Math.random(),
                octaves: 4,
                frequency: 0.02,
                amplitude: 1,
                persistence: 0.5,
                lacunarity: 2,
                minHeight: this.config.heightmap.minHeight,
                maxHeight: this.config.heightmap.maxHeight,
                smoothing: 2
            });
        }
        this.isInitialized = true;
    }
    generateHeightmap(params) {
        this.heightmap = heightmap_1.HeightmapUtils.generateHeightmap(params);
        return this.heightmap;
    }
    modifyHeightmap(modification) {
        if (!this.heightmap)
            return null;
        this.heightmap = heightmap_1.HeightmapUtils.modifyHeightmap(this.heightmap, modification);
        return this.heightmap;
    }
    getHeightAt(worldX, worldZ) {
        if (!this.heightmap)
            return 0;
        return heightmap_1.HeightmapUtils.getHeightAt(this.heightmap, worldX, worldZ);
    }
    getNormalAt(worldX, worldZ) {
        if (!this.heightmap)
            return { x: 0, y: 1, z: 0 };
        return heightmap_1.HeightmapUtils.getNormalAt(this.heightmap, worldX, worldZ);
    }
    checkCollision(position, radius = 0.1) {
        if (!this.heightmap || !this.config.collision.enabled)
            return false;
        const height = this.getHeightAt(position.x, position.z);
        return position.y < height + radius;
    }
    getCollisionData(position, radius = 0.1) {
        if (!this.heightmap || !this.config.collision.enabled)
            return null;
        const height = this.getHeightAt(position.x, position.z);
        const normal = this.getNormalAt(position.x, position.z);
        const collision = position.y < height + radius;
        if (collision) {
            const slope = Math.atan2(Math.sqrt(normal.x * normal.x + normal.z * normal.z), normal.y);
            return {
                collision: true,
                height,
                normal,
                slope
            };
        }
        return {
            collision: false,
            height,
            normal,
            slope: 0
        };
    }
    getHeightmapData() {
        return this.heightmap;
    }
    getHeightmapChunk(chunkX, chunkZ, chunkSize) {
        if (!this.heightmap)
            return null;
        return heightmap_1.HeightmapUtils.createChunk(this.heightmap, chunkX, chunkZ, chunkSize);
    }
    getTerrainConfig() {
        return { ...this.config };
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
    exportHeightmap(format) {
        if (!this.heightmap)
            throw new Error('No heightmap to export');
        return heightmap_1.HeightmapUtils.exportHeightmap(this.heightmap, format);
    }
    importHeightmap(data, format, width, height, resolution) {
        this.heightmap = heightmap_1.HeightmapUtils.importHeightmap(data, format, width, height, resolution);
    }
    // Server-specific methods for multiplayer
    getHeightmapForClient() {
        if (!this.heightmap)
            return null;
        // Return a simplified version for client synchronization
        return {
            width: this.heightmap.width,
            height: this.heightmap.height,
            resolution: this.heightmap.resolution,
            minHeight: this.heightmap.minHeight,
            maxHeight: this.heightmap.maxHeight,
            metadata: this.heightmap.metadata
        };
    }
    getHeightmapChunksForClient(chunkX, chunkZ, chunkSize) {
        if (!this.heightmap)
            return null;
        const chunk = heightmap_1.HeightmapUtils.createChunk(this.heightmap, chunkX, chunkZ, chunkSize);
        if (!chunk)
            return null;
        // Return chunk data optimized for network transmission
        return {
            x: chunk.x,
            z: chunk.z,
            width: chunk.width,
            height: chunk.height,
            heights: chunk.heights,
            resolution: this.heightmap.resolution
        };
    }
    // Batch operations for performance
    batchModifyHeightmap(modifications) {
        if (!this.heightmap)
            return null;
        let currentHeightmap = this.heightmap;
        for (const modification of modifications) {
            currentHeightmap = heightmap_1.HeightmapUtils.modifyHeightmap(currentHeightmap, modification);
        }
        this.heightmap = currentHeightmap;
        return this.heightmap;
    }
    // Terrain analysis methods
    analyzeTerrain() {
        if (!this.heightmap) {
            return {
                averageHeight: 0,
                maxSlope: 0,
                flatAreas: 0,
                steepAreas: 0,
                waterLevel: 0
            };
        }
        const { heights, resolution } = this.heightmap;
        let totalHeight = 0;
        let maxSlope = 0;
        let flatAreas = 0;
        let steepAreas = 0;
        let totalSlope = 0;
        let slopeCount = 0;
        for (let z = 1; z < heights.length - 1; z++) {
            for (let x = 1; x < heights[z].length - 1; x++) {
                const height = heights[z][x];
                totalHeight += height;
                // Calculate slope
                const dx = (heights[z][x + 1] - heights[z][x - 1]) / (2 * resolution);
                const dz = (heights[z + 1][x] - heights[z - 1][x]) / (2 * resolution);
                const slope = Math.atan2(Math.sqrt(dx * dx + dz * dz), 1);
                totalSlope += slope;
                slopeCount++;
                if (slope > maxSlope) {
                    maxSlope = slope;
                }
                if (slope < 0.1) { // Less than ~5.7 degrees
                    flatAreas++;
                }
                if (slope > 0.5) { // More than ~28.6 degrees
                    steepAreas++;
                }
            }
        }
        const averageHeight = totalHeight / (heights.length * heights[0].length);
        const averageSlope = totalSlope / slopeCount;
        const waterLevel = averageHeight - 0.5; // Simple water level calculation
        return {
            averageHeight,
            maxSlope,
            flatAreas,
            steepAreas,
            waterLevel
        };
    }
    // Pathfinding helper methods
    findPath(start, end, maxSlope = Math.PI / 4) {
        if (!this.heightmap)
            return null;
        // Simple A* pathfinding with slope constraints
        const openSet = new Set();
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();
        const startKey = `${start.x},${start.z}`;
        const endKey = `${end.x},${end.z}`;
        openSet.add(startKey);
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(start, end));
        while (openSet.size > 0) {
            let current = this.getLowestFScore(openSet, fScore);
            if (current === endKey) {
                return this.reconstructPath(cameFrom, current);
            }
            openSet.delete(current);
            closedSet.add(current);
            const [currentX, currentZ] = current.split(',').map(Number);
            const neighbors = this.getNeighbors({ x: currentX, z: currentZ }, maxSlope);
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.z}`;
                if (closedSet.has(neighborKey))
                    continue;
                const tentativeGScore = gScore.get(current) + this.distance({ x: currentX, z: currentZ }, neighbor);
                if (!openSet.has(neighborKey)) {
                    openSet.add(neighborKey);
                }
                else if (tentativeGScore >= gScore.get(neighborKey)) {
                    continue;
                }
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + this.heuristic(neighbor, end));
            }
        }
        return null; // No path found
    }
    heuristic(a, b) {
        return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.z - a.z, 2));
    }
    distance(a, b) {
        return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.z - a.z, 2));
    }
    getNeighbors(pos, maxSlope) {
        const neighbors = [];
        const directions = [
            { x: 1, z: 0 }, { x: -1, z: 0 },
            { x: 0, z: 1 }, { x: 0, z: -1 },
            { x: 1, z: 1 }, { x: -1, z: 1 },
            { x: 1, z: -1 }, { x: -1, z: -1 }
        ];
        for (const dir of directions) {
            const newX = pos.x + dir.x;
            const newZ = pos.z + dir.z;
            if (this.isValidPosition(newX, newZ)) {
                const slope = this.getSlopeAt(pos.x, pos.z, newX, newZ);
                if (slope <= maxSlope) {
                    neighbors.push({ x: newX, z: newZ });
                }
            }
        }
        return neighbors;
    }
    isValidPosition(x, z) {
        if (!this.heightmap)
            return false;
        return x >= 0 && x < this.heightmap.heights[0].length &&
            z >= 0 && z < this.heightmap.heights.length;
    }
    getSlopeAt(x1, z1, x2, z2) {
        if (!this.heightmap)
            return 0;
        const height1 = this.heightmap.heights[z1][x1];
        const height2 = this.heightmap.heights[z2][x2];
        const distance = this.distance({ x: x1, z: z1 }, { x: x2, z: z2 });
        if (distance === 0)
            return 0;
        return Math.atan2(Math.abs(height2 - height1), distance);
    }
    getLowestFScore(openSet, fScore) {
        let lowest = '';
        let lowestScore = Infinity;
        for (const key of openSet) {
            const score = fScore.get(key) || Infinity;
            if (score < lowestScore) {
                lowestScore = score;
                lowest = key;
            }
        }
        return lowest;
    }
    reconstructPath(cameFrom, current) {
        const path = [];
        let currentKey = current;
        while (cameFrom.has(currentKey)) {
            const [x, z] = currentKey.split(',').map(Number);
            path.unshift({ x, z });
            currentKey = cameFrom.get(currentKey);
        }
        const [x, z] = currentKey.split(',').map(Number);
        path.unshift({ x, z });
        return path;
    }
    dispose() {
        this.heightmap = null;
        this.isInitialized = false;
    }
}
exports.ServerTerrainManager = ServerTerrainManager;
//# sourceMappingURL=terrain_manager.js.map