import { LightingConfig, EnemyType, CollisionPlaneConfig } from '../shared/types';

interface MobSpawnConfig {
    enabled: boolean;
    weight: number;  // Relative spawn weight (higher = more common)
    minWave: number; // Minimum wave number for this mob to start spawning
}

interface GridConfig {
    size: number;           // Size of the map (MAP_SIZE)
    spawnInterval: number;  // Time between enemy spawns in ms
    enemiesPerWave: number; // Number of enemies per wave
    xpPerWave: number;     // Base XP per wave
    spawnLocations: 'edges' | 'grid' | 'random' | 'terrain'; // Where enemies can spawn
    gridCellSize: number;   // Size of each grid cell (for grid-based spawning)
    gridColor: number;      // Color of the grid lines
}

export class ServerConfig {
    private static instances: Map<string, ServerConfig> = new Map();
    private currentConfig: LightingConfig = {
        ambientLight: {
            color: 0xffffff,
            intensity: 0.7
        },
        directionalLight: {
            color: 0xffffff,
            intensity: 1.0,
            position: {
                x: 5,
                y: 10,
                z: 5
            }
        },
        hemisphereLight: {
            skyColor: 0x87ceeb,    // Sky blue
            groundColor: 0x00ff00,  // Light green
            intensity: 1.0
        },
        skyColor: 0x87ceeb,  // Sky blue
        nightMode: {
            ambientLight: {
                color: 0x404080,    // Dark blue-purple
                intensity: 0.3      // Much dimmer
            },
            directionalLight: {
                color: 0x9090ff,    // Pale blue moonlight
                intensity: 0.4,     // Dimmer than day
                position: {
                    x: -5,          // Moon from opposite side
                    y: 15,          // Higher in sky
                    z: -5
                }
            },
            hemisphereLight: {
                skyColor: 0x1a1a2e,     // Dark navy night sky
                groundColor: 0x00ff00,  // Dark blue-green ground
                intensity: 0.6          // Reduced intensity
            },
            skyColor: 0x1a1a2e      // Dark navy night sky
        },
        collisionPlanes: [
            {
                "x": 40,
                "y": 0,
                "z": 0,
                "width": 80,
                "height": 5,
                "rotationX": 0,
                "rotationY": 90,
                "rotationZ": 0,
                "type": "wall"
              },
              {
                "x": 0,
                "y": 0,
                "z": 40,
                "width": 80,
                "height": 5,
                "rotationX": 0,
                "rotationY": 180,
                "rotationZ": 0,
                "type": "wall"
              },
              {
                "x": 0,
                "y": 0,
                "z": -40,
                "width": 80,
                "height": 5,
                "rotationX": 0,
                "rotationY": 0,
                "rotationZ": 0,
                "type": "wall"
              },
              {
                "x": -40,
                "y": 0,
                "z": 0,
                "width": 80,
                "height": 5,
                "rotationX": 0,
                "rotationY": 270,
                "rotationZ": 0,
                "type": "wall"
              },
              {
                "x": -20,
                "y": 1.1,
                "z": 0,
                "width": 10,
                "height": 5,
                "rotationX": 90,
                "rotationY": 30,
                "rotationZ": 90,
                "type": "terrain"
              },
              {
                "x": -20,
                "y": 0.5,
                "z": -20,
                "width": 5,
                "height": 5,
                "rotationX": 90,
                "rotationY": 0,
                "rotationZ": 90,
                "type": "terrain"
              },
              {
                "x": -18,
                "y": 0.5,
                "z": -20,
                "width": 5,
                "height": 5,
                "rotationX": 90,
                "rotationY": -30,
                "rotationZ": 90,
                "type": "terrain"
              },
              {
                "x": -22,
                "y": 0.5,
                "z": -20,
                "width": 5,
                "height": 5,
                "rotationX": 90,
                "rotationY": 30,
                "rotationZ": 90,
                "type": "terrain"
              },
              {
                "x": 30,
                "y": -0.5,
                "z": 30,
                "width": 10,
                "height": 10,
                "rotationX": 45,
                "rotationY": 270,
                "rotationZ": 90,
                "type": "wall"
              },
              {
                "x": 30,
                "y": -0.5,
                "z": 30,
                "width": 10,
                "height": 10,
                "rotationX": 45,
                "rotationY": 45,
                "rotationZ": 45,
                "type": "wall"
              },
              {
                "x": 0,
                "y": -0.5,
                "z": 0,
                "width": 80,
                "height": 80,
                "rotationX": 90,
                "rotationY": 0,
                "rotationZ": 90,
                "type": "terrain"
              },
              {
                "x": -20,
                "y": -0.5,
                "z": 30,
                "width": 10,
                "height": 10,
                "rotationX": 45,
                "rotationY": 45,
                "rotationZ": 45,
                "type": "terrain"
              },
              {
                "x": -20,
                "y": 2.5,
                "z": 32,
                "width": 10,
                "height": 10,
                "rotationX": 45,
                "rotationY": 45,
                "rotationZ": 45,
                "type": "terrain"
              },
              {
                "x": -16.5,
                "y": 8.5,
                "z": 32,
                "width": 10,
                "height": 10,
                "rotationX": 45,
                "rotationY": 45,
                "rotationZ": 45,
                "type": "terrain"
              },
              {
                "x": 20,
                "y": 0.5,
                "z": -20,
                "width": 10,
                "height": 5,
                "rotationX": 120,
                "rotationY": 1,
                "rotationZ": 60,
                "type": "terrain"
              },
              {
                "x": 20,
                "y": 3.5,
                "z": -25,
                "width": 10,
                "height": 5,
                "rotationX": 120,
                "rotationY": 1,
                "rotationZ": 60,
                "type": "terrain"
              },
        ]
    };

