import * as THREE from 'three';
import { HeightmapData, TerrainConfig, HeightmapGenerationParams, HeightmapModification, TerrainCollision } from '../../shared/types';
import { HeightmapUtils } from '../../shared/heightmap';

export class TerrainManager {
    private scene: THREE.Scene;
    private heightmap: HeightmapData | null = null;
    private terrainMesh: THREE.Mesh | null = null;
    private terrainGeometry: THREE.BufferGeometry | null = null;
    private terrainMaterial: THREE.Material | null = null;
    private chunks: Map<string, THREE.Mesh> = new Map();
    private config: TerrainConfig;
    private isInitialized: boolean = false;

    constructor(scene: THREE.Scene, config?: Partial<TerrainConfig>) {
        this.scene = scene;
        this.config = {
            heightmap: {
                width: 100,
                height: 100,
                resolution: 1,
                heights: [],
                minHeight: -3,
                maxHeight: 3
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
            console.log('No heightmap found, generating default...');
            this.heightmap = HeightmapUtils.generateHeightmap({
                width: this.config.heightmap.width,
                height: this.config.heightmap.height,
                resolution: this.config.heightmap.resolution,
                algorithm: 'perlin',
                seed: Math.random(),
                octaves: 4,
                frequency: 0.05,
                amplitude: 1,
                persistence: 0.5,
                lacunarity: 2,
                minHeight: this.config.heightmap.minHeight,
                maxHeight: this.config.heightmap.maxHeight,
                smoothing: 1
            });
            
            console.log('Generated default heightmap:', this.heightmap);
        }
        
        // Force regenerate heightmap if it's empty
        if (!this.heightmap.heights || this.heightmap.heights.length === 0 || this.heightmap.heights[0].length === 0) {
            console.log('Heightmap is empty, regenerating...');
            this.heightmap = HeightmapUtils.generateHeightmap({
                width: 30,
                height: 30,
                resolution: 1,
                algorithm: 'perlin',
                seed: 12345,
                octaves: 4,
                frequency: 0.05,
                amplitude: 1,
                persistence: 0.5,
                lacunarity: 2,
                minHeight: -3,
                maxHeight: 3,
                smoothing: 1
            });
            console.log('Regenerated heightmap:', this.heightmap);
        }
        
        // Test HeightmapUtils directly
        console.log('Testing HeightmapUtils...');
        try {
            const testHeightmap = HeightmapUtils.generateHeightmap({
                width: 10,
                height: 10,
                resolution: 1,
                algorithm: 'perlin',
                seed: 12345,
                octaves: 2,
                frequency: 0.1,
                amplitude: 1,
                persistence: 0.5,
                lacunarity: 2,
                minHeight: -1,
                maxHeight: 1,
                smoothing: 1
            });
            console.log('Test heightmap:', testHeightmap);
            console.log('Test heights array:', testHeightmap.heights);
            console.log('Test heights[0][0]:', testHeightmap.heights[0]?.[0]);
            console.log('Test heights array length:', testHeightmap.heights.length);
            console.log('Test heights[0] length:', testHeightmap.heights[0]?.length);
        } catch (error) {
            console.error('Error testing HeightmapUtils:', error);
        }

        await this.createTerrain();
        this.isInitialized = true;
    }

    private async createTerrain(): Promise<void> {
        if (!this.heightmap) return;

        // Create terrain geometry
        this.terrainGeometry = this.createTerrainGeometry();
        
        // Create terrain material
        this.terrainMaterial = this.createTerrainMaterial();
        
        // Create terrain mesh
        this.terrainMesh = new THREE.Mesh(this.terrainGeometry, this.terrainMaterial);
        this.terrainMesh.name = 'terrain';
        this.terrainMesh.receiveShadow = true;
        this.terrainMesh.castShadow = true;
        
        // Position terrain at origin and ensure proper scale
        this.terrainMesh.position.set(0, 0, 0);
        
        // Make sure the mesh is visible
        this.terrainMesh.visible = true;
        
        // Add to scene
        this.scene.add(this.terrainMesh);
        

        
        console.log('Terrain created:', {
            geometry: this.terrainGeometry,
            material: this.terrainMaterial,
            mesh: this.terrainMesh,
            meshVisible: this.terrainMesh.visible,
            meshPosition: this.terrainMesh.position,
            heightmap: this.heightmap
        });
        
        // Log the actual mesh in scene
        console.log('Scene children count:', this.scene.children.length);
        console.log('Scene children:', this.scene.children.map(child => ({ name: child.name, type: child.type, visible: child.visible })));
        
        // Create collision geometry if enabled
        if (this.config.collision.enabled) {
            this.createCollisionGeometry();
        }
    }

    private createTerrainGeometry(): THREE.BufferGeometry {
        if (!this.heightmap) {
            throw new Error('Heightmap not initialized');
        }

        const { width, height, resolution, heights } = this.heightmap;
        const gridWidth = heights[0].length;
        const gridHeight = heights.length;
        
        console.log('Creating terrain geometry:', {
            width, height, resolution, gridWidth, gridHeight,
            heightsLength: heights.length,
            firstRowLength: heights[0]?.length,
            sampleHeight: heights[0]?.[0]
        });
        
        const vertices: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];
        
        // Generate vertices
        for (let z = 0; z < gridHeight; z++) {
            for (let x = 0; x < gridWidth; x++) {
                const worldX = x * resolution - width / 2;
                const worldZ = z * resolution - height / 2;
                // Scale the height to match the center grid tile dimensions
                const worldY = heights[z][x] * 2; // Scale height by 2x to make it more visible
                
                vertices.push(worldX, worldY, worldZ);
                
                // Calculate normal
                const normal = HeightmapUtils.getNormalAt(this.heightmap!, worldX, worldZ);
                normals.push(normal.x, normal.y, normal.z);
                
                // UV coordinates
                uvs.push(x / (gridWidth - 1), z / (gridHeight - 1));
            }
        }
        
        // Generate indices for triangles
        for (let z = 0; z < gridHeight - 1; z++) {
            for (let x = 0; x < gridWidth - 1; x++) {
                const topLeft = z * gridWidth + x;
                const topRight = topLeft + 1;
                const bottomLeft = (z + 1) * gridWidth + x;
                const bottomRight = bottomLeft + 1;
                
                // First triangle
                indices.push(topLeft, bottomLeft, topRight);
                // Second triangle
                indices.push(topRight, bottomLeft, bottomRight);
            }
        }
        
        console.log('Geometry data:', {
            verticesCount: vertices.length / 3,
            normalsCount: normals.length / 3,
            uvsCount: uvs.length / 2,
            indicesCount: indices.length,
            sampleVertices: vertices.slice(0, 9),
            sampleIndices: indices.slice(0, 6)
        });
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        
        return geometry;
    }

