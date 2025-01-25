export enum Rarity {
    COMMON = 'common',
    UNCOMMON = 'uncommon',
    RARE = 'rare',
    EPIC = 'epic',
    LEGENDARY = 'legendary'
}

export const RARITY_COLORS = {
    [Rarity.COMMON]: '#ffffff',     // White
    [Rarity.UNCOMMON]: '#2ecc71',   // Green
    [Rarity.RARE]: '#3498db',       // Blue
    [Rarity.EPIC]: '#9b59b6',       // Purple
    [Rarity.LEGENDARY]: '#f1c40f'   // Gold
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
    spider: 0.4
} as const;

// Base model sizes (for 3D models)
export const MODEL_BASE_SIZES = {
    bee: 0.4,       // The size the bee model was designed for
    spider: 0.4     // The size the spider model was designed for
} as const;

export type EnemyType = 'ladybug' | 'bee' | 'centipede' | 'centipede_segment' | 'spider';

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