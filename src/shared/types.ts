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
    [Rarity.LEGENDARY]: 0xce1629,   // Red
    [Rarity.MYTHIC]: 0x3fffc9     // Cyan
};

export const RARITY_MULTIPLIERS = {
    [Rarity.COMMON]: 1,
    [Rarity.UNCOMMON]: 1.5,
    [Rarity.RARE]: 2.25,
    [Rarity.EPIC]: 3.375,
    [Rarity.LEGENDARY]: 5,
    [Rarity.MYTHIC]: 7.5
};

// Damage multiplier for each rarity level (1.2x scaling)
export const RARITY_DAMAGE_MULTIPLIERS = {
    [Rarity.COMMON]: 1,
    [Rarity.UNCOMMON]: 1.2,
    [Rarity.RARE]: 1.44,      // 1.2^2
    [Rarity.EPIC]: 1.728,     // 1.2^3
    [Rarity.LEGENDARY]: 2.074, // 1.2^4
    [Rarity.MYTHIC]: 2.488     // 1.2^5
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

// Base petal stats (before rarity multipliers)
export interface BasePetalStats {
    maxHealth: number;
    cooldownTime: number;
    damage: number;
    health: number;
    speed: number;
}

// Final petal stats (after applying rarity)
export interface PetalStats extends BasePetalStats {
    rarity: Rarity;
}

// Database petal storage - stores counts by rarity for each base type
export interface PetalInventoryEntry {
    baseType: BasePetalType;
    rarities: {
        [Rarity.COMMON]: number;
        [Rarity.UNCOMMON]: number;
        [Rarity.RARE]: number;
        [Rarity.EPIC]: number;
        [Rarity.LEGENDARY]: number;
        [Rarity.MYTHIC]: number;
    };
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
    type?: 'wall' | 'terrain';  // Type of collision plane, defaults to 'wall'
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
    nightMode: {
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
    };
    gridConfig?: {
        gridColor: number;
    };
    collisionPlanes: CollisionPlaneConfig[];  // Add collision planes to config
}

export enum ItemType {
    TETRAHEDRON = 'tetrahedron',
    LEAF = 'leaf',
    STINGER = 'stinger',
    PEA = 'pea',
    CUBE = 'cube'
}

// Base petal types (without rarity suffixes)
export enum BasePetalType {
    BASIC = 'basic',
    TETRAHEDRON = 'tetrahedron',
    CUBE = 'cube',
    LEAF = 'leaf',
    STINGER = 'stinger',
    PEA = 'pea'
}

// Full petal types (including rarity variations) - keeping for backward compatibility
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

// Helper function to get petal type from base type and rarity
export function getPetalType(baseType: BasePetalType, rarity: Rarity): string {
    if (rarity === Rarity.COMMON) {
        return baseType;
    }
    return `${baseType.toLowerCase()}_${rarity.toLowerCase()}`;
}

// Helper function to extract base type and rarity from petal type
export function parsePetalType(petalType: string): { baseType: BasePetalType; rarity: Rarity } {
    const parts = petalType.split('_');
    if (parts.length === 1) {
        // Common rarity, no suffix
        return {
            baseType: parts[0].toLowerCase() as BasePetalType,
            rarity: Rarity.COMMON
        };
    } else {
        // Has rarity suffix
        const baseType = parts[0].toLowerCase() as BasePetalType;
        const rarityStr = parts.slice(1).join('_').toUpperCase() as Rarity;
        return { baseType, rarity: rarityStr };
    }
}

export interface WaveStartData {
    wave: number;
    minRarity: Rarity;
    isNight: boolean;
} 

export const PETAL_ROTATION_SPEED = 0.01;

// Heightmap System Types
export interface HeightmapData {
    width: number;
    height: number;
    resolution: number; // Grid size between height points
    heights: number[][]; // 2D array of height values
    minHeight: number;
    maxHeight: number;
    metadata?: {
        name?: string;
        description?: string;
        created?: string;
        version?: string;
    };
}

export interface HeightmapChunk {
    x: number;
    z: number;
    width: number;
    height: number;
    heights: number[][];
}

export interface TerrainConfig {
    heightmap: HeightmapData;
    material: {
        type: 'basic' | 'phong' | 'standard';
        color?: number;
        texture?: string;
        roughness?: number;
        metalness?: number;
        normalMap?: string;
        displacementMap?: string;
        displacementScale?: number;
    };
    collision: {
        enabled: boolean;
        precision: 'low' | 'medium' | 'high';
    };
    rendering: {
        wireframe: boolean;
        showNormals: boolean;
        chunkSize: number;
        maxChunks: number;
    };
}

export interface HeightmapGenerationParams {
    width: number;
    height: number;
    resolution: number;
    algorithm: 'perlin' | 'simplex' | 'fractal' | 'cellular' | 'random';
    seed?: number;
    octaves?: number;
    frequency?: number;
    amplitude?: number;
    persistence?: number;
    lacunarity?: number;
    minHeight: number;
    maxHeight: number;
    smoothing?: number;
}

export interface HeightmapModification {
    type: 'raise' | 'lower' | 'smooth' | 'flatten' | 'noise';
    x: number;
    z: number;
    radius: number;
    intensity: number;
    falloff?: 'linear' | 'exponential' | 'gaussian';
}

export interface TerrainCollision {
    position: THREE.Vector3;
    normal: THREE.Vector3;
    height: number;
    slope: number;
}