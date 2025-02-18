import { LightingConfig } from '../shared/types';

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
} 