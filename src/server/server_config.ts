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
    spawnLocations: 'edges' | 'grid' | 'random'; // Where enemies can spawn
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
        collisionPlanes: [
            { x: 5, z: 0, width: 5, height: 10, rotation: 2 },
            { x: -5, z: -5, width: 2, height: 10, rotation: 0 },
            { x: 0, z: -8, width: 10, height: 2, rotation: 0 }
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
        spawnLocations: 'edges',
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
                collisionPlanes: [
                    // Create a maze-like structure
                    { x: 0, z: 0, width: 20, height: 2, rotation: 0 },    // Center wall
                    { x: 0, z: 0, width: 2, height: 20, rotation: 0 },    // Cross wall
                    { x: 10, z: 10, width: 2, height: 10, rotation: 0 },  // Top right wall
                    { x: -10, z: -10, width: 2, height: 10, rotation: 0 }, // Bottom left wall
                    { x: 10, z: -10, width: 10, height: 2, rotation: 0 },  // Bottom right wall
                    { x: -10, z: 10, width: 10, height: 2, rotation: 0 }   // Top left wall
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

    public getRandomMobType(currentWave: number): EnemyType {
        const spawnable: EnemyType[] = [];
        const weights: number[] = [];
        let totalWeight = 0;

        // First, get all eligible mobs and their total weight
        for (const [type, config] of Object.entries(this.mobConfig)) {
            if (config.enabled && config.weight > 0 && 
                config.minWave <= currentWave && 
                type !== 'centipede_segment') {
                spawnable.push(type as EnemyType);
                weights.push(config.weight);
                totalWeight += config.weight;
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

    public getSpawnPosition(): { x: number; y: number; z: number } {
        const size = this.gridConfig.size;
        
        switch (this.gridConfig.spawnLocations) {
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
        this.currentConfig.collisionPlanes = planes;
    }

    public getCollisionPlanes(): CollisionPlaneConfig[] {
        return this.currentConfig.collisionPlanes;
    }
} 