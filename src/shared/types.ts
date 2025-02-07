export enum Rarity {
    COMMON = 'common',
    UNCOMMON = 'uncommon',
    RARE = 'rare',
    EPIC = 'epic',
    LEGENDARY = 'legendary'
}

export const RARITY_COLORS = {
    [Rarity.COMMON]: '#82ee6c',     // White
    [Rarity.UNCOMMON]: '#ffe55e',   // Green
    [Rarity.RARE]: '#4f51e2',       // Blue
    [Rarity.EPIC]: '#861ee0',       // Purple
    [Rarity.LEGENDARY]: '#ff0000'   // Gold
};

export const RARITY_MULTIPLIERS = {
    [Rarity.COMMON]: 1,
    [Rarity.UNCOMMON]: 1.5,
    [Rarity.RARE]: 2.25,
    [Rarity.EPIC]: 3.375,
    [Rarity.LEGENDARY]: 5
};

// Base sizes for each enemy type
export const BASE_SIZES = {
    ladybug: 0.5,
    bee: 0.15,      // Reduced from 0.25
    centipede: 0.3,
    centipede_segment: 0.3,
    spider: 0.4,
    soldier_ant: 0.2,
    worker_ant: 0.2,
    baby_ant: 0.15  // Same size as bee
} as const;

// Base model sizes (for 3D models)
export const MODEL_BASE_SIZES = {
    bee: 0.4,       // The size the bee model was designed for
    spider: 0.4,    // The size the spider model was designed for
    soldier_ant: 0.2, // The size the soldier ant model was designed for
    worker_ant: 0.2,  // The size the worker ant model was designed for
    baby_ant: 0.15    // The size the baby ant model was designed for
} as const;

export type EnemyType = 'ladybug' | 'bee' | 'centipede' | 'centipede_segment' | 'spider' | 'soldier_ant' | 'worker_ant' | 'baby_ant';

export interface EnemyStats {
    health: number;
    speed: number;
    passiveSpeed: number;
    damage: number;
    size: number;
    xp: number;
    rarity: Rarity;
}

export interface PetalStats {
    health: number;
    damage: number;
    rarity: Rarity;
}

export interface LightingConfig {
    ambientLight: {
        color: number;
        intensity: number;
    };
    directionalLight: {
        color: number;
        intensity: number;
        position: {
            x: number;
            y: number;
            z: number;
        };
    };
    hemisphereLight: {
        skyColor: number;
        groundColor: number;
        intensity: number;
    };
    skyColor: number;
} 