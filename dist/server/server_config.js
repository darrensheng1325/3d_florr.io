"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerConfig = void 0;
class ServerConfig {
    constructor() {
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
            skyColor: 0x87ceeb // Sky blue
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
    }
    static getInstance() {
        if (!ServerConfig.instance) {
            ServerConfig.instance = new ServerConfig();
        }
        return ServerConfig.instance;
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
    getRandomMobType(currentWave) {
        const spawnable = [];
        const weights = [];
        let totalWeight = 0;
        // First, get all eligible mobs and their total weight
        for (const [type, config] of Object.entries(this.mobConfig)) {
            if (config.enabled && config.weight > 0 &&
                config.minWave <= currentWave &&
                type !== 'centipede_segment') {
                spawnable.push(type);
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
}
exports.ServerConfig = ServerConfig;
//# sourceMappingURL=server_config.js.map