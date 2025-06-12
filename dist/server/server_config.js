"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerConfig = void 0;
class ServerConfig {
    constructor(configType) {
        this.currentConfig = {
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
                skyColor: 0x87ceeb, // Sky blue
                groundColor: 0x00ff00, // Light green
                intensity: 1.0
            },
            skyColor: 0x87ceeb, // Sky blue
            nightMode: {
                ambientLight: {
                    color: 0x404080, // Dark blue-purple
                    intensity: 0.3 // Much dimmer
                },
                directionalLight: {
                    color: 0x9090ff, // Pale blue moonlight
                    intensity: 0.4, // Dimmer than day
                    position: {
                        x: -5, // Moon from opposite side
                        y: 15, // Higher in sky
                        z: -5
                    }
                },
                hemisphereLight: {
                    skyColor: 0x1a1a2e, // Dark navy night sky
                    groundColor: 0x00ff00, // Dark blue-green ground
                    intensity: 0.6 // Reduced intensity
                },
                skyColor: 0x1a1a2e // Dark navy night sky
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
        this.mobConfig = {
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
        this.gridConfig = {
            size: 15,
            spawnInterval: 1000,
            enemiesPerWave: 20,
            xpPerWave: 1000,
            spawnLocations: 'edges',
            gridCellSize: 1,
            gridColor: 0x038f21 // Default gray color for grid
        };
        if (configType === 'ant_hell') {
            // Ant Hell configuration
            this.gridConfig = {
                size: 30, // Larger map
                spawnInterval: 500, // Faster spawns
                enemiesPerWave: 40, // More enemies
                xpPerWave: 2000, // More XP
                spawnLocations: 'grid', // Grid-based spawning
                gridCellSize: 5, // 5x5 grid cells
                gridColor: 0x4a2810 // Dark brown grid for ant hell
            };
            // Modify mob configuration for Ant Hell
            this.mobConfig = {
                ...this.mobConfig,
                soldier_ant: {
                    enabled: true,
                    weight: 30, // Higher weight for soldier ants
                    minWave: 1 // Available from start
                },
                worker_ant: {
                    enabled: true,
                    weight: 30, // Higher weight for worker ants
                    minWave: 1
                },
                baby_ant: {
                    enabled: true,
                    weight: 20, // Higher weight for baby ants
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
                    skyColor: 0xa15402, // Dark gray
                    groundColor: 0xa15402, // Dark brown
                    intensity: 0.8
                },
                skyColor: 0xa15402, // Dark gray
                nightMode: {
                    ambientLight: {
                        color: 0x2a1a0a, // Very dark brown
                        intensity: 0.2 // Very dim
                    },
                    directionalLight: {
                        color: 0x6a4a2a, // Dark orange moonlight
                        intensity: 0.3, // Very dim
                        position: {
                            x: -5,
                            y: 20,
                            z: -5
                        }
                    },
                    hemisphereLight: {
                        skyColor: 0x0a0a0a, // Almost black sky
                        groundColor: 0x2a1a0a, // Very dark brown ground
                        intensity: 0.4 // Very reduced intensity
                    },
                    skyColor: 0x0a0a0a // Almost black sky
                },
                collisionPlanes: []
            };
        }
    }
    static getInstance(configType = 'default') {
        if (!ServerConfig.instances.has(configType)) {
            ServerConfig.instances.set(configType, new ServerConfig(configType));
        }
        return ServerConfig.instances.get(configType);
    }
    getCurrentConfig() {
        return this.currentConfig;
    }
    updateConfig(newConfig) {
        var _a;
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
                    ...(((_a = newConfig.directionalLight) === null || _a === void 0 ? void 0 : _a.position) || {})
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
    setSkyColor(color) {
        this.currentConfig.skyColor = color;
        this.currentConfig.hemisphereLight.skyColor = color;
    }
    setGroundColor(color) {
        this.currentConfig.hemisphereLight.groundColor = color;
    }
    setLightIntensity(type, intensity) {
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
    setLightColor(type, color) {
        switch (type) {
            case 'ambient':
                this.currentConfig.ambientLight.color = color;
                break;
            case 'directional':
                this.currentConfig.directionalLight.color = color;
                break;
        }
    }
    setDirectionalLightPosition(x, y, z) {
        this.currentConfig.directionalLight.position = { x, y, z };
    }
    // Night mode lighting methods
    setNightSkyColor(color) {
        this.currentConfig.nightMode.skyColor = color;
        this.currentConfig.nightMode.hemisphereLight.skyColor = color;
    }
    setNightGroundColor(color) {
        this.currentConfig.nightMode.hemisphereLight.groundColor = color;
    }
    setNightLightIntensity(type, intensity) {
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
    setNightLightColor(type, color) {
        switch (type) {
            case 'ambient':
                this.currentConfig.nightMode.ambientLight.color = color;
                break;
            case 'directional':
                this.currentConfig.nightMode.directionalLight.color = color;
                break;
        }
    }
    setNightDirectionalLightPosition(x, y, z) {
        this.currentConfig.nightMode.directionalLight.position = { x, y, z };
    }
    // Get lighting config for specific time of day
    getLightingConfig(isNight) {
        if (isNight) {
            // Return config with night mode lighting applied
            return {
                ...this.currentConfig,
                ambientLight: this.currentConfig.nightMode.ambientLight,
                directionalLight: this.currentConfig.nightMode.directionalLight,
                hemisphereLight: this.currentConfig.nightMode.hemisphereLight,
                skyColor: this.currentConfig.nightMode.skyColor
            };
        }
        else {
            // Return normal day config
            return this.currentConfig;
        }
    }
    // Mob configuration methods
    getMobConfig() {
        return this.mobConfig;
    }
    setMobEnabled(type, enabled) {
        if (type !== 'centipede_segment') { // Prevent enabling direct spawning of segments
            this.mobConfig[type].enabled = enabled;
        }
    }
    setMobWeight(type, weight) {
        if (weight >= 0 && type !== 'centipede_segment') {
            this.mobConfig[type].weight = weight;
        }
    }
    setMobMinWave(type, wave) {
        if (wave >= 1 && type !== 'centipede_segment') {
            this.mobConfig[type].minWave = wave;
        }
    }
    getSpawnableMobs(currentWave) {
        const spawnable = [];
        let totalWeight = 0;
        // First, get all eligible mobs and their total weight
        for (const [type, config] of Object.entries(this.mobConfig)) {
            if (config.enabled && config.weight > 0 &&
                config.minWave <= currentWave &&
                type !== 'centipede_segment') {
                spawnable.push(type);
                totalWeight += config.weight;
            }
        }
        return spawnable;
    }
    getRandomMobType(currentWave, isNight) {
        const spawnable = [];
        const weights = [];
        let totalWeight = 0;
        // Night-only mobs
        const nightOnlyMobs = ['spider', 'soldier_ant'];
        // First, get all eligible mobs and their total weight
        for (const [type, config] of Object.entries(this.mobConfig)) {
            if (config.enabled && config.weight > 0 &&
                config.minWave <= currentWave &&
                type !== 'centipede_segment') {
                const mobType = type;
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
                        }
                        else {
                            // Regular mobs get normal weight during night
                            spawnable.push(mobType);
                            weights.push(config.weight);
                            totalWeight += config.weight;
                        }
                    }
                    else {
                        // Day mode: exclude night-only mobs
                        if (!nightOnlyMobs.includes(mobType)) {
                            spawnable.push(mobType);
                            weights.push(config.weight);
                            totalWeight += config.weight;
                        }
                    }
                }
                else {
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
    getGridConfig() {
        return this.gridConfig;
    }
    updateGridConfig(newConfig) {
        this.gridConfig = {
            ...this.gridConfig,
            ...newConfig
        };
    }
    setGridColor(color) {
        this.gridConfig.gridColor = color;
    }
    getSpawnPosition() {
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
                    case 0:
                        x = -size;
                        z = (Math.random() * 2 - 1) * size;
                        break;
                    case 1:
                        x = size;
                        z = (Math.random() * 2 - 1) * size;
                        break;
                    case 2:
                        x = (Math.random() * 2 - 1) * size;
                        z = -size;
                        break;
                    case 3:
                        x = (Math.random() * 2 - 1) * size;
                        z = size;
                        break;
                    default:
                        x = -size;
                        z = -size;
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
    updateCollisionPlanes(planes) {
        console.log('Server updating collision planes:', planes);
        this.currentConfig.collisionPlanes = planes;
    }
    getCollisionPlanes() {
        console.log('Server getting collision planes:', this.currentConfig.collisionPlanes);
        return this.currentConfig.collisionPlanes;
    }
}
exports.ServerConfig = ServerConfig;
ServerConfig.instances = new Map();
//# sourceMappingURL=server_config.js.map