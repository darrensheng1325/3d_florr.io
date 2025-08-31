import { HeightmapData, HeightmapGenerationParams, HeightmapModification, HeightmapChunk } from './types';

export class HeightmapUtils {
    private static readonly PERMUTATION_TABLE_SIZE = 256;
    private static permutationTable: number[] = [];
    private static gradients: number[][] = [];

    static {
        this.initializeNoise();
    }

    private static initializeNoise(): void {
        // Initialize permutation table
        for (let i = 0; i < this.PERMUTATION_TABLE_SIZE; i++) {
            this.permutationTable[i] = i;
        }
        
        // Shuffle permutation table
        for (let i = this.PERMUTATION_TABLE_SIZE - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.permutationTable[i], this.permutationTable[j]] = 
            [this.permutationTable[j], this.permutationTable[i]];
        }

        // Initialize gradients for 2D noise
        this.gradients = [
            [1, 1], [-1, 1], [1, -1], [-1, -1],
            [1, 0], [-1, 0], [0, 1], [0, -1]
        ];
    }

    static generateHeightmap(params: HeightmapGenerationParams): HeightmapData {
        const { width, height, resolution, algorithm, seed = Math.random() } = params;
        const gridWidth = Math.ceil(width / resolution);
        const gridHeight = Math.ceil(height / resolution);
        
        // Validate parameters
        if (gridWidth <= 0 || gridHeight <= 0) {
            throw new Error(`Invalid grid dimensions: ${gridWidth}x${gridHeight}`);
        }
        
        const heights: number[][] = [];
        
        // Set random seed
        const random = this.seededRandom(seed);
        
        for (let z = 0; z < gridHeight; z++) {
            heights[z] = [];
            for (let x = 0; x < gridWidth; x++) {
                let height = 0;
                
                switch (algorithm) {
                    case 'perlin':
                        height = this.perlinNoise(x * 0.1, z * 0.1, params);
                        break;
                    case 'simplex':
                        height = this.simplexNoise(x * 0.1, z * 0.1, params);
                        break;
                    case 'fractal':
                        height = this.fractalNoise(x * 0.1, z * 0.1, params);
                        break;
                    case 'cellular':
                        height = this.cellularNoise(x * 0.1, z * 0.1, params);
                        break;
                    case 'random':
                        height = random() * 2 - 1;
                        break;
                    default:
                        height = random() * 2 - 1;
                        break;
                }
                
                // Apply height range
                height = this.mapRange(height, -1, 1, params.minHeight, params.maxHeight);
                heights[z][x] = height;
            }
        }

        // Apply smoothing if specified
        if (params.smoothing && params.smoothing > 0) {
            const smoothedHeights = this.smoothHeightmap(heights, params.smoothing);
            heights.splice(0, heights.length, ...smoothedHeights);
        }

        // Validate the generated heightmap
        if (heights.length === 0 || heights[0].length === 0) {
            throw new Error('Failed to generate valid heightmap data');
        }

        return {
            width,
            height,
            resolution,
            heights,
            minHeight: params.minHeight,
            maxHeight: params.maxHeight,
            metadata: {
                name: `Generated_${algorithm}_${Date.now()}`,
                created: new Date().toISOString(),
                version: '1.0'
            }
        };
    }

    static modifyHeightmap(heightmap: HeightmapData, modification: HeightmapModification): HeightmapData {
        const { type, x, z, radius, intensity, falloff = 'gaussian' } = modification;
        const newHeights = heightmap.heights.map(row => [...row]);
        
        const gridX = Math.floor(x / heightmap.resolution);
        const gridZ = Math.floor(z / heightmap.resolution);
        const gridRadius = Math.ceil(radius / heightmap.resolution);
        
        for (let dz = -gridRadius; dz <= gridRadius; dz++) {
            for (let dx = -gridRadius; dx <= gridRadius; dx++) {
                const checkX = gridX + dx;
                const checkZ = gridZ + dz;
                
                if (checkX < 0 || checkX >= newHeights[0].length || 
                    checkZ < 0 || checkZ >= newHeights.length) {
                    continue;
                }
                
                const distance = Math.sqrt(dx * dx + dz * dz);
                if (distance > gridRadius) continue;
                
                const factor = this.getFalloffFactor(distance / gridRadius, falloff);
                const currentHeight = newHeights[checkZ][checkX];
                
                switch (type) {
                    case 'raise':
                        newHeights[checkZ][checkX] = currentHeight + (intensity * factor);
                        break;
                    case 'lower':
                        newHeights[checkZ][checkX] = currentHeight - (intensity * factor);
                        break;
                    case 'smooth':
                        newHeights[checkZ][checkX] = this.smoothPoint(newHeights, checkX, checkZ, factor * intensity);
                        break;
                    case 'flatten':
                        newHeights[checkZ][checkX] = currentHeight + (intensity - currentHeight) * factor;
                        break;
                    case 'noise':
                        newHeights[checkZ][checkX] = currentHeight + (Math.random() * 2 - 1) * intensity * factor;
                        break;
                }
            }
        }
        
        return {
            ...heightmap,
            heights: newHeights,
            minHeight: Math.min(...newHeights.flat()),
            maxHeight: Math.max(...newHeights.flat())
        };
    }

    static getHeightAt(heightmap: HeightmapData, worldX: number, worldZ: number): number {
        // Validate heightmap data
        if (!heightmap || !heightmap.heights || heightmap.heights.length === 0 || heightmap.heights[0].length === 0) {
            console.warn('Invalid heightmap data in getHeightAt');
            return 0;
        }
        
        const gridX = worldX / heightmap.resolution;
        const gridZ = worldZ / heightmap.resolution;
        
        const x0 = Math.floor(gridX);
        const z0 = Math.floor(gridZ);
        
        // Bounds checking
        if (x0 < 0 || x0 >= heightmap.heights[0].length || z0 < 0 || z0 >= heightmap.heights.length) {
            return 0; // Return 0 for out-of-bounds positions
        }
        
        const x1 = Math.min(x0 + 1, heightmap.heights[0].length - 1);
        const z1 = Math.min(z0 + 1, heightmap.heights.length - 1);
        
        const fx = gridX - x0;
        const fz = gridZ - z0;
        
        // Bilinear interpolation
        const h00 = heightmap.heights[z0][x0];
        const h10 = heightmap.heights[z0][x1];
        const h01 = heightmap.heights[z1][x0];
        const h11 = heightmap.heights[z1][x1];
        
        const h0 = h00 * (1 - fx) + h10 * fx;
        const h1 = h01 * (1 - fx) + h11 * fx;
        
        return h0 * (1 - fz) + h1 * fz;
    }

    static getNormalAt(heightmap: HeightmapData, worldX: number, worldZ: number): { x: number, y: number, z: number } {
        // Validate heightmap data
        if (!heightmap || !heightmap.heights || heightmap.heights.length === 0 || heightmap.heights[0].length === 0) {
            console.warn('Invalid heightmap data in getNormalAt');
            return { x: 0, y: 1, z: 0 };
        }
        
        const delta = heightmap.resolution * 0.5;
        const h1 = this.getHeightAt(heightmap, worldX - delta, worldZ);
        const h2 = this.getHeightAt(heightmap, worldX + delta, worldZ);
        const h3 = this.getHeightAt(heightmap, worldX, worldZ - delta);
        const h4 = this.getHeightAt(heightmap, worldX, worldZ + delta);
        
        const dx = (h2 - h1) / (2 * delta);
        const dz = (h4 - h3) / (2 * delta);
        
        const length = Math.sqrt(dx * dx + dz * dz + 1);
        return {
            x: -dx / length,
            y: 1 / length,
            z: -dz / length
        };
    }

    static createChunk(heightmap: HeightmapData, chunkX: number, chunkZ: number, chunkSize: number): HeightmapChunk {
        // Validate input parameters
        if (!heightmap || !heightmap.heights || heightmap.heights.length === 0 || heightmap.heights[0].length === 0) {
            console.warn('Invalid heightmap data in createChunk');
            return {
                x: chunkX,
                z: chunkZ,
                width: 0,
                height: 0,
                heights: []
            };
        }
        
        // Calculate chunk boundaries
        const startX = Math.floor(chunkX * chunkSize / heightmap.resolution);
        const startZ = Math.floor(chunkZ * chunkSize / heightmap.resolution);
        
        // Ensure we don't go out of bounds
        const clampedStartX = Math.max(0, startX);
        const clampedStartZ = Math.max(0, startZ);
        const endX = Math.min(startX + chunkSize, heightmap.heights[0].length);
        const endZ = Math.min(startZ + chunkSize, heightmap.heights.length);
        
        // Validate chunk boundaries
        if (clampedStartX >= heightmap.heights[0].length || clampedStartZ >= heightmap.heights.length) {
            console.warn(`Chunk coordinates out of bounds: chunkX=${chunkX}, chunkZ=${chunkZ}, startX=${startX}, startZ=${startZ}`);
            return {
                x: chunkX,
                z: chunkZ,
                width: 0,
                height: 0,
                heights: []
            };
        }
        
        const chunkHeights: number[][] = [];
        for (let z = clampedStartZ; z < endZ; z++) {
            chunkHeights[z - clampedStartZ] = [];
            for (let x = clampedStartX; x < endX; x++) {
                chunkHeights[z - clampedStartZ][x - clampedStartX] = heightmap.heights[z][x];
            }
        }
        
        return {
            x: chunkX,
            z: chunkZ,
            width: endX - clampedStartX,
            height: endZ - clampedStartZ,
            heights: chunkHeights
        };
    }

    static exportHeightmap(heightmap: HeightmapData, format: 'json' | 'raw' | 'png'): string | ArrayBuffer {
        switch (format) {
            case 'json':
                return JSON.stringify(heightmap, null, 2);
            case 'raw':
                const buffer = new ArrayBuffer(heightmap.heights.length * heightmap.heights[0].length * 4);
                const view = new Float32Array(buffer);
                let index = 0;
                for (let z = 0; z < heightmap.heights.length; z++) {
                    for (let x = 0; x < heightmap.heights[z].length; x++) {
                        view[index++] = heightmap.heights[z][x];
                    }
                }
                return buffer;
            case 'png':
                // Create canvas and convert heights to grayscale
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d')!;
                canvas.width = heightmap.heights[0].length;
                canvas.height = heightmap.heights.length;
                
                const imageData = ctx.createImageData(canvas.width, canvas.height);
                for (let z = 0; z < heightmap.heights.length; z++) {
                    for (let x = 0; x < heightmap.heights[z].length; x++) {
                        const height = heightmap.heights[z][x];
                        const normalized = (height - heightmap.minHeight) / (heightmap.maxHeight - heightmap.minHeight);
                        const value = Math.floor(normalized * 255);
                        
                        const index = (z * canvas.width + x) * 4;
                        imageData.data[index] = value;     // R
                        imageData.data[index + 1] = value; // G
                        imageData.data[index + 2] = value; // B
                        imageData.data[index + 3] = 255;   // A
                    }
                }
                
                ctx.putImageData(imageData, 0, 0);
                return canvas.toDataURL('image/png');
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    static importHeightmap(data: string | ArrayBuffer, format: 'json' | 'raw' | 'png', width: number, height: number, resolution: number): HeightmapData {
        switch (format) {
            case 'json':
                return JSON.parse(data as string);
            case 'raw':
                const view = new Float32Array(data as ArrayBuffer);
                const heights: number[][] = [];
                let index = 0;
                for (let z = 0; z < height; z++) {
                    heights[z] = [];
                    for (let x = 0; x < width; x++) {
                        heights[z][x] = view[index++];
                    }
                }
                return {
                    width,
                    height,
                    resolution,
                    heights,
                    minHeight: Math.min(...heights.flat()),
                    maxHeight: Math.max(...heights.flat())
                };
            case 'png':
                // This would require canvas API to read image data
                throw new Error('PNG import not implemented in this environment');
            default:
                throw new Error(`Unsupported import format: ${format}`);
        }
    }

    private static perlinNoise(x: number, z: number, params: HeightmapGenerationParams): number {
        const { octaves = 4, frequency = 1, amplitude = 1, persistence = 0.5, lacunarity = 2 } = params;
        
        let total = 0;
        let currentAmplitude = amplitude;
        let currentFrequency = frequency;
        
        for (let i = 0; i < octaves; i++) {
            total += this.perlin2D(x * currentFrequency, z * currentFrequency) * currentAmplitude;
            currentAmplitude *= persistence;
            currentFrequency *= lacunarity;
        }
        
        return total;
    }

    private static perlin2D(x: number, z: number): number {
        const xi = Math.floor(x) & 255;
        const zi = Math.floor(z) & 255;
        const xf = x - Math.floor(x);
        const zf = z - Math.floor(z);
        
        const u = this.fade(xf);
        const w = this.fade(zf);
        
        const a = this.permutationTable[xi] + zi;
        const aa = this.permutationTable[a & 255];
        const ab = this.permutationTable[(a + 1) & 255];
        const b = this.permutationTable[(xi + 1) & 255] + zi;
        const ba = this.permutationTable[b & 255];
        const bb = this.permutationTable[(b + 1) & 255];
        
        const x1 = this.lerp(this.grad(this.permutationTable[aa & 255], xf, zf), this.grad(this.permutationTable[ba & 255], xf - 1, zf), u);
        const x2 = this.lerp(this.grad(this.permutationTable[ab & 255], xf, zf - 1), this.grad(this.permutationTable[bb & 255], xf - 1, zf - 1), u);
        
        return this.lerp(x1, x2, w);
    }

    private static simplexNoise(x: number, z: number, params: HeightmapGenerationParams): number {
        // Simplified simplex noise implementation
        return this.perlinNoise(x, z, params);
    }

    private static fractalNoise(x: number, z: number, params: HeightmapGenerationParams): number {
        return this.perlinNoise(x, z, params);
    }

    private static cellularNoise(x: number, z: number, params: HeightmapGenerationParams): number {
        // Simplified cellular noise implementation
        const cellSize = 10;
        const cellX = Math.floor(x / cellSize);
        const cellZ = Math.floor(z / cellSize);
        
        let minDist = Infinity;
        for (let dz = -1; dz <= 1; dz++) {
            for (let dx = -1; dx <= 1; dx++) {
                const checkX = cellX + dx;
                const checkZ = cellZ + dz;
                const pointX = checkX * cellSize + this.hash(checkX, checkZ) % cellSize;
                const pointZ = checkZ * cellSize + this.hash(checkX, checkZ + 1) % cellSize;
                
                const dist = Math.sqrt((x - pointX) ** 2 + (z - pointZ) ** 2);
                minDist = Math.min(minDist, dist);
            }
        }
        
        return Math.max(0, 1 - minDist / cellSize);
    }

    private static smoothHeightmap(heights: number[][], iterations: number): number[][] {
        const smoothed = heights.map(row => [...row]);
        
        for (let iter = 0; iter < iterations; iter++) {
            for (let z = 1; z < heights.length - 1; z++) {
                for (let x = 1; x < heights[z].length - 1; x++) {
                    const neighbors = [
                        heights[z][x - 1], heights[z][x + 1],
                        heights[z - 1][x], heights[z + 1][x]
                    ];
                    smoothed[z][x] = neighbors.reduce((sum, h) => sum + h, 0) / neighbors.length;
                }
            }
        }
        
        return smoothed;
    }

    private static smoothPoint(heights: number[][], x: number, z: number, intensity: number): number {
        if (x <= 0 || x >= heights[z].length - 1 || z <= 0 || z >= heights.length - 1) {
            return heights[z][x];
        }
        
        const neighbors = [
            heights[z][x - 1], heights[z][x + 1],
            heights[z - 1][x], heights[z + 1][x]
        ];
        const average = neighbors.reduce((sum, h) => sum + h, 0) / neighbors.length;
        
        return this.lerp(heights[z][x], average, intensity);
    }

    private static getFalloffFactor(distance: number, falloff: string): number {
        switch (falloff) {
            case 'linear':
                return 1 - distance;
            case 'exponential':
                return Math.exp(-distance * 3);
            case 'gaussian':
                return Math.exp(-(distance * distance) * 4);
            default:
                return 1 - distance;
        }
    }

    private static seededRandom(seed: number): () => number {
        let m = 0x80000000;
        let a = 1103515245;
        let c = 12345;
        let state = seed ? seed : Math.floor(Math.random() * (m - 1));
        
        return () => {
            state = (a * state + c) % m;
            return state / (m - 1);
        };
    }

    private static fade(t: number): number {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    private static lerp(a: number, b: number, t: number): number {
        return a + t * (b - a);
    }

    private static grad(hash: number, x: number, z: number): number {
        const h = hash & 7;
        const grad = this.gradients[h];
        return grad[0] * x + grad[1] * z;
    }

    private static hash(x: number, z: number): number {
        return (x * 73856093) ^ (z * 19349663);
    }

    private static mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
        return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    }
}
