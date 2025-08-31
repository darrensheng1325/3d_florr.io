import { HeightmapUtils } from '../shared/heightmap';
import { HeightmapData, HeightmapGenerationParams, HeightmapModification, TerrainConfig } from '../shared/types';

export class TerrainEditor {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private miniMapCanvas: HTMLCanvasElement;
    private miniMapCtx: CanvasRenderingContext2D;
    private brushPreviewCanvas: HTMLCanvasElement;
    private brushPreviewCtx: CanvasRenderingContext2D;
    
    private heightmap: HeightmapData | null = null;
    private isDrawing: boolean = false;
    private lastMousePos: { x: number, y: number } | null = null;
    
    private undoStack: HeightmapData[] = [];
    private redoStack: HeightmapData[] = [];
    private maxUndoSteps: number = 50;
    
    private brushSettings = {
        type: 'raise' as const,
        radius: 10,
        intensity: 1.0,
        falloff: 'gaussian' as 'linear' | 'exponential' | 'gaussian'
    };
    
    private materialSettings = {
        type: 'phong' as const,
        color: 0x8B4513,
        roughness: 0.8,
        metalness: 0.1
    };

    constructor() {
        this.canvas = document.getElementById('heightmapCanvas') as HTMLCanvasElement;
        this.ctx = this.canvas.getContext('2d')!;
        this.miniMapCanvas = document.getElementById('miniMapCanvas') as HTMLCanvasElement;
        this.miniMapCtx = this.miniMapCanvas.getContext('2d')!;
        this.brushPreviewCanvas = document.getElementById('brushPreviewCanvas') as HTMLCanvasElement;
        this.brushPreviewCtx = this.brushPreviewCanvas.getContext('2d')!;
        
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

    private initializeEventListeners(): void {
        // Canvas events
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));
        
        // Button events
        document.getElementById('generateBtn')?.addEventListener('click', this.generateHeightmap.bind(this));
        document.getElementById('exportBtn')?.addEventListener('click', this.exportHeightmap.bind(this));
        document.getElementById('importBtn')?.addEventListener('click', this.importHeightmap.bind(this));
        document.getElementById('saveBtn')?.addEventListener('click', this.saveHeightmap.bind(this));
        document.getElementById('undoBtn')?.addEventListener('click', this.undo.bind(this));
        document.getElementById('redoBtn')?.addEventListener('click', this.redo.bind(this));
        document.getElementById('wireframeBtn')?.addEventListener('click', this.toggleWireframe.bind(this));
        document.getElementById('resetBtn')?.addEventListener('click', this.resetHeightmap.bind(this));
        
        // File import
        document.getElementById('importFile')?.addEventListener('change', this.onFileImport.bind(this));
        
        // Brush settings
        document.getElementById('brushType')?.addEventListener('change', (e) => {
            this.brushSettings.type = (e.target as HTMLSelectElement).value as any;
            this.updateBrushPreview();
        });
        
        document.getElementById('brushFalloff')?.addEventListener('change', (e) => {
            this.brushSettings.falloff = (e.target as HTMLSelectElement).value as any;
            this.updateBrushPreview();
        });
        
        // Material settings
        document.getElementById('materialType')?.addEventListener('change', (e) => {
            this.materialSettings.type = (e.target as HTMLSelectElement).value as any;
        });
        
        document.getElementById('materialColor')?.addEventListener('change', (e) => {
            const color = (e.target as HTMLInputElement).value;
            this.materialSettings.color = parseInt(color.replace('#', '0x'));
        });
        
        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const preset = (e.target as HTMLElement).dataset.preset;
                if (preset) this.applyPreset(preset);
            });
        });
        
        // Window resize
        window.addEventListener('resize', this.onResize.bind(this));
    }

    private initializeSliders(): void {
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
            const element = document.getElementById(slider.id) as HTMLInputElement;
            const valueElement = document.getElementById(slider.valueId);
            
            if (element && valueElement) {
                element.addEventListener('input', () => {
                    const value = parseFloat(element.value);
                    valueElement.textContent = value.toFixed(slider.step < 1 ? 2 : 0);
                    
                    // Update brush settings if needed
                    if (slider.id === 'brushRadius') {
                        this.brushSettings.radius = value;
                        this.updateBrushPreview();
                    } else if (slider.id === 'brushIntensity') {
                        this.brushSettings.intensity = value;
                        this.updateBrushPreview();
                    } else if (slider.id === 'roughness') {
                        this.materialSettings.roughness = value;
                    } else if (slider.id === 'metalness') {
                        this.materialSettings.metalness = value;
                    }
                });
            }
        });
    }

    private generateDefaultHeightmap(): void {
        const params: HeightmapGenerationParams = {
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
            this.heightmap = HeightmapUtils.generateHeightmap(params);
            
            // Verify the heightmap was created correctly
            if (!this.heightmap || !this.heightmap.heights || this.heightmap.heights.length === 0) {
                throw new Error('Failed to generate valid heightmap');
            }
            
            this.renderHeightmap();
            this.updateMiniMap();
            this.updateStatusBar('Default heightmap generated');
            this.validateHeightmap(); // Debug validation
        } catch (error) {
            console.error('Error generating default heightmap:', error);
            this.updateStatusBar('Error generating heightmap');
        }
    }

    private generateHeightmap(): void {
        const params: HeightmapGenerationParams = {
            width: parseInt((document.getElementById('width') as HTMLInputElement).value),
            height: parseInt((document.getElementById('height') as HTMLInputElement).value),
            resolution: parseFloat((document.getElementById('resolution') as HTMLInputElement).value),
            algorithm: (document.getElementById('algorithm') as HTMLSelectElement).value as any,
            seed: parseInt((document.getElementById('seed') as HTMLInputElement).value),
            octaves: parseInt((document.getElementById('octaves') as HTMLInputElement).value),
            frequency: parseFloat((document.getElementById('frequency') as HTMLInputElement).value),
            amplitude: parseFloat((document.getElementById('amplitude') as HTMLInputElement).value),
            persistence: 0.5,
            lacunarity: 2,
            minHeight: parseFloat((document.getElementById('minHeight') as HTMLInputElement).value),
            maxHeight: parseFloat((document.getElementById('maxHeight') as HTMLInputElement).value),
            smoothing: parseInt((document.getElementById('smoothing') as HTMLInputElement).value)
        };
        
        this.saveToUndo();
        this.heightmap = HeightmapUtils.generateHeightmap(params);
        this.renderHeightmap();
        this.updateMiniMap();
        this.updateStatusBar('New heightmap generated');
    }

    private onMouseDown(e: MouseEvent): void {
        this.isDrawing = true;
        this.lastMousePos = this.getCanvasCoordinates(e);
        this.canvas.style.cursor = 'crosshair';
    }

    private onMouseMove(e: MouseEvent): void {
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

    private onMouseUp(): void {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.canvas.style.cursor = 'crosshair';
            this.saveToUndo();
            this.updateMiniMap();
        }
    }

    private getCanvasCoordinates(e: MouseEvent): { x: number, y: number } {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    private applyBrush(from: { x: number, y: number }, to: { x: number, y: number }): void {
        if (!this.heightmap) return;
        
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
            
            const modification: HeightmapModification = {
                type: this.brushSettings.type,
                x: worldX,
                z: worldZ,
                radius: this.brushSettings.radius,
                intensity: this.brushSettings.intensity,
                falloff: this.brushSettings.falloff
            };
            
            this.heightmap = HeightmapUtils.modifyHeightmap(this.heightmap, modification);
        }
        
        this.renderHeightmap();
    }

    private distance(a: { x: number, y: number }, b: { x: number, y: number }): number {
        return Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));
    }

    private renderHeightmap(): void {
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
                        r = 0; g = Math.floor(100 + normalized * 100); b = 0;
                    } else if (normalized < 0.7) {
                        // Mid areas - standard terrain green
                        r = 0; g = 255; b = 0;
                    } else {
                        // High areas - lighter green
                        r = Math.floor(normalized * 50); g = 255; b = Math.floor(normalized * 50);
                    }
                    
                    const index = (y * canvasWidth + x) * 4;
                    data[index] = r;     // R
                    data[index + 1] = g; // G
                    data[index + 2] = b; // B
                    data[index + 3] = 255; // A
                }
            }
        }
        
        this.ctx.putImageData(imageData, 0, 0);
    }

    private updateMiniMap(): void {
        if (!this.heightmap) return;
        
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
                    data[index] = value;     // R
                    data[index + 1] = value; // G
                    data[index + 2] = value; // B
                    data[index + 3] = 255;   // A
                }
            }
        }
        
        this.miniMapCtx.putImageData(imageData, 0, 0);
    }

    private updateBrushPreview(): void {
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

    private updateTooltip(e: MouseEvent, pos: { x: number, y: number }): void {
        const tooltip = document.getElementById('toolTip');
        if (!tooltip || !this.heightmap || !this.heightmap.heights || this.heightmap.heights.length === 0) return;
        
        try {
            const worldX = (pos.x / this.canvas.width) * this.heightmap.width - this.heightmap.width / 2;
            const worldZ = (pos.y / this.canvas.height) * this.heightmap.height - this.heightmap.height / 2;
            const height = HeightmapUtils.getHeightAt(this.heightmap, worldX, worldZ);
            
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 10) + 'px';
            tooltip.style.top = (e.clientY - 30) + 'px';
            tooltip.textContent = `X: ${worldX.toFixed(1)}, Z: ${worldZ.toFixed(1)}, Height: ${height.toFixed(2)}`;
        } catch (error) {
            console.warn('Error updating tooltip:', error);
            tooltip.style.display = 'none';
        }
    }

    private updateStatusBar(message: string): void {
        const statusBar = document.getElementById('statusBar');
        if (statusBar) {
            statusBar.textContent = message;
        }
    }

    private saveToUndo(): void {
        if (!this.heightmap) return;
        
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

    private undo(): void {
        if (this.undoStack.length === 0) return;
        
        if (this.heightmap) {
            this.redoStack.push(JSON.parse(JSON.stringify(this.heightmap)));
        }
        
        this.heightmap = this.undoStack.pop()!;
        this.renderHeightmap();
        this.updateMiniMap();
        this.updateStatusBar('Undo performed');
        this.updateUndoRedoButtons();
    }

    private redo(): void {
        if (this.redoStack.length === 0) return;
        
        if (this.heightmap) {
            this.undoStack.push(JSON.parse(JSON.stringify(this.heightmap)));
        }
        
        this.heightmap = this.redoStack.pop()!;
        this.renderHeightmap();
        this.updateMiniMap();
        this.updateStatusBar('Redo performed');
        this.updateUndoRedoButtons();
    }

    private updateUndoRedoButtons(): void {
        const undoBtn = document.getElementById('undoBtn') as HTMLButtonElement;
        const redoBtn = document.getElementById('redoBtn') as HTMLButtonElement;
        
        if (undoBtn) undoBtn.disabled = this.undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
    }

    private exportHeightmap(): void {
        if (!this.heightmap) return;
        
        const format = (document.getElementById('exportFormat') as HTMLSelectElement).value as 'json' | 'raw' | 'png';
        
        try {
            const data = HeightmapUtils.exportHeightmap(this.heightmap, format);
            
            if (format === 'json') {
                this.downloadFile(data as string, 'heightmap.json', 'application/json');
            } else if (format === 'raw') {
                this.downloadFile(data as ArrayBuffer, 'heightmap.raw', 'application/octet-stream');
            } else if (format === 'png') {
                this.downloadFile(data as string, 'heightmap.png', 'image/png');
            }
            
            this.updateStatusBar(`Heightmap exported as ${format.toUpperCase()}`);
        } catch (error) {
            this.updateStatusBar(`Export failed: ${error}`);
        }
    }

    private downloadFile(data: string | ArrayBuffer, filename: string, mimeType: string): void {
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

    private importHeightmap(): void {
        const fileInput = document.getElementById('importFile') as HTMLInputElement;
        fileInput.click();
    }

    private onFileImport(e: Event): void {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = event.target?.result;
                if (!data) return;
                
                const format = file.name.endsWith('.json') ? 'json' : 
                             file.name.endsWith('.raw') ? 'raw' : 'png';
                
                let width = 256, height = 256, resolution = 1;
                
                if (format === 'json') {
                    const jsonData = JSON.parse(data as string);
                    width = jsonData.width || 256;
                    height = jsonData.height || 256;
                    resolution = jsonData.resolution || 1;
                }
                
                this.saveToUndo();
                this.heightmap = HeightmapUtils.importHeightmap(data, format, width, height, resolution);
                this.renderHeightmap();
                this.updateMiniMap();
                this.updateStatusBar(`Heightmap imported from ${file.name}`);
                
            } catch (error) {
                this.updateStatusBar(`Import failed: ${error}`);
            }
        };
        
        if (file.name.endsWith('.json')) {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    }

    private saveHeightmap(): void {
        if (!this.heightmap) return;
        
        // Save to localStorage for now
        try {
            localStorage.setItem('terrain_editor_heightmap', JSON.stringify(this.heightmap));
            this.updateStatusBar('Heightmap saved to local storage');
        } catch (error) {
            this.updateStatusBar(`Save failed: ${error}`);
        }
    }

    private toggleWireframe(): void {
        // This would toggle wireframe mode in the 3D view
        this.updateStatusBar('Wireframe mode toggled (3D view only)');
    }

    private resetHeightmap(): void {
        if (confirm('Are you sure you want to reset the heightmap? This cannot be undone.')) {
            this.generateDefaultHeightmap();
            this.undoStack = [];
            this.redoStack = [];
            this.updateUndoRedoButtons();
            this.updateStatusBar('Heightmap reset to default');
        }
    }

    private applyPreset(preset: string): void {
        if (!this.heightmap) return;
        
        this.saveToUndo();
        
        const presets: { [key: string]: HeightmapModification[] } = {
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
                this.heightmap = HeightmapUtils.modifyHeightmap(this.heightmap!, mod);
            }
            this.renderHeightmap();
            this.updateMiniMap();
            this.updateStatusBar(`${preset} preset applied`);
        }
    }

    private onResize(): void {
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

    public getHeightmap(): HeightmapData | null {
        return this.heightmap;
    }
    
    private validateHeightmap(): boolean {
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

    public getTerrainConfig(): TerrainConfig {
        return {
            heightmap: this.heightmap!,
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

// Initialize the editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new TerrainEditor();
});