    private mobConfig: Record<EnemyType, MobSpawnConfig> = {
        ladybug: {
            enabled: true,
            weight: 35,
            minWave: 1
        },
        bee: {
            enabled: true,
            weight: 20,
            minWave: 1
        },
        centipede: {
            enabled: true,
            weight: 25,
            minWave: 1
        },
        centipede_segment: {
            enabled: false, // This is not directly spawnable
            weight: 0,
            minWave: 1
        },
        spider: {
            enabled: true,
            weight: 15,
            minWave: 5
        },
        soldier_ant: {
            enabled: true,
            weight: 10,
            minWave: 5
        },
        worker_ant: {
            enabled: true,
            weight: 10,
            minWave: 1
        },
        baby_ant: {
            enabled: true,
            weight: 15,
            minWave: 1
        }
    };

    private gridConfig: GridConfig = {
        size: 15,
        spawnInterval: 1000,
        enemiesPerWave: 20,
        xpPerWave: 1000,
        spawnLocations: 'terrain',
        gridCellSize: 1,
        gridColor: 0x038f21  // Default gray color for grid
    };

    private constructor(configType: string) {
        if (configType === 'ant_hell') {
            // Ant Hell configuration
            this.gridConfig = {
                size: 30,               // Larger map
                spawnInterval: 500,     // Faster spawns
                enemiesPerWave: 40,     // More enemies
                xpPerWave: 2000,        // More XP
                spawnLocations: 'grid', // Grid-based spawning
                gridCellSize: 5,        // 5x5 grid cells
                gridColor: 0x4a2810     // Dark brown grid for ant hell
            };

            // Modify mob configuration for Ant Hell
            this.mobConfig = {
                ...this.mobConfig,
                soldier_ant: {
                    enabled: true,
                    weight: 30,    // Higher weight for soldier ants
                    minWave: 1     // Available from start
                },
                worker_ant: {
                    enabled: true,
                    weight: 30,    // Higher weight for worker ants
                    minWave: 1
                },
                baby_ant: {
                    enabled: true,
                    weight: 20,    // Higher weight for baby ants
                    minWave: 1
                },
                spider: {
                    enabled: false, // Disable non-ant enemies
                    weight: 0,
                    minWave: 999
                },
                ladybug: {
                    enabled: false,
                    weight: 0,
                    minWave: 999
                },
                bee: {
                    enabled: false,
                    weight: 0,
                    minWave: 999
                },
                centipede: {
                    enabled: false,
                    weight: 0,
                    minWave: 999
                },
                centipede_segment: {
                    enabled: false,
                    weight: 0,
                    minWave: 999
                }
            };

            // Darker, more underground-like lighting and more complex collision planes
            this.currentConfig = {
                ambientLight: {
                    color: 0xffffff,
                    intensity: 0.5
                },
                directionalLight: {
                    color: 0xffffff,
                    intensity: 0.7,
                    position: {
                        x: 5,
                        y: 10,
                        z: 5
                    }
                },
                hemisphereLight: {
                    skyColor: 0xa15402,    // Dark gray
                    groundColor: 0xa15402, // Dark brown
                    intensity: 0.8
                },
                skyColor: 0xa15402,  // Dark gray
                nightMode: {
                    ambientLight: {
                        color: 0x2a1a0a,    // Very dark brown
                        intensity: 0.2      // Very dim
                    },
                    directionalLight: {
                        color: 0x6a4a2a,    // Dark orange moonlight
                        intensity: 0.3,     // Very dim
                        position: {
                            x: -5,
                            y: 20,
                            z: -5
                        }
                    },
                    hemisphereLight: {
                        skyColor: 0x0a0a0a,     // Almost black sky
                        groundColor: 0x2a1a0a,  // Very dark brown ground
                        intensity: 0.4          // Very reduced intensity
                    },
                    skyColor: 0x0a0a0a      // Almost black sky
                },
                collisionPlanes: [
                    
                ]
            };
        }
    }

