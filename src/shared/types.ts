export enum Rarity {
    COMMON = 'COMMON',
    UNCOMMON = 'UNCOMMON',
    RARE = 'RARE',
    EPIC = 'EPIC',
    LEGENDARY = 'LEGENDARY',
    MYTHIC = 'MYTHIC'
}

export const RARITY_COLORS = {
    [Rarity.COMMON]: 0x82ee6c,     // Light green
    [Rarity.UNCOMMON]: 0xffe55e,   // Yellow
    [Rarity.RARE]: 0x4f51e2,       // Blue
    [Rarity.EPIC]: 0x861ee0,       // Purple
    [Rarity.LEGENDARY]: 0xff0000,   // Red
    [Rarity.MYTHIC]: 0xff00ff       // Pink
};

export const RARITY_MULTIPLIERS = {
    [Rarity.COMMON]: 1,
    [Rarity.UNCOMMON]: 1.5,
    [Rarity.RARE]: 2.25,
    [Rarity.EPIC]: 3.375,
    [Rarity.LEGENDARY]: 5,
    [Rarity.MYTHIC]: 7.5
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
    maxHealth: number;
    cooldownTime: number;
    rarity: Rarity;
    damage: number;
    health: number;
    speed: number;
}

export interface CollisionPlaneConfig {
    x: number;
    y: number;
    z: number;
    width: number;
    height: number;
    rotationX: number;  // Rotation around X axis in degrees
    rotationY: number;  // Rotation around Y axis in degrees
    rotationZ: number;  // Rotation around Z axis in degrees
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
    collisionPlanes: CollisionPlaneConfig[];  // Add collision planes to config
}

export enum PetalType {
    BASIC = 'basic',
    BASIC_UNCOMMON = 'basic_uncommon',
    BASIC_RARE = 'basic_rare',
    TETRAHEDRON = 'tetrahedron',
    TETRAHEDRON_EPIC = 'tetrahedron_epic',
    CUBE = 'cube',
    CUBE_LEGENDARY = 'cube_legendary',
    LEAF = 'leaf',
    STINGER = 'stinger',
    PEA = 'pea'
} 