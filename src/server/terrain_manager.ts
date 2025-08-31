import { HeightmapData, TerrainConfig, HeightmapGenerationParams, HeightmapModification } from '../shared/types';
import { HeightmapUtils } from '../shared/heightmap';

export class ServerTerrainManager {
    private heightmap: HeightmapData | null = null;
    private config: TerrainConfig;
    private isInitialized: boolean = false;

    constructor(config?: Partial<TerrainConfig>) {
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

    async initialize(): Promise<void> {
        if (this.isInitialized) return;

        // Generate default heightmap if none provided
        if (!this.heightmap) {
            this.heightmap = HeightmapUtils.generateHeightmap({
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

    generateHeightmap(params: HeightmapGenerationParams): HeightmapData {
        this.heightmap = HeightmapUtils.generateHeightmap(params);
        return this.heightmap;
    }

    modifyHeightmap(modification: HeightmapModification): HeightmapData | null {
        if (!this.heightmap) return null;
        
        this.heightmap = HeightmapUtils.modifyHeightmap(this.heightmap, modification);
        return this.heightmap;
    }

    getHeightAt(worldX: number, worldZ: number): number {
        if (!this.heightmap) return 0;
        return HeightmapUtils.getHeightAt(this.heightmap, worldX, worldZ);
    }

    getNormalAt(worldX: number, worldZ: number): { x: number, y: number, z: number } {
        if (!this.heightmap) return { x: 0, y: 1, z: 0 };
        return HeightmapUtils.getNormalAt(this.heightmap, worldX, worldZ);
    }

    checkCollision(position: { x: number, y: number, z: number }, radius: number = 0.1): boolean {
        if (!this.heightmap || !this.config.collision.enabled) return false;
        
        const height = this.getHeightAt(position.x, position.z);
        return position.y < height + radius;
    }

    getCollisionData(position: { x: number, y: number, z: number }, radius: number = 0.1): {
        collision: boolean;
        height: number;
        normal: { x: number, y: number, z: number };
        slope: number;
    } | null {
        if (!this.heightmap || !this.config.collision.enabled) return null;
        
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

    getHeightmapData(): HeightmapData | null {
        return this.heightmap;
    }

    getHeightmapChunk(chunkX: number, chunkZ: number, chunkSize: number): any {
        if (!this.heightmap) return null;
        return HeightmapUtils.createChunk(this.heightmap, chunkX, chunkZ, chunkSize);
    }

    getTerrainConfig(): TerrainConfig {
        return { ...this.config };
    }

    updateConfig(newConfig: Partial<TerrainConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    exportHeightmap(format: 'json' | 'raw'): string | ArrayBuffer {
        if (!this.heightmap) throw new Error('No heightmap to export');
        return HeightmapUtils.exportHeightmap(this.heightmap, format);
    }

    importHeightmap(data: string | ArrayBuffer, format: 'json' | 'raw', width: number, height: number, resolution: number): void {
        this.heightmap = HeightmapUtils.importHeightmap(data, format, width, height, resolution);
    }

    // Server-specific methods for multiplayer
    getHeightmapForClient(): any {
        if (!this.heightmap) return null;
        
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

    getHeightmapChunksForClient(chunkX: number, chunkZ: number, chunkSize: number): any {
        if (!this.heightmap) return null;
        
        const chunk = HeightmapUtils.createChunk(this.heightmap, chunkX, chunkZ, chunkSize);
        if (!chunk) return null;
        
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
    batchModifyHeightmap(modifications: HeightmapModification[]): HeightmapData | null {
        if (!this.heightmap) return null;
        
        let currentHeightmap = this.heightmap;
        for (const modification of modifications) {
            currentHeightmap = HeightmapUtils.modifyHeightmap(currentHeightmap, modification);
        }
        
        this.heightmap = currentHeightmap;
        return this.heightmap;
    }

    // Terrain analysis methods
    analyzeTerrain(): {
        averageHeight: number;
        maxSlope: number;
        flatAreas: number;
        steepAreas: number;
        waterLevel: number;
    } {
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
    findPath(start: { x: number, z: number }, end: { x: number, z: number }, maxSlope: number = Math.PI / 4): { x: number, z: number }[] | null {
        if (!this.heightmap) return null;

        // Simple A* pathfinding with slope constraints
        const openSet = new Set<string>();
        const closedSet = new Set<string>();
        const cameFrom = new Map<string, string>();
        const gScore = new Map<string, number>();
        const fScore = new Map<string, number>();

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
                if (closedSet.has(neighborKey)) continue;

                const tentativeGScore = gScore.get(current)! + this.distance({ x: currentX, z: currentZ }, neighbor);

                if (!openSet.has(neighborKey)) {
                    openSet.add(neighborKey);
                } else if (tentativeGScore >= gScore.get(neighborKey)!) {
                    continue;
                }

                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + this.heuristic(neighbor, end));
            }
        }

        return null; // No path found
    }

    private heuristic(a: { x: number, z: number }, b: { x: number, z: number }): number {
        return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.z - a.z, 2));
    }

    private distance(a: { x: number, z: number }, b: { x: number, z: number }): number {
        return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.z - a.z, 2));
    }

    private getNeighbors(pos: { x: number, z: number }, maxSlope: number): { x: number, z: number }[] {
        const neighbors: { x: number, z: number }[] = [];
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

    private isValidPosition(x: number, z: number): boolean {
        if (!this.heightmap) return false;
        return x >= 0 && x < this.heightmap.heights[0].length && 
               z >= 0 && z < this.heightmap.heights.length;
    }

    private getSlopeAt(x1: number, z1: number, x2: number, z2: number): number {
        if (!this.heightmap) return 0;

        const height1 = this.heightmap.heights[z1][x1];
        const height2 = this.heightmap.heights[z2][x2];
        const distance = this.distance({ x: x1, z: z1 }, { x: x2, z: z2 });

        if (distance === 0) return 0;

        return Math.atan2(Math.abs(height2 - height1), distance);
    }

    private getLowestFScore(openSet: Set<string>, fScore: Map<string, number>): string {
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

    private reconstructPath(cameFrom: Map<string, string>, current: string): { x: number, z: number }[] {
        const path: { x: number, z: number }[] = [];
        let currentKey = current;

        while (cameFrom.has(currentKey)) {
            const [x, z] = currentKey.split(',').map(Number);
            path.unshift({ x, z });
            currentKey = cameFrom.get(currentKey)!;
        }

        const [x, z] = currentKey.split(',').map(Number);
        path.unshift({ x, z });

        return path;
    }

    dispose(): void {
        this.heightmap = null;
        this.isInitialized = false;
    }
}