    public static getInstance(configType: string = 'default'): ServerConfig {
        if (!ServerConfig.instances.has(configType)) {
            ServerConfig.instances.set(configType, new ServerConfig(configType));
        }
        return ServerConfig.instances.get(configType)!;
    }

    public getCurrentConfig(): LightingConfig {
        return this.currentConfig;
    }

    public updateConfig(newConfig: Partial<LightingConfig>): LightingConfig {
        // Deep merge the new config with the current config
        this.currentConfig = {
            ...this.currentConfig,
            ambientLight: {
                ...this.currentConfig.ambientLight,
                ...(newConfig.ambientLight || {})
            },
            directionalLight: {
                ...this.currentConfig.directionalLight,
                ...(newConfig.directionalLight || {}),
                position: {
                    ...this.currentConfig.directionalLight.position,
                    ...(newConfig.directionalLight?.position || {})
                }
            },
            hemisphereLight: {
                ...this.currentConfig.hemisphereLight,
                ...(newConfig.hemisphereLight || {})
            },
            skyColor: newConfig.skyColor || this.currentConfig.skyColor
        };

        return this.currentConfig;
    }

    public setSkyColor(color: number): void {
        this.currentConfig.skyColor = color;
        this.currentConfig.hemisphereLight.skyColor = color;
    }

    public setGroundColor(color: number): void {
        this.currentConfig.hemisphereLight.groundColor = color;
    }

    public setLightIntensity(type: 'ambient' | 'directional' | 'hemisphere', intensity: number): void {
        switch (type) {
            case 'ambient':
                this.currentConfig.ambientLight.intensity = intensity;
                break;
            case 'directional':
                this.currentConfig.directionalLight.intensity = intensity;
                break;
            case 'hemisphere':
                this.currentConfig.hemisphereLight.intensity = intensity;
                break;
        }
    }

    public setLightColor(type: 'ambient' | 'directional', color: number): void {
        switch (type) {
            case 'ambient':
                this.currentConfig.ambientLight.color = color;
                break;
            case 'directional':
                this.currentConfig.directionalLight.color = color;
                break;
        }
    }

    public setDirectionalLightPosition(x: number, y: number, z: number): void {
        this.currentConfig.directionalLight.position = { x, y, z };
    }

    // Night mode lighting methods
    public setNightSkyColor(color: number): void {
        this.currentConfig.nightMode.skyColor = color;
        this.currentConfig.nightMode.hemisphereLight.skyColor = color;
    }

    public setNightGroundColor(color: number): void {
        this.currentConfig.nightMode.hemisphereLight.groundColor = color;
    }

    public setNightLightIntensity(type: 'ambient' | 'directional' | 'hemisphere', intensity: number): void {
        switch (type) {
            case 'ambient':
                this.currentConfig.nightMode.ambientLight.intensity = intensity;
                break;
            case 'directional':
                this.currentConfig.nightMode.directionalLight.intensity = intensity;
                break;
            case 'hemisphere':
                this.currentConfig.nightMode.hemisphereLight.intensity = intensity;
                break;
        }
    }

    public setNightLightColor(type: 'ambient' | 'directional', color: number): void {
        switch (type) {
            case 'ambient':
                this.currentConfig.nightMode.ambientLight.color = color;
                break;
            case 'directional':
                this.currentConfig.nightMode.directionalLight.color = color;
                break;
        }
    }

