/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 7955:
/***/ ((__unused_webpack_module, exports) => {


var _a;
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.HeightmapUtils = void 0;
class HeightmapUtils {
    static initializeNoise() {
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
    static generateHeightmap(params) {
        const { width, height, resolution, algorithm, seed = Math.random() } = params;
        const gridWidth = Math.ceil(width / resolution);
        const gridHeight = Math.ceil(height / resolution);
        // Validate parameters
        if (gridWidth <= 0 || gridHeight <= 0) {
            throw new Error(`Invalid grid dimensions: ${gridWidth}x${gridHeight}`);
        }
        const heights = [];
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
    static modifyHeightmap(heightmap, modification) {
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
                if (distance > gridRadius)
                    continue;
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
        return Object.assign(Object.assign({}, heightmap), { heights: newHeights, minHeight: Math.min(...newHeights.flat()), maxHeight: Math.max(...newHeights.flat()) });
    }
    static getHeightAt(heightmap, worldX, worldZ) {
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
    static getNormalAt(heightmap, worldX, worldZ) {
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
    static createChunk(heightmap, chunkX, chunkZ, chunkSize) {
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
        const chunkHeights = [];
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
    static exportHeightmap(heightmap, format) {
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
                const ctx = canvas.getContext('2d');
                canvas.width = heightmap.heights[0].length;
                canvas.height = heightmap.heights.length;
                const imageData = ctx.createImageData(canvas.width, canvas.height);
                for (let z = 0; z < heightmap.heights.length; z++) {
                    for (let x = 0; x < heightmap.heights[z].length; x++) {
                        const height = heightmap.heights[z][x];
                        const normalized = (height - heightmap.minHeight) / (heightmap.maxHeight - heightmap.minHeight);
                        const value = Math.floor(normalized * 255);
                        const index = (z * canvas.width + x) * 4;
                        imageData.data[index] = value; // R
                        imageData.data[index + 1] = value; // G
                        imageData.data[index + 2] = value; // B
                        imageData.data[index + 3] = 255; // A
                    }
                }
                ctx.putImageData(imageData, 0, 0);
                return canvas.toDataURL('image/png');
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
    static importHeightmap(data, format, width, height, resolution) {
        switch (format) {
            case 'json':
                return JSON.parse(data);
            case 'raw':
                const view = new Float32Array(data);
                const heights = [];
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
    static perlinNoise(x, z, params) {
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
    static perlin2D(x, z) {
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
    static simplexNoise(x, z, params) {
        // Simplified simplex noise implementation
        return this.perlinNoise(x, z, params);
    }
    static fractalNoise(x, z, params) {
        return this.perlinNoise(x, z, params);
    }
    static cellularNoise(x, z, params) {
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
                const dist = Math.sqrt(Math.pow((x - pointX), 2) + Math.pow((z - pointZ), 2));
                minDist = Math.min(minDist, dist);
            }
        }
        return Math.max(0, 1 - minDist / cellSize);
    }
    static smoothHeightmap(heights, iterations) {
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
    static smoothPoint(heights, x, z, intensity) {
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
    static getFalloffFactor(distance, falloff) {
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
    static seededRandom(seed) {
        let m = 0x80000000;
        let a = 1103515245;
        let c = 12345;
        let state = seed ? seed : Math.floor(Math.random() * (m - 1));
        return () => {
            state = (a * state + c) % m;
            return state / (m - 1);
        };
    }
    static fade(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }
    static lerp(a, b, t) {
        return a + t * (b - a);
    }
    static grad(hash, x, z) {
        const h = hash & 7;
        const grad = this.gradients[h];
        return grad[0] * x + grad[1] * z;
    }
    static hash(x, z) {
        return (x * 73856093) ^ (z * 19349663);
    }
    static mapRange(value, inMin, inMax, outMin, outMax) {
        return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
    }
}
exports.HeightmapUtils = HeightmapUtils;
_a = HeightmapUtils;
HeightmapUtils.PERMUTATION_TABLE_SIZE = 256;
HeightmapUtils.permutationTable = [];
HeightmapUtils.gradients = [];
(() => {
    _a.initializeNoise();
})();


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it uses a non-standard name for the exports (exports).
(() => {
var exports = __webpack_exports__;
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
__webpack_unused_export__ = void 0;
const heightmap_1 = __webpack_require__(7955);
class TerrainEditor {
    constructor() {
        this.heightmap = null;
        this.isDrawing = false;
        this.lastMousePos = null;
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 50;
        this.brushSettings = {
            type: 'raise',
            radius: 10,
            intensity: 1.0,
            falloff: 'gaussian'
        };
        this.materialSettings = {
            type: 'phong',
            color: 0x8B4513,
            roughness: 0.8,
            metalness: 0.1
        };
        this.canvas = document.getElementById('heightmapCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.miniMapCanvas = document.getElementById('miniMapCanvas');
        this.miniMapCtx = this.miniMapCanvas.getContext('2d');
        this.brushPreviewCanvas = document.getElementById('brushPreviewCanvas');
        this.brushPreviewCtx = this.brushPreviewCanvas.getContext('2d');
        // Set canvas sizes
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        this.miniMapCanvas.width = this.miniMapCanvas.offsetWidth;
        this.miniMapCanvas.height = this.miniMapCanvas.offsetHeight;
        this.brushPreviewCanvas.width = this.brushPreviewCanvas.offsetWidth;
        this.brushPreviewCanvas.height = this.brushPreviewCanvas.offsetHeight;
        this.initializeEventListeners();
        this.initializeSliders();
        this.generateDefaultHeightmap();
        this.validateHeightmap(); // Debug validation
        this.updateBrushPreview();
    }
    initializeEventListeners() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        // Canvas events
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));
        // Button events
        (_a = document.getElementById('generateBtn')) === null || _a === void 0 ? void 0 : _a.addEventListener('click', this.generateHeightmap.bind(this));
        (_b = document.getElementById('exportBtn')) === null || _b === void 0 ? void 0 : _b.addEventListener('click', this.exportHeightmap.bind(this));
        (_c = document.getElementById('importBtn')) === null || _c === void 0 ? void 0 : _c.addEventListener('click', this.importHeightmap.bind(this));
        (_d = document.getElementById('saveBtn')) === null || _d === void 0 ? void 0 : _d.addEventListener('click', this.saveHeightmap.bind(this));
        (_e = document.getElementById('undoBtn')) === null || _e === void 0 ? void 0 : _e.addEventListener('click', this.undo.bind(this));
        (_f = document.getElementById('redoBtn')) === null || _f === void 0 ? void 0 : _f.addEventListener('click', this.redo.bind(this));
        (_g = document.getElementById('wireframeBtn')) === null || _g === void 0 ? void 0 : _g.addEventListener('click', this.toggleWireframe.bind(this));
        (_h = document.getElementById('resetBtn')) === null || _h === void 0 ? void 0 : _h.addEventListener('click', this.resetHeightmap.bind(this));
        // File import
        (_j = document.getElementById('importFile')) === null || _j === void 0 ? void 0 : _j.addEventListener('change', this.onFileImport.bind(this));
        // Brush settings
        (_k = document.getElementById('brushType')) === null || _k === void 0 ? void 0 : _k.addEventListener('change', (e) => {
            this.brushSettings.type = e.target.value;
            this.updateBrushPreview();
        });
        (_l = document.getElementById('brushFalloff')) === null || _l === void 0 ? void 0 : _l.addEventListener('change', (e) => {
            this.brushSettings.falloff = e.target.value;
            this.updateBrushPreview();
        });
        // Material settings
        (_m = document.getElementById('materialType')) === null || _m === void 0 ? void 0 : _m.addEventListener('change', (e) => {
            this.materialSettings.type = e.target.value;
        });
        (_o = document.getElementById('materialColor')) === null || _o === void 0 ? void 0 : _o.addEventListener('change', (e) => {
            const color = e.target.value;
            this.materialSettings.color = parseInt(color.replace('#', '0x'));
        });
        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const preset = e.target.dataset.preset;
                if (preset)
                    this.applyPreset(preset);
            });
        });
        // Window resize
        window.addEventListener('resize', this.onResize.bind(this));
    }
    initializeSliders() {
        const sliders = [
            { id: 'octaves', valueId: 'octavesValue', min: 1, max: 8, step: 1 },
            { id: 'frequency', valueId: 'frequencyValue', min: 0.001, max: 0.1, step: 0.001 },
            { id: 'amplitude', valueId: 'amplitudeValue', min: 0.1, max: 5, step: 0.1 },
            { id: 'smoothing', valueId: 'smoothingValue', min: 0, max: 5, step: 1 },
            { id: 'brushRadius', valueId: 'brushRadiusValue', min: 1, max: 50, step: 1 },
            { id: 'brushIntensity', valueId: 'brushIntensityValue', min: 0.1, max: 5, step: 0.1 },
            { id: 'roughness', valueId: 'roughnessValue', min: 0, max: 1, step: 0.01 },
            { id: 'metalness', valueId: 'metalnessValue', min: 0, max: 1, step: 0.01 }
        ];
        sliders.forEach(slider => {
            const element = document.getElementById(slider.id);
            const valueElement = document.getElementById(slider.valueId);
            if (element && valueElement) {
                element.addEventListener('input', () => {
                    const value = parseFloat(element.value);
                    valueElement.textContent = value.toFixed(slider.step < 1 ? 2 : 0);
                    // Update brush settings if needed
                    if (slider.id === 'brushRadius') {
                        this.brushSettings.radius = value;
                        this.updateBrushPreview();
                    }
                    else if (slider.id === 'brushIntensity') {
                        this.brushSettings.intensity = value;
                        this.updateBrushPreview();
                    }
                    else if (slider.id === 'roughness') {
                        this.materialSettings.roughness = value;
                    }
                    else if (slider.id === 'metalness') {
                        this.materialSettings.metalness = value;
                    }
                });
            }
        });
    }
    generateDefaultHeightmap() {
        const params = {
            width: 256,
            height: 256,
            resolution: 1,
            algorithm: 'perlin',
            seed: 12345,
            octaves: 4,
            frequency: 0.02,
            amplitude: 1,
            persistence: 0.5,
            lacunarity: 2,
            minHeight: -5,
            maxHeight: 5,
            smoothing: 2
        };
        try {
            this.heightmap = heightmap_1.HeightmapUtils.generateHeightmap(params);
            // Verify the heightmap was created correctly
            if (!this.heightmap || !this.heightmap.heights || this.heightmap.heights.length === 0) {
                throw new Error('Failed to generate valid heightmap');
            }
            this.renderHeightmap();
            this.updateMiniMap();
            this.updateStatusBar('Default heightmap generated');
            this.validateHeightmap(); // Debug validation
        }
        catch (error) {
            console.error('Error generating default heightmap:', error);
            this.updateStatusBar('Error generating heightmap');
        }
    }
    generateHeightmap() {
        const params = {
            width: parseInt(document.getElementById('width').value),
            height: parseInt(document.getElementById('height').value),
            resolution: parseFloat(document.getElementById('resolution').value),
            algorithm: document.getElementById('algorithm').value,
            seed: parseInt(document.getElementById('seed').value),
            octaves: parseInt(document.getElementById('octaves').value),
            frequency: parseFloat(document.getElementById('frequency').value),
            amplitude: parseFloat(document.getElementById('amplitude').value),
            persistence: 0.5,
            lacunarity: 2,
            minHeight: parseFloat(document.getElementById('minHeight').value),
            maxHeight: parseFloat(document.getElementById('maxHeight').value),
            smoothing: parseInt(document.getElementById('smoothing').value)
        };
        this.saveToUndo();
        this.heightmap = heightmap_1.HeightmapUtils.generateHeightmap(params);
        this.renderHeightmap();
        this.updateMiniMap();
        this.updateStatusBar('New heightmap generated');
    }
    onMouseDown(e) {
        this.isDrawing = true;
        this.lastMousePos = this.getCanvasCoordinates(e);
        this.canvas.style.cursor = 'crosshair';
    }
    onMouseMove(e) {
        const pos = this.getCanvasCoordinates(e);
        if (this.isDrawing && this.lastMousePos && this.heightmap) {
            this.applyBrush(this.lastMousePos, pos);
            this.lastMousePos = pos;
        }
        // Update tooltip only if heightmap is valid
        if (this.heightmap && this.heightmap.heights && this.heightmap.heights.length > 0) {
            this.updateTooltip(e, pos);
        }
    }
    onMouseUp() {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.canvas.style.cursor = 'crosshair';
            this.saveToUndo();
            this.updateMiniMap();
        }
    }
    getCanvasCoordinates(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    applyBrush(from, to) {
        if (!this.heightmap)
            return;
        // Interpolate between points for smooth brush strokes
        const steps = Math.max(1, Math.floor(this.distance(from, to) / 2));
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const pos = {
                x: from.x + (to.x - from.x) * t,
                y: from.y + (to.y - from.y) * t
            };
            const worldX = (pos.x / this.canvas.width) * this.heightmap.width - this.heightmap.width / 2;
            const worldZ = (pos.y / this.canvas.height) * this.heightmap.height - this.heightmap.height / 2;
            const modification = {
                type: this.brushSettings.type,
                x: worldX,
                z: worldZ,
                radius: this.brushSettings.radius,
                intensity: this.brushSettings.intensity,
                falloff: this.brushSettings.falloff
            };
            this.heightmap = heightmap_1.HeightmapUtils.modifyHeightmap(this.heightmap, modification);
        }
        this.renderHeightmap();
    }
    distance(a, b) {
        return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
    }
    renderHeightmap() {
        if (!this.heightmap || !this.heightmap.heights || this.heightmap.heights.length === 0) {
            console.warn('Cannot render heightmap: invalid data');
            return;
        }
        const { width, height, heights, minHeight, maxHeight } = this.heightmap;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        // Clear canvas
        this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        // Create image data for better performance
        const imageData = this.ctx.createImageData(canvasWidth, canvasHeight);
        const data = imageData.data;
        for (let y = 0; y < canvasHeight; y++) {
            for (let x = 0; x < canvasWidth; x++) {
                const heightmapX = Math.floor((x / canvasWidth) * heights[0].length);
                const heightmapY = Math.floor((y / canvasHeight) * heights.length);
                if (heightmapX < heights[0].length && heightmapY < heights.length) {
                    const height = heights[heightmapY][heightmapX];
                    const normalized = (height - minHeight) / (maxHeight - minHeight);
                    // Create height-based coloring - use terrain plane colors
                    let r, g, b;
                    if (normalized < 0.3) {
                        // Low areas - darker green
                        r = 0;
                        g = Math.floor(100 + normalized * 100);
                        b = 0;
                    }
                    else if (normalized < 0.7) {
                        // Mid areas - standard terrain green
                        r = 0;
                        g = 255;
                        b = 0;
                    }
                    else {
                        // High areas - lighter green
                        r = Math.floor(normalized * 50);
                        g = 255;
                        b = Math.floor(normalized * 50);
                    }
                    const index = (y * canvasWidth + x) * 4;
                    data[index] = r; // R
                    data[index + 1] = g; // G
                    data[index + 2] = b; // B
                    data[index + 3] = 255; // A
                }
            }
        }
        this.ctx.putImageData(imageData, 0, 0);
    }
    updateMiniMap() {
        if (!this.heightmap)
            return;
        const { width, height, heights, minHeight, maxHeight } = this.heightmap;
        const miniWidth = this.miniMapCanvas.width;
        const miniHeight = this.miniMapCanvas.height;
        this.miniMapCtx.clearRect(0, 0, miniWidth, miniHeight);
        const imageData = this.miniMapCtx.createImageData(miniWidth, miniHeight);
        const data = imageData.data;
        for (let y = 0; y < miniHeight; y++) {
            for (let x = 0; x < miniWidth; x++) {
                const heightmapX = Math.floor((x / miniWidth) * heights[0].length);
                const heightmapY = Math.floor((y / miniHeight) * heights.length);
                if (heightmapX < heights[0].length && heightmapY < heights.length) {
                    const height = heights[heightmapY][heightmapX];
                    const normalized = (height - minHeight) / (maxHeight - minHeight);
                    const value = Math.floor(normalized * 255);
                    const index = (y * miniWidth + x) * 4;
                    data[index] = value; // R
                    data[index + 1] = value; // G
                    data[index + 2] = value; // B
                    data[index + 3] = 255; // A
                }
            }
        }
        this.miniMapCtx.putImageData(imageData, 0, 0);
    }
    updateBrushPreview() {
        const canvas = this.brushPreviewCanvas;
        const ctx = this.brushPreviewCtx;
        const size = Math.min(canvas.width, canvas.height);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw brush preview
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = (this.brushSettings.radius / 50) * (size / 2);
        // Create gradient for falloff
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        switch (this.brushSettings.falloff) {
            case 'linear':
                gradient.addColorStop(0, 'rgba(74, 222, 128, 1)');
                gradient.addColorStop(1, 'rgba(74, 222, 128, 0)');
                break;
            case 'exponential':
                gradient.addColorStop(0, 'rgba(74, 222, 128, 1)');
                gradient.addColorStop(0.5, 'rgba(74, 222, 128, 0.5)');
                gradient.addColorStop(1, 'rgba(74, 222, 128, 0)');
                break;
            case 'gaussian':
            default:
                gradient.addColorStop(0, 'rgba(74, 222, 128, 1)');
                gradient.addColorStop(0.3, 'rgba(74, 222, 128, 0.8)');
                gradient.addColorStop(0.7, 'rgba(74, 222, 128, 0.3)');
                gradient.addColorStop(1, 'rgba(74, 222, 128, 0)');
                break;
        }
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        // Draw brush type indicator
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.brushSettings.type.toUpperCase(), centerX, centerY + 4);
    }
    updateTooltip(e, pos) {
        const tooltip = document.getElementById('toolTip');
        if (!tooltip || !this.heightmap || !this.heightmap.heights || this.heightmap.heights.length === 0)
            return;
        try {
            const worldX = (pos.x / this.canvas.width) * this.heightmap.width - this.heightmap.width / 2;
            const worldZ = (pos.y / this.canvas.height) * this.heightmap.height - this.heightmap.height / 2;
            const height = heightmap_1.HeightmapUtils.getHeightAt(this.heightmap, worldX, worldZ);
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 10) + 'px';
            tooltip.style.top = (e.clientY - 30) + 'px';
            tooltip.textContent = `X: ${worldX.toFixed(1)}, Z: ${worldZ.toFixed(1)}, Height: ${height.toFixed(2)}`;
        }
        catch (error) {
            console.warn('Error updating tooltip:', error);
            tooltip.style.display = 'none';
        }
    }
    updateStatusBar(message) {
        const statusBar = document.getElementById('statusBar');
        if (statusBar) {
            statusBar.textContent = message;
        }
    }
    saveToUndo() {
        if (!this.heightmap)
            return;
        // Deep copy heightmap
        const copy = JSON.parse(JSON.stringify(this.heightmap));
        this.undoStack.push(copy);
        // Limit undo stack size
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        // Clear redo stack when new action is performed
        this.redoStack = [];
        // Update button states
        this.updateUndoRedoButtons();
    }
    undo() {
        if (this.undoStack.length === 0)
            return;
        if (this.heightmap) {
            this.redoStack.push(JSON.parse(JSON.stringify(this.heightmap)));
        }
        this.heightmap = this.undoStack.pop();
        this.renderHeightmap();
        this.updateMiniMap();
        this.updateStatusBar('Undo performed');
        this.updateUndoRedoButtons();
    }
    redo() {
        if (this.redoStack.length === 0)
            return;
        if (this.heightmap) {
            this.undoStack.push(JSON.parse(JSON.stringify(this.heightmap)));
        }
        this.heightmap = this.redoStack.pop();
        this.renderHeightmap();
        this.updateMiniMap();
        this.updateStatusBar('Redo performed');
        this.updateUndoRedoButtons();
    }
    updateUndoRedoButtons() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        if (undoBtn)
            undoBtn.disabled = this.undoStack.length === 0;
        if (redoBtn)
            redoBtn.disabled = this.redoStack.length === 0;
    }
    exportHeightmap() {
        if (!this.heightmap)
            return;
        const format = document.getElementById('exportFormat').value;
        try {
            const data = heightmap_1.HeightmapUtils.exportHeightmap(this.heightmap, format);
            if (format === 'json') {
                this.downloadFile(data, 'heightmap.json', 'application/json');
            }
            else if (format === 'raw') {
                this.downloadFile(data, 'heightmap.raw', 'application/octet-stream');
            }
            else if (format === 'png') {
                this.downloadFile(data, 'heightmap.png', 'image/png');
            }
            this.updateStatusBar(`Heightmap exported as ${format.toUpperCase()}`);
        }
        catch (error) {
            this.updateStatusBar(`Export failed: ${error}`);
        }
    }
    downloadFile(data, filename, mimeType) {
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    importHeightmap() {
        const fileInput = document.getElementById('importFile');
        fileInput.click();
    }
    onFileImport(e) {
        var _a;
        const file = (_a = e.target.files) === null || _a === void 0 ? void 0 : _a[0];
        if (!file)
            return;
        const reader = new FileReader();
        reader.onload = (event) => {
            var _a;
            try {
                const data = (_a = event.target) === null || _a === void 0 ? void 0 : _a.result;
                if (!data)
                    return;
                const format = file.name.endsWith('.json') ? 'json' :
                    file.name.endsWith('.raw') ? 'raw' : 'png';
                let width = 256, height = 256, resolution = 1;
                if (format === 'json') {
                    const jsonData = JSON.parse(data);
                    width = jsonData.width || 256;
                    height = jsonData.height || 256;
                    resolution = jsonData.resolution || 1;
                }
                this.saveToUndo();
                this.heightmap = heightmap_1.HeightmapUtils.importHeightmap(data, format, width, height, resolution);
                this.renderHeightmap();
                this.updateMiniMap();
                this.updateStatusBar(`Heightmap imported from ${file.name}`);
            }
            catch (error) {
                this.updateStatusBar(`Import failed: ${error}`);
            }
        };
        if (file.name.endsWith('.json')) {
            reader.readAsText(file);
        }
        else {
            reader.readAsArrayBuffer(file);
        }
    }
    saveHeightmap() {
        if (!this.heightmap)
            return;
        // Save to localStorage for now
        try {
            localStorage.setItem('terrain_editor_heightmap', JSON.stringify(this.heightmap));
            this.updateStatusBar('Heightmap saved to local storage');
        }
        catch (error) {
            this.updateStatusBar(`Save failed: ${error}`);
        }
    }
    toggleWireframe() {
        // This would toggle wireframe mode in the 3D view
        this.updateStatusBar('Wireframe mode toggled (3D view only)');
    }
    resetHeightmap() {
        if (confirm('Are you sure you want to reset the heightmap? This cannot be undone.')) {
            this.generateDefaultHeightmap();
            this.undoStack = [];
            this.redoStack = [];
            this.updateUndoRedoButtons();
            this.updateStatusBar('Heightmap reset to default');
        }
    }
    applyPreset(preset) {
        if (!this.heightmap)
            return;
        this.saveToUndo();
        const presets = {
            mountain: [
                { type: 'raise', x: 0, z: 0, radius: 50, intensity: 3, falloff: 'gaussian' },
                { type: 'raise', x: 20, z: 20, radius: 30, intensity: 2, falloff: 'gaussian' },
                { type: 'raise', x: -20, z: -20, radius: 25, intensity: 2.5, falloff: 'gaussian' }
            ],
            valley: [
                { type: 'lower', x: 0, z: 0, radius: 60, intensity: 2, falloff: 'gaussian' },
                { type: 'smooth', x: 0, z: 0, radius: 40, intensity: 0.8, falloff: 'gaussian' }
            ],
            plateau: [
                { type: 'flatten', x: 0, z: 0, radius: 80, intensity: 0, falloff: 'gaussian' },
                { type: 'raise', x: 0, z: 0, radius: 80, intensity: 1, falloff: 'gaussian' }
            ],
            island: [
                { type: 'raise', x: 0, z: 0, radius: 70, intensity: 2.5, falloff: 'gaussian' },
                { type: 'lower', x: 0, z: 0, radius: 100, intensity: 1, falloff: 'gaussian' }
            ],
            canyon: [
                { type: 'lower', x: 0, z: 0, radius: 40, intensity: 3, falloff: 'linear' },
                { type: 'lower', x: 0, z: 0, radius: 20, intensity: 1.5, falloff: 'gaussian' }
            ],
            rolling: [
                { type: 'raise', x: 0, z: 0, radius: 30, intensity: 1, falloff: 'gaussian' },
                { type: 'raise', x: 40, z: 40, radius: 25, intensity: 0.8, falloff: 'gaussian' },
                { type: 'raise', x: -40, z: -40, radius: 25, intensity: 0.8, falloff: 'gaussian' },
                { type: 'smooth', x: 0, z: 0, radius: 60, intensity: 0.5, falloff: 'gaussian' }
            ]
        };
        const modifications = presets[preset];
        if (modifications) {
            for (const mod of modifications) {
                this.heightmap = heightmap_1.HeightmapUtils.modifyHeightmap(this.heightmap, mod);
            }
            this.renderHeightmap();
            this.updateMiniMap();
            this.updateStatusBar(`${preset} preset applied`);
        }
    }
    onResize() {
        // Handle canvas resize
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
        this.miniMapCanvas.width = this.miniMapCanvas.offsetWidth;
        this.miniMapCanvas.height = this.miniMapCanvas.offsetHeight;
        this.brushPreviewCanvas.width = this.brushPreviewCanvas.offsetWidth;
        this.brushPreviewCanvas.height = this.brushPreviewCanvas.offsetHeight;
        this.renderHeightmap();
        this.updateMiniMap();
        this.updateBrushPreview();
    }
    getHeightmap() {
        return this.heightmap;
    }
    validateHeightmap() {
        if (!this.heightmap) {
            console.warn('Heightmap is null');
            return false;
        }
        if (!this.heightmap.heights) {
            console.warn('Heightmap heights array is missing');
            return false;
        }
        if (this.heightmap.heights.length === 0) {
            console.warn('Heightmap heights array is empty');
            return false;
        }
        if (!this.heightmap.heights[0] || this.heightmap.heights[0].length === 0) {
            console.warn('Heightmap heights subarrays are empty');
            return false;
        }
        console.log('Heightmap validation passed:', {
            width: this.heightmap.width,
            height: this.heightmap.height,
            resolution: this.heightmap.resolution,
            heightsLength: this.heightmap.heights.length,
            firstRowLength: this.heightmap.heights[0].length,
            minHeight: this.heightmap.minHeight,
            maxHeight: this.heightmap.maxHeight
        });
        return true;
    }
    getTerrainConfig() {
        return {
            heightmap: this.heightmap,
            material: this.materialSettings,
            collision: {
                enabled: true,
                precision: 'medium'
            },
            rendering: {
                wireframe: false,
                showNormals: false,
                chunkSize: 32,
                maxChunks: 16
            }
        };
    }
}
__webpack_unused_export__ = TerrainEditor;
// Initialize the editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new TerrainEditor();
});

})();

/******/ })()
;