    private createTerrainMaterial(): THREE.Material {
        const { material } = this.config;
        
        // Use the same color as terrain planes (green with transparency)
        const terrainColor = 0x00ff00; // Green color matching terrain planes
        
        switch (material.type) {
            case 'basic':
                return new THREE.MeshBasicMaterial({
                    color: terrainColor,
                    wireframe: this.config.rendering.wireframe,
                    transparent: true,
                    opacity: 0.8
                });
            
            case 'phong':
                return new THREE.MeshPhongMaterial({
                    color: terrainColor,
                    wireframe: this.config.rendering.wireframe,
                    shininess: 30,
                    transparent: true,
                    opacity: 0.8
                });
            
            case 'standard':
                return new THREE.MeshStandardMaterial({
                    color: terrainColor,
                    wireframe: this.config.rendering.wireframe,
                    roughness: material.roughness,
                    metalness: material.metalness,
                    transparent: true,
                    opacity: 0.8
                });
            
            default:
                return new THREE.MeshPhongMaterial({
                    color: terrainColor,
                    wireframe: this.config.rendering.wireframe,
                    transparent: true,
                    opacity: 0.8
                });
        }
    }

    private createCollisionGeometry(): void {
        if (!this.terrainMesh || !this.heightmap) return;
        
        // Create collision geometry for physics
        const collisionGeometry = this.terrainGeometry!.clone();
        collisionGeometry.computeBoundingBox();
        
        // Store collision data for runtime collision detection
        this.terrainMesh.userData.collisionGeometry = collisionGeometry;
        this.terrainMesh.userData.heightmap = this.heightmap;
    }

    generateHeightmap(params: HeightmapGenerationParams): void {
        this.heightmap = HeightmapUtils.generateHeightmap(params);
        this.recreateTerrain();
    }

    modifyHeightmap(modification: HeightmapModification): void {
        if (!this.heightmap) return;
        
        this.heightmap = HeightmapUtils.modifyHeightmap(this.heightmap, modification);
        this.recreateTerrain();
    }

    private recreateTerrain(): void {
        if (this.terrainMesh) {
            this.scene.remove(this.terrainMesh);
            this.terrainMesh.geometry.dispose();
            if (this.terrainMaterial) {
                this.terrainMaterial.dispose();
            }
        }
        
        this.createTerrain();
    }

    getHeightAt(worldX: number, worldZ: number): number {
        if (!this.heightmap) return 0;
        return HeightmapUtils.getHeightAt(this.heightmap, worldX, worldZ);
    }

    getNormalAt(worldX: number, worldZ: number): { x: number, y: number, z: number } {
        if (!this.heightmap) return { x: 0, y: 1, z: 0 };
        return HeightmapUtils.getNormalAt(this.heightmap, worldX, worldZ);
    }