    public setNightDirectionalLightPosition(x: number, y: number, z: number): void {
        this.currentConfig.nightMode.directionalLight.position = { x, y, z };
    }

    // Get lighting config for specific time of day
    public getLightingConfig(isNight: boolean): LightingConfig {
        if (isNight) {
            // Return config with night mode lighting applied
            return {
                ...this.currentConfig,
                ambientLight: this.currentConfig.nightMode.ambientLight,
                directionalLight: this.currentConfig.nightMode.directionalLight,
                hemisphereLight: this.currentConfig.nightMode.hemisphereLight,
                skyColor: this.currentConfig.nightMode.skyColor
            };
        } else {
            // Return normal day config
            return this.currentConfig;
        }
    }

    // Mob configuration methods
    public getMobConfig(): Record<EnemyType, MobSpawnConfig> {
        return this.mobConfig;
    }

    public setMobEnabled(type: EnemyType, enabled: boolean): void {
        if (type !== 'centipede_segment') { // Prevent enabling direct spawning of segments
            this.mobConfig[type].enabled = enabled;
        }
    }

    public setMobWeight(type: EnemyType, weight: number): void {
        if (weight >= 0 && type !== 'centipede_segment') {
            this.mobConfig[type].weight = weight;
        }
    }

    public setMobMinWave(type: EnemyType, wave: number): void {
        if (wave >= 1 && type !== 'centipede_segment') {
            this.mobConfig[type].minWave = wave;
        }
    }

    public getSpawnableMobs(currentWave: number): EnemyType[] {
        const spawnable: EnemyType[] = [];
        let totalWeight = 0;

        // First, get all eligible mobs and their total weight
        for (const [type, config] of Object.entries(this.mobConfig)) {
            if (config.enabled && config.weight > 0 && 
                config.minWave <= currentWave && 
                type !== 'centipede_segment') {
                spawnable.push(type as EnemyType);
                totalWeight += config.weight;
            }
        }

        return spawnable;
    }

    public getRandomMobType(currentWave: number, isNight?: boolean): EnemyType {
        const spawnable: EnemyType[] = [];
        const weights: number[] = [];
        let totalWeight = 0;

        // Night-only mobs
        const nightOnlyMobs: EnemyType[] = ['spider', 'soldier_ant'];

        // First, get all eligible mobs and their total weight
        for (const [type, config] of Object.entries(this.mobConfig)) {
            if (config.enabled && config.weight > 0 && 
                config.minWave <= currentWave && 
                type !== 'centipede_segment') {
                
                const mobType = type as EnemyType;
                
                // Apply night mode restrictions
                if (isNight !== undefined) {
                    if (isNight) {
                        // Night mode: only allow night-only mobs and general mobs
                        // For now, we'll allow all mobs during night but give preference to night-only mobs
                        if (nightOnlyMobs.includes(mobType)) {
                            // Give night-only mobs 3x weight during night
                            spawnable.push(mobType);
                            weights.push(config.weight * 3);
                            totalWeight += config.weight * 3;
                        } else {
                            // Regular mobs get normal weight during night
                            spawnable.push(mobType);
                            weights.push(config.weight);
                            totalWeight += config.weight;
                        }
                    } else {
                        // Day mode: exclude night-only mobs
                        if (!nightOnlyMobs.includes(mobType)) {
                            spawnable.push(mobType);
                            weights.push(config.weight);
                            totalWeight += config.weight;
                        }
                    }
                } else {
                    // No night mode specified, use normal logic
                    spawnable.push(mobType);
                    weights.push(config.weight);
                    totalWeight += config.weight;
                }
            }
        }

        // If no mobs are available, return ladybug as fallback
        if (spawnable.length === 0) {
            return 'ladybug';
        }

        // Random weighted selection
        let random = Math.random() * totalWeight;
        for (let i = 0; i < spawnable.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return spawnable[i];
            }
        }

