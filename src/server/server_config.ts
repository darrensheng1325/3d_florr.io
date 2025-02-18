import { LightingConfig, EnemyType } from '../shared/types';

interface MobSpawnConfig {
    enabled: boolean;
    weight: number;  // Relative spawn weight (higher = more common)
    minWave: number; // Minimum wave number for this mob to start spawning
}

export class ServerConfig {
    private static instance: ServerConfig;
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
        skyColor: 0x87ceeb  // Sky blue
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

    private constructor() {}

    public static getInstance(): ServerConfig {
        if (!ServerConfig.instance) {
            ServerConfig.instance = new ServerConfig();
        }
        return ServerConfig.instance;
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
} 