    checkCollision(position: THREE.Vector3, radius: number = 0.1): TerrainCollision | null {
        if (!this.heightmap || !this.config.collision.enabled) return null;
        
        const height = this.getHeightAt(position.x, position.z);
        const normal = this.getNormalAt(position.x, position.z);
        
        // Check if object is below terrain
        if (position.y < height + radius) {
            const slope = Math.atan2(Math.sqrt(normal.x * normal.x + normal.z * normal.z), normal.y);
            
            return {
                position: new THREE.Vector3(position.x, height, position.z),
                normal: new THREE.Vector3(normal.x, normal.y, normal.z),
                height,
                slope
            };
        }
        
        return null;
    }

    applyTerrainCollision(object: THREE.Object3D, radius: number = 0.1): void {
        if (!this.config.collision.enabled) return;
        
        const collision = this.checkCollision(object.position, radius);
        if (collision) {
            // Snap to terrain surface
            object.position.y = collision.position.y + radius;
            
            // Apply slope-based movement restrictions
            const maxSlope = Math.PI / 4; // 45 degrees
            if (collision.slope > maxSlope) {
                // Prevent movement up steep slopes
                const slopeNormal = new THREE.Vector3(collision.normal.x, 0, collision.normal.z).normalize();
                const velocity = object.userData.velocity as THREE.Vector3;
                if (velocity) {
                    const dot = velocity.dot(slopeNormal);
                    if (dot < 0) {
                        velocity.addScaledVector(slopeNormal, -dot);
                    }
                }
            }
        }
    }

    updateChunks(cameraPosition: THREE.Vector3): void {
        if (!this.config.rendering.chunkSize || !this.heightmap) return;
        
        // Validate heightmap data before proceeding
        if (!this.heightmap.heights || this.heightmap.heights.length === 0 || this.heightmap.heights[0].length === 0) {
            console.warn('Cannot update chunks: invalid heightmap data');
            return;
        }
        
        const chunkSize = this.config.rendering.chunkSize;
        const maxChunks = this.config.rendering.maxChunks;
        
        // Calculate visible chunks based on camera position
        const cameraChunkX = Math.floor(cameraPosition.x / chunkSize);
        const cameraChunkZ = Math.floor(cameraPosition.z / chunkSize);
        
        // Remove distant chunks
        for (const [key, chunk] of this.chunks.entries()) {
            const [chunkX, chunkZ] = key.split(',').map(Number);
            const distance = Math.sqrt(
                Math.pow(chunkX - cameraChunkX, 2) + 
                Math.pow(chunkZ - cameraChunkZ, 2)
            );
            
            if (distance > maxChunks / 2) {
                this.scene.remove(chunk);
                chunk.geometry.dispose();
                if (chunk.material) {
                    if (Array.isArray(chunk.material)) {
                        chunk.material.forEach(mat => mat.dispose());
                    } else {
                        chunk.material.dispose();
                    }
                }
                this.chunks.delete(key);
            }
        }
        
        // Add nearby chunks
        for (let dz = -maxChunks / 2; dz <= maxChunks / 2; dz++) {
            for (let dx = -maxChunks / 2; dx <= maxChunks / 2; dx++) {
                const chunkX = cameraChunkX + dx;
                const chunkZ = cameraChunkZ + dz;
                const key = `${chunkX},${chunkZ}`;
                
                if (!this.chunks.has(key)) {
                    try {
                        const chunk = this.createChunk(chunkX, chunkZ, chunkSize);
                        if (chunk) {
                            this.chunks.set(key, chunk);
                            this.scene.add(chunk);
                        }
                    } catch (error) {
                        console.warn(`Failed to create chunk at (${chunkX}, ${chunkZ}):`, error);
                    }
                }
            }
        }
    }

    private createChunk(chunkX: number, chunkZ: number, chunkSize: number): THREE.Mesh | null {
        if (!this.heightmap) {
            console.warn('Cannot create chunk: no heightmap data');
            return null;
        }
        
        // Validate heightmap data
        if (!this.heightmap.heights || this.heightmap.heights.length === 0 || this.heightmap.heights[0].length === 0) {
            console.warn('Cannot create chunk: invalid heightmap heights data');
            return null;
        }
        
        try {
            const chunk = HeightmapUtils.createChunk(this.heightmap, chunkX, chunkZ, chunkSize);
            if (!chunk || chunk.heights.length === 0 || chunk.heights[0].length === 0) {
                console.warn(`Chunk at (${chunkX}, ${chunkZ}) has no valid height data`);
                return null;
            }
            
            // Create chunk geometry
            const geometry = this.createChunkGeometry(chunk);
            const material = this.terrainMaterial?.clone() || this.createTerrainMaterial();
            
            const mesh = new THREE.Mesh(geometry, material);
            
            // Position chunk correctly in world space
            const worldX = chunkX * chunkSize - (this.heightmap!.width / 2);
            const worldZ = chunkZ * chunkSize - (this.heightmap!.height / 2);
            mesh.position.set(worldX, 0, worldZ);
            
            mesh.name = `terrain_chunk_${chunkX}_${chunkZ}`;
            mesh.receiveShadow = true;
            mesh.castShadow = true;
            
            return mesh;
        } catch (error) {
            console.error(`Error creating chunk at (${chunkX}, ${chunkZ}):`, error);
            return null;
        }
    }

    private createChunkGeometry(chunk: any): THREE.BufferGeometry {
        const { width, height, heights } = chunk;
        const resolution = this.heightmap!.resolution;
        
        const vertices: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];
        const indices: number[] = [];
        
        // Generate vertices for chunk
        for (let z = 0; z < height; z++) {
            for (let x = 0; x < width; x++) {
                const worldX = x * resolution;
                const worldZ = z * resolution;
                const worldY = heights[z][x];
                
                vertices.push(worldX, worldY, worldZ);
                
                // Calculate normal
                const normal = HeightmapUtils.getNormalAt(this.heightmap!, worldX, worldZ);
                normals.push(normal.x, normal.y, normal.z);
                
                // UV coordinates
                uvs.push(x / (width - 1), z / (height - 1));
            }
        }
        
        // Generate indices
        for (let z = 0; z < height - 1; z++) {
            for (let x = 0; x < width - 1; x++) {
                const topLeft = z * width + x;
                const topRight = topLeft + 1;
                const bottomLeft = (z + 1) * width + x;
                const bottomRight = bottomLeft + 1;
                
                indices.push(topLeft, bottomLeft, topRight);
                indices.push(topRight, bottomLeft, bottomRight);
            }
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        
        return geometry;
    }

    setMaterial(material: Partial<TerrainConfig['material']>): void {
        this.config.material = { ...this.config.material, ...material };
        
        if (this.terrainMaterial) {
            this.terrainMaterial.dispose();
        }
        
        this.terrainMaterial = this.createTerrainMaterial();
        
        if (this.terrainMesh) {
            this.terrainMesh.material = this.terrainMaterial;
        }
        
        // Update chunk materials
        for (const chunk of this.chunks.values()) {
            if (chunk.material) {
                if (Array.isArray(chunk.material)) {
                    chunk.material.forEach(mat => mat.dispose());
                } else {
                    chunk.material.dispose();
                }
            }
            chunk.material = this.terrainMaterial!.clone();
        }
    }

    toggleWireframe(): void {
        this.config.rendering.wireframe = !this.config.rendering.wireframe;
        
        if (this.terrainMaterial) {
            (this.terrainMaterial as any).wireframe = this.config.rendering.wireframe;
        }
        
        for (const chunk of this.chunks.values()) {
            if (chunk.material) {
                if (Array.isArray(chunk.material)) {
                    chunk.material.forEach(mat => (mat as any).wireframe = this.config.rendering.wireframe);
                } else {
                    (chunk.material as any).wireframe = this.config.rendering.wireframe;
                }
            }
        }
    }

    exportHeightmap(format: 'json' | 'raw' | 'png'): string | ArrayBuffer {
        if (!this.heightmap) throw new Error('No heightmap to export');
        return HeightmapUtils.exportHeightmap(this.heightmap, format);
    }

    importHeightmap(data: string | ArrayBuffer, format: 'json' | 'raw' | 'png', width: number, height: number, resolution: number): void {
        this.heightmap = HeightmapUtils.importHeightmap(data, format, width, height, resolution);
        this.recreateTerrain();
    }

    getHeightmap(): HeightmapData | null {
        return this.heightmap;
    }

    getConfig(): TerrainConfig {
        return { ...this.config };
    }

    dispose(): void {
        if (this.terrainMesh) {
            this.scene.remove(this.terrainMesh);
            this.terrainMesh.geometry.dispose();
            if (this.terrainMesh.material) {
                if (Array.isArray(this.terrainMesh.material)) {
                    this.terrainMesh.material.forEach(mat => mat.dispose());
                } else {
                    this.terrainMesh.material.dispose();
                }
            }
        }
        
        for (const chunk of this.chunks.values()) {
            this.scene.remove(chunk);
            chunk.geometry.dispose();
            if (chunk.material) {
                if (Array.isArray(chunk.material)) {
                    chunk.material.forEach(mat => mat.dispose());
                } else {
                    chunk.material.dispose();
                }
            }
        }
        
        this.chunks.clear();
        this.isInitialized = false;
    }
}