        return spawnable[0]; // Fallback to first available mob
    }

    // Grid configuration methods
    public getGridConfig(): GridConfig {
        return this.gridConfig;
    }

    public updateGridConfig(newConfig: Partial<GridConfig>): void {
        this.gridConfig = {
            ...this.gridConfig,
            ...newConfig
        };
    }

    public setGridColor(color: number): void {
        this.gridConfig.gridColor = color;
    }

    public setSpawnLocations(spawnType: 'edges' | 'grid' | 'random' | 'terrain'): void {
        this.gridConfig.spawnLocations = spawnType;
    }

    private getRandomTerrainPosition(): { x: number; y: number; z: number } {
        const terrainPlanes = this.currentConfig.collisionPlanes.filter(plane => plane.type === 'terrain');
        
        if (terrainPlanes.length === 0) {
            // Fallback to random spawning if no terrain defined
            const size = this.gridConfig.size;
            return {
                x: (Math.random() * 2 - 1) * size,
                y: 0,
                z: (Math.random() * 2 - 1) * size
            };
        }

        // Randomly select a terrain plane
        const randomPlane = terrainPlanes[Math.floor(Math.random() * terrainPlanes.length)];
        
        // Generate a random position within the terrain plane bounds
        const halfWidth = randomPlane.width / 2;
        const halfHeight = randomPlane.height / 2;
        
        // Random position in local coordinates relative to the plane center
        const localX = (Math.random() * 2 - 1) * halfWidth * 0.8; // Use 80% of plane to avoid edges
        const localY = (Math.random() * 2 - 1) * halfHeight * 0.8;
        
        // Transform local coordinates to world coordinates
        // This is a simplified transformation that assumes the plane rotations
        const radX = randomPlane.rotationX * Math.PI / 180;
        const radY = randomPlane.rotationY * Math.PI / 180;
        const radZ = randomPlane.rotationZ * Math.PI / 180;
        
        const cosX = Math.cos(radX), sinX = Math.sin(radX);
        const cosY = Math.cos(radY), sinY = Math.sin(radY);
        const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);
        
        // Apply rotations: Z -> Y -> X (reverse order)
        let x = localX, y = localY, z = 0;
        
        // X rotation
        let tempY = y * cosX - z * sinX;
        z = y * sinX + z * cosX;
        y = tempY;
        
        // Y rotation
        let tempX = x * cosY + z * sinY;
        z = -x * sinY + z * cosY;
        x = tempX;
        
        // Z rotation
        tempX = x * cosZ - y * sinZ;
        y = x * sinZ + y * cosZ;
        x = tempX;
        
        // Translate to world position
        return {
            x: x + randomPlane.x,
            y: y + randomPlane.y,
            z: z + randomPlane.z
        };
    }

    public getSpawnPosition(): { x: number; y: number; z: number } {
        const size = this.gridConfig.size;
        
        switch (this.gridConfig.spawnLocations) {
            case 'terrain': {
                return this.getRandomTerrainPosition();
            }
            case 'grid': {
                // Get random grid cell
                const cellSize = this.gridConfig.gridCellSize;
                const gridSize = Math.floor(size / cellSize);
                const gridX = Math.floor(Math.random() * gridSize) - Math.floor(gridSize / 2);
                const gridZ = Math.floor(Math.random() * gridSize) - Math.floor(gridSize / 2);
                
                // Add some random offset within the cell
                const offsetX = (Math.random() - 0.5) * cellSize;
                const offsetZ = (Math.random() - 0.5) * cellSize;
                
                return {
                    x: (gridX * cellSize) + offsetX,
                    y: 0,
                    z: (gridZ * cellSize) + offsetZ
                };
            }
            case 'edges': {
                // Original edge spawning logic
                const edge = Math.floor(Math.random() * 4);
                let x, z;
                switch (edge) {
                    case 0: x = -size; z = (Math.random() * 2 - 1) * size; break;
                    case 1: x = size; z = (Math.random() * 2 - 1) * size; break;
                    case 2: x = (Math.random() * 2 - 1) * size; z = -size; break;
                    case 3: x = (Math.random() * 2 - 1) * size; z = size; break;
                    default: x = -size; z = -size;
                }
                return { x, y: 0, z };
            }
            case 'random':
            default: {
                // Completely random position within map bounds
                return {
                    x: (Math.random() * 2 - 1) * size,
                    y: 0,
                    z: (Math.random() * 2 - 1) * size
                };
            }
        }
    }

    public updateCollisionPlanes(planes: CollisionPlaneConfig[]): void {
        console.log('Server updating collision planes:', planes);
        this.currentConfig.collisionPlanes = planes;
    }

    public getCollisionPlanes(): CollisionPlaneConfig[] {
        console.log('Server getting collision planes:', this.currentConfig.collisionPlanes);
        return this.currentConfig.collisionPlanes;
    }
} 