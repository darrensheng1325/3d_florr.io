import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import path from 'path';
import { Rarity, RARITY_MULTIPLIERS, EnemyType, EnemyStats, BASE_SIZES } from '../shared/types';
import { ServerConfig } from './server_config';
import { dbManager } from './database';
import { PetalType } from '../shared/types';
import { CollisionPlaneConfig } from '../shared/types';

interface Player {
    id: string;
    accountId: string;
    position: { x: number; y: number; z: number };
    health: number;
    xp: number;  // Added XP tracking
    joinTime: number; // Added join time
}

interface Enemy {
    id: string;
    type: 'ladybug' | 'bee' | 'centipede' | 'centipede_segment' | 'spider' | 'soldier_ant' | 'worker_ant' | 'baby_ant';  // Add soldier ant type
    position: { x: number; y: number; z: number };
    health: number;
    isAggressive: boolean;
    velocity: { x: number; y: number; z: number };
    wanderAngle: number;  // For passive movement
    wanderTime: number;   // Time until next direction change
    segments: string[];   // For centipede head - list of segment IDs in order
    centipedeId?: string; // ID of the head segment this belongs to
    followsId?: string;   // ID of the segment this follows
    target?: string;      // Socket ID of target player
    rarity: Rarity;
    lastKnockbackTime: number;
    knockbackCooldown: number;
    lastTargetChangeTime: number;
    targetChangeCooldown: number;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

// Keep track of all connected players and their positions
const players = new Map<string, Player>();
const enemies = new Map<string, Enemy>();

let enemyIdCounter = 0;
const SPAWN_INTERVAL = 5000;  // Spawn enemy every 5 seconds

// Get server configuration type from environment variable or command line argument
const configType = process.env.SERVER_TYPE || 'default';
const serverConfig = ServerConfig.getInstance(configType);
const gridConfig = serverConfig.getGridConfig();

// Update constants to use grid configuration
const MAP_SIZE = gridConfig.size;
const ENEMIES_PER_WAVE = gridConfig.enemiesPerWave;
const XP_PER_WAVE = gridConfig.xpPerWave;
const WAVE_SPAWN_INTERVAL = gridConfig.spawnInterval;

// Wave management
let currentWave = 1;
let enemiesKilledInWave = 0;
let totalXPInWave = 0;
let enemiesSpawnedInWave = 0;  // Track how many enemies we've spawned
let waveSpawnInterval: NodeJS.Timeout | null = null;

// Update ENEMY_STATS with base stats (before rarity multipliers)
const BASE_ENEMY_STATS: Record<EnemyType, Omit<EnemyStats, 'rarity'>> = {
    ladybug: {
        health: 50,
        speed: 0.03,
        passiveSpeed: 0.02,
        damage: 10,
        size: BASE_SIZES.ladybug,
        xp: 100
    },
    bee: {
        health: 30,
        speed: 0.08,
        passiveSpeed: 0.02,
        damage: 8,
        size: BASE_SIZES.bee,
        xp: 200
    },
    centipede: {
        health: 40,
        speed: 0.02,
        passiveSpeed: 0.01,
        damage: 15,
        size: BASE_SIZES.centipede,
        xp: 300
    },
    centipede_segment: {
        health: 25,
        speed: 0.02,
        passiveSpeed: 0.01,
        damage: 10,
        size: BASE_SIZES.centipede_segment,
        xp: 150
    },
    spider: {
        health: 10,
        speed: 0.12,
        passiveSpeed: 0.06,
        damage: 15,
        size: BASE_SIZES.spider,
        xp: 250
    },
    soldier_ant: {
        health: 80,
        speed: 0.05,        // Reduced from 0.06 to match player speed
        passiveSpeed: 0.02, // Reduced from 0.03 to be proportional
        damage: 20,
        size: BASE_SIZES.soldier_ant,
        xp: 350
    },
    worker_ant: {
        health: 100,  // 2x ladybug health
        speed: 0.03,  // Same as ladybug
        passiveSpeed: 0.02,  // Same as ladybug
        damage: 10,   // Same as ladybug
        size: BASE_SIZES.worker_ant,
        xp: 200
    },
    baby_ant: {
        health: 50,   // Same as ladybug
        speed: 0.03,  // Same as ladybug
        passiveSpeed: 0.02,  // Same as ladybug
        damage: 5,    // Half ladybug damage
        size: BASE_SIZES.baby_ant,
        xp: 50
    }
};

// Function to determine enemy rarity based on wave number
function determineRarity(forcedRarity?: Rarity, waveNumber: number = currentWave): Rarity {
    if (forcedRarity) return forcedRarity;
    
    // Calculate minimum rarity based on wave number
    let minRarity: Rarity;
    if (waveNumber >= 40) {
        minRarity = Rarity.LEGENDARY;
    } else if (waveNumber >= 30) {
        minRarity = Rarity.EPIC;
    } else if (waveNumber >= 20) {
        minRarity = Rarity.RARE;
    } else if (waveNumber >= 10) {
        minRarity = Rarity.UNCOMMON;
    } else {
        minRarity = Rarity.COMMON;
    }

    // Get available rarities (only minimum and one above)
    const rarityLevels = Object.values(Rarity);
    const minRarityIndex = rarityLevels.indexOf(minRarity);
    const availableRarities = rarityLevels.slice(minRarityIndex, minRarityIndex + 2);

    // 70% chance for minimum rarity, 30% chance for one rarity above (if available)
    const rand = Math.random();
    if (rand < 0.7 || availableRarities.length === 1) {
        return availableRarities[0]; // Minimum rarity
    } else {
        return availableRarities[1]; // One rarity above
    }
}

// Function to get enemy stats with rarity multipliers
function getEnemyStats(type: EnemyType, rarity: Rarity): EnemyStats {
    const baseStats = BASE_ENEMY_STATS[type];
    const multiplier = RARITY_MULTIPLIERS[rarity];
    
    return {
        ...baseStats,
        health: Math.round(baseStats.health * multiplier),
        damage: Math.round(baseStats.damage * multiplier),
        xp: Math.round(baseStats.xp * multiplier),
        // Scale size with rarity, but use a smaller multiplier to prevent them from being too big
        size: baseStats.size * (1 + (multiplier - 1) * 0.5),
        rarity
    };
}

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, '../../dist')));

// Serve index.html for all routes (for client-side routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

function generateId(): string {
    return `enemy_${enemyIdCounter++}`;
}

function spawnEnemy(type: EnemyType, position: { x: number; y: number; z: number }, forcedRarity?: Rarity) {
    const id = generateId();
    const rarity = determineRarity(forcedRarity, currentWave);
    const stats = getEnemyStats(type, rarity);

    // Set initial aggression based on type
    const isInitiallyAggressive = type === 'spider' || type === 'soldier_ant';

    if (type === 'centipede') {
        const headId = generateId();
        const headEnemy: Enemy = {
            id: headId,
            type: 'centipede',
            position: {
                ...position,
                y: stats.size
            },
            health: stats.health,
            isAggressive: false,
            velocity: { x: 0, y: 0, z: 0 },
            wanderAngle: Math.random() * Math.PI * 2,
            wanderTime: Date.now() + 2000 + Math.random() * 2000,
            segments: [],
            rarity,
            lastKnockbackTime: 0,
            knockbackCooldown: 500,
            lastTargetChangeTime: 0,
            targetChangeCooldown: 2000
        };
        enemies.set(headId, headEnemy);

        io.emit('enemySpawned', {
            id: headId,
            type: 'centipede',
            position: headEnemy.position,
            health: headEnemy.health,
            isAggressive: false,
            rarity: headEnemy.rarity
        });

        // Generate random length with weighted distribution
        let segmentCount: number;
        const rand = Math.random();
        if (rand < 0.7) {
            // 70% chance for length between 5 and 9 (centered around 7)
            segmentCount = 5 + Math.floor(Math.random() * 5);
        } else if (rand < 0.9) {
            // 20% chance for length between 10 and 20
            segmentCount = 10 + Math.floor(Math.random() * 11);
        } else {
            // 10% chance for length between 21 and 40
            segmentCount = 21 + Math.floor(Math.random() * 20);
        }

        const segmentSpacing = 0.6;
        let lastSegmentPos = { ...headEnemy.position };
        const directionX = Math.cos(headEnemy.wanderAngle);
        const directionZ = Math.sin(headEnemy.wanderAngle);

        for (let i = 0; i < segmentCount; i++) {
            const segmentId = generateId();
            const segmentStats = getEnemyStats('centipede_segment', rarity);
            
            lastSegmentPos = {
                x: position.x - directionX * segmentSpacing * (i + 1),
                y: position.y,
                z: position.z - directionZ * segmentSpacing * (i + 1)
            };
            
            const segmentEnemy: Enemy = {
                id: segmentId,
                type: 'centipede_segment',
                position: lastSegmentPos,
                health: segmentStats.health,
                isAggressive: false,
                centipedeId: headId,
                followsId: i === 0 ? headId : headEnemy.segments[i - 1],
                velocity: { x: 0, y: 0, z: 0 },
                wanderAngle: Math.random() * Math.PI * 2,
                wanderTime: Date.now() + 2000 + Math.random() * 2000,
                segments: [],
                rarity,
                lastKnockbackTime: 0,
                knockbackCooldown: 500,
                lastTargetChangeTime: 0,
                targetChangeCooldown: 2000
            };
            enemies.set(segmentId, segmentEnemy);
            headEnemy.segments.push(segmentId);
            
            io.emit('enemySpawned', {
                id: segmentId,
                type: 'centipede_segment',
                position: segmentEnemy.position,
                health: segmentEnemy.health,
                isAggressive: false,
                rarity: segmentEnemy.rarity
            });
        }
        return;
    }

    const enemy: Enemy = {
        id,
        type,
        position: {
            x: position.x,
            y: type === 'bee' ? BASE_ENEMY_STATS[type].size + 0.5 : BASE_ENEMY_STATS[type].size,
            z: position.z
        },
        health: stats.health,
        isAggressive: isInitiallyAggressive,
        velocity: { x: 0, y: 0, z: 0 },
        wanderAngle: Math.random() * Math.PI * 2,
        wanderTime: Date.now() + 2000 + Math.random() * 2000,
        segments: [],
        rarity,
        lastKnockbackTime: 0,
        knockbackCooldown: 500,
        lastTargetChangeTime: 0,
        targetChangeCooldown: 2000
    };

    // Find nearest player for initially aggressive enemies
    if (isInitiallyAggressive) {
        let nearestPlayer: { id: string } | null = null;
        let minDistance = Infinity;
        
        for (const [playerId, player] of players.entries()) {
            const dx = player.position.x - enemy.position.x;
            const dz = player.position.z - enemy.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance < minDistance) {
                minDistance = distance;
                nearestPlayer = player;
            }
        }

        if (nearestPlayer) {
            enemy.target = nearestPlayer.id;
        }
    }

    enemies.set(id, enemy);
    
    io.emit('enemySpawned', {
        id: enemy.id,
        type: enemy.type,
        position: enemy.position,
        health: enemy.health,
        isAggressive: enemy.isAggressive,
        rarity: enemy.rarity
    });
}

// Collision detection functions for enemies
function checkEnemyCollisionPlanes(position: { x: number, y: number, z: number }, radius: number = 0.5): { collided: boolean; normal?: { x: number, y: number, z: number }; type?: 'wall' | 'terrain'; terrainHeight?: number } {
    const config = ServerConfig.getInstance().getCurrentConfig();
    const collisionPlanes = config.collisionPlanes;
    
    // Check wall collisions first
    for (const planeConfig of collisionPlanes) {
        if (planeConfig.type !== 'terrain') {
            const collision = checkSinglePlaneCollision(planeConfig, position, radius);
            if (collision.collided) {
                return { ...collision, type: 'wall' };
            }
        }
    }
    
    // Check terrain collisions
    for (const planeConfig of collisionPlanes) {
        if (planeConfig.type === 'terrain') {
            const collision = checkTerrainCollision(planeConfig, position, radius);
            if (collision.collided) {
                return { ...collision, type: 'terrain' };
            }
        }
    }
    
    return { collided: false };
}

function checkSinglePlaneCollision(planeConfig: CollisionPlaneConfig, position: { x: number, y: number, z: number }, radius: number): { collided: boolean; normal?: { x: number, y: number, z: number } } {
    // Create transformation matrices manually
    const radX = planeConfig.rotationX * Math.PI / 180;
    const radY = planeConfig.rotationY * Math.PI / 180;
    const radZ = planeConfig.rotationZ * Math.PI / 180;
    
    // Calculate plane normal (0, 0, 1) rotated by plane rotations
    const cosX = Math.cos(radX), sinX = Math.sin(radX);
    const cosY = Math.cos(radY), sinY = Math.sin(radY);
    const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);
    
    // Apply rotations in order: X, Y, Z
    let nx = 0, ny = 0, nz = 1;
    
    // Rotate around X
    let tempY = ny * cosX - nz * sinX;
    nz = ny * sinX + nz * cosX;
    ny = tempY;
    
    // Rotate around Y
    let tempX = nx * cosY + nz * sinY;
    nz = -nx * sinY + nz * cosY;
    nx = tempX;
    
    // Rotate around Z
    tempX = nx * cosZ - ny * sinZ;
    ny = nx * sinZ + ny * cosZ;
    nx = tempX;
    
    const planeNormal = { x: nx, y: ny, z: nz };
    
    // Calculate distance from sphere center to the infinite plane
    const dx = position.x - planeConfig.x;
    const dy = position.y - planeConfig.y;
    const dz = position.z - planeConfig.z;
    const distance = planeNormal.x * dx + planeNormal.y * dy + planeNormal.z * dz;
    
    // If the sphere is too far from the plane, no collision
    if (Math.abs(distance) > radius) {
        return { collided: false };
    }
    
    // Project sphere center onto the plane
    const projectedX = position.x - planeNormal.x * distance;
    const projectedY = position.y - planeNormal.y * distance;
    const projectedZ = position.z - planeNormal.z * distance;
    
    // Transform to plane's local space for bounds checking
    const localX = projectedX - planeConfig.x;
    const localY = projectedY - planeConfig.y;
    const localZ = projectedZ - planeConfig.z;
    
    // Apply inverse rotations to get local coordinates
    // Inverse rotation order: Z, Y, X
    let lx = localX, ly = localY, lz = localZ;
    
    // Inverse Z rotation
    tempX = lx * cosZ + ly * sinZ;
    ly = -lx * sinZ + ly * cosZ;
    lx = tempX;
    
    // Inverse Y rotation
    tempX = lx * cosY - lz * sinY;
    lz = lx * sinY + lz * cosY;
    lx = tempX;
    
    // Inverse X rotation
    tempY = ly * cosX + lz * sinX;
    lz = -ly * sinX + lz * cosX;
    ly = tempY;
    
    // Check bounds
    const halfWidth = planeConfig.width / 2;
    const halfHeight = planeConfig.height / 2;
    
    const closestX = Math.max(-halfWidth, Math.min(halfWidth, lx));
    const closestY = Math.max(-halfHeight, Math.min(halfHeight, ly));
    
    // Transform closest point back to world space
    let cwx = closestX, cwy = closestY, cwz = 0;
    
    // Apply rotations: X, Y, Z
    tempY = cwy * cosX - cwz * sinX;
    cwz = cwy * sinX + cwz * cosX;
    cwy = tempY;
    
    tempX = cwx * cosY + cwz * sinY;
    cwz = -cwx * sinY + cwz * cosY;
    cwx = tempX;
    
    tempX = cwx * cosZ - cwy * sinZ;
    cwy = cwx * sinZ + cwy * cosZ;
    cwx = tempX;
    
    const closestWorldX = cwx + planeConfig.x;
    const closestWorldY = cwy + planeConfig.y;
    const closestWorldZ = cwz + planeConfig.z;
    
    // Check distance to closest point
    const distX = position.x - closestWorldX;
    const distY = position.y - closestWorldY;
    const distZ = position.z - closestWorldZ;
    const distanceToClosest = Math.sqrt(distX * distX + distY * distY + distZ * distZ);
    
    if (distanceToClosest <= radius) {
        const length = Math.sqrt(distX * distX + distY * distY + distZ * distZ);
        const normal = {
            x: length > 0 ? distX / length : 0,
            y: length > 0 ? distY / length : 0,
            z: length > 0 ? distZ / length : 0
        };
        return { collided: true, normal };
    }
    
    return { collided: false };
}

function checkTerrainCollision(planeConfig: CollisionPlaneConfig, position: { x: number, y: number, z: number }, radius: number): { collided: boolean; normal?: { x: number, y: number, z: number }; terrainHeight?: number } {
    // Similar transformation logic as wall collision but simplified for terrain
    const radX = planeConfig.rotationX * Math.PI / 180;
    const radY = planeConfig.rotationY * Math.PI / 180;
    const radZ = planeConfig.rotationZ * Math.PI / 180;
    
    const cosX = Math.cos(radX), sinX = Math.sin(radX);
    const cosY = Math.cos(radY), sinY = Math.sin(radY);
    const cosZ = Math.cos(radZ), sinZ = Math.sin(radZ);
    
    // Transform player position to plane's local space
    const localX = position.x - planeConfig.x;
    const localY = position.y - planeConfig.y;
    const localZ = position.z - planeConfig.z;
    
    // Apply inverse rotations
    let lx = localX, ly = localY, lz = localZ;
    
    // Inverse Z rotation
    let tempX = lx * cosZ + ly * sinZ;
    ly = -lx * sinZ + ly * cosZ;
    lx = tempX;
    
    // Inverse Y rotation
    tempX = lx * cosY - lz * sinY;
    lz = lx * sinY + lz * cosY;
    lx = tempX;
    
    // Inverse X rotation
    let tempY = ly * cosX + lz * sinX;
    lz = -ly * sinX + lz * cosX;
    ly = tempY;
    
    const halfWidth = planeConfig.width / 2;
    const halfHeight = planeConfig.height / 2;
    
    // Check if within horizontal bounds
    if (lx >= -halfWidth && lx <= halfWidth && ly >= -halfHeight && ly <= halfHeight) {
        // Calculate world height at this position
        let terrainX = lx, terrainY = ly, terrainZ = 0;
        
        // Transform back to world space
        tempY = terrainY * cosX - terrainZ * sinX;
        terrainZ = terrainY * sinX + terrainZ * cosX;
        terrainY = tempY;
        
        tempX = terrainX * cosY + terrainZ * sinY;
        terrainZ = -terrainX * sinY + terrainZ * cosY;
        terrainX = tempX;
        
        tempX = terrainX * cosZ - terrainY * sinZ;
        terrainY = terrainX * sinZ + terrainY * cosZ;
        terrainX = tempX;
        
        const terrainWorldY = terrainY + planeConfig.y;
        const targetHeight = terrainWorldY + radius;
        
        // Add tolerance for terrain collision
        const tolerance = 0.2;
        const belowTolerance = 0.1;
        
        if (position.y <= targetHeight + tolerance && position.y >= targetHeight - belowTolerance) {
            if (Math.abs(position.y - targetHeight) < 0.05) {
                return { collided: false };
            }
            
            if (position.y < targetHeight - 0.02) {
    return {
                    collided: true,
                    terrainHeight: targetHeight,
                    normal: { x: 0, y: 1, z: 0 }
                };
            }
        }
    }
    
    return { collided: false };
}

// Remove the old boundary avoidance function
function calculateAvoidanceVector(enemy: Enemy): { x: number, z: number } {
    const avoidanceRadius = 1.5; // Radius to start avoiding other enemies
    const avoidanceForce = 0.02; // Strength of avoidance
    let avoidX = 0;
    let avoidZ = 0;

    // Only avoid other enemies, remove boundary avoidance
    enemies.forEach((otherEnemy) => {
        if (otherEnemy.id !== enemy.id) {
            const dx = enemy.position.x - otherEnemy.position.x;
            const dz = enemy.position.z - otherEnemy.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);

            if (distance < avoidanceRadius && distance > 0) {
                // Calculate avoidance force inversely proportional to distance
                const force = (avoidanceRadius - distance) * avoidanceForce / distance;
                avoidX += dx * force;
                avoidZ += dz * force;
            }
        }
    });

    return { x: avoidX, z: avoidZ };
}

// Helper function to apply movement with collision detection
function applyEnemyMovement(enemy: Enemy, newX: number, newZ: number): { x: number, y: number, z: number } {
    const radius = BASE_ENEMY_STATS[enemy.type].size;
    const testPosition = { x: newX, y: enemy.position.y, z: newZ };
    
    const collision = checkEnemyCollisionPlanes(testPosition, radius);
    
    if (collision.collided && collision.type === 'terrain' && collision.terrainHeight !== undefined) {
        // On terrain: move and adjust height
        return { x: newX, y: collision.terrainHeight, z: newZ };
    } else if (collision.collided && collision.type === 'wall' && collision.normal) {
        // Hit wall: try sliding
        const movementX = newX - enemy.position.x;
        const movementZ = newZ - enemy.position.z;
        const normal = collision.normal;
        
        // Calculate sliding direction
        const normalComponent = movementX * normal.x + movementZ * normal.z;
        const slideX = movementX - normal.x * normalComponent;
        const slideZ = movementZ - normal.z * normalComponent;
        
        if (Math.abs(slideX) > 0.001 || Math.abs(slideZ) > 0.001) {
            const slideNewX = enemy.position.x + slideX;
            const slideNewZ = enemy.position.z + slideZ;
            const slideTest = { x: slideNewX, y: enemy.position.y, z: slideNewZ };
            const slideCollision = checkEnemyCollisionPlanes(slideTest, radius);
            
            if (!slideCollision.collided || slideCollision.type === 'terrain') {
                if (slideCollision.collided && slideCollision.type === 'terrain' && slideCollision.terrainHeight !== undefined) {
                    return { x: slideNewX, y: slideCollision.terrainHeight, z: slideNewZ };
                } else {
                    // Check if still on terrain
                    const terrainCheck = checkEnemyCollisionPlanes({ x: slideNewX, y: enemy.position.y, z: slideNewZ }, radius);
                    if (terrainCheck.collided && terrainCheck.type === 'terrain' && terrainCheck.terrainHeight !== undefined) {
                        return { x: slideNewX, y: terrainCheck.terrainHeight, z: slideNewZ };
                    } else {
                        return { x: slideNewX, y: BASE_ENEMY_STATS[enemy.type].size, z: slideNewZ };
                    }
                }
            }
        }
        
        // Can't move, stay in place but check terrain
        const terrainCheck = checkEnemyCollisionPlanes(enemy.position, radius);
        if (terrainCheck.collided && terrainCheck.type === 'terrain' && terrainCheck.terrainHeight !== undefined) {
            return { x: enemy.position.x, y: terrainCheck.terrainHeight, z: enemy.position.z };
        } else {
            return { x: enemy.position.x, y: BASE_ENEMY_STATS[enemy.type].size, z: enemy.position.z };
        }
    } else {
        // No collision: move normally but check for terrain
        const terrainCheck = checkEnemyCollisionPlanes(testPosition, radius);
        if (terrainCheck.collided && terrainCheck.type === 'terrain' && terrainCheck.terrainHeight !== undefined) {
            return { x: newX, y: terrainCheck.terrainHeight, z: newZ };
        } else {
            return { x: newX, y: BASE_ENEMY_STATS[enemy.type].size, z: newZ };
        }
    }
}

// Helper function to get rotation based on enemy type and angle
function getEnemyRotation(enemy: Enemy, angle: number): number {
    return enemy.type === 'ladybug' ? angle : angle - Math.PI / 2;
}

function updateEnemies() {
    const currentTime = Date.now();
    
    enemies.forEach((enemy, enemyId) => {
        const enemyStats = getEnemyStats(enemy.type, enemy.rarity);
        
        // Handle target selection and movement
        if (enemy.isAggressive) {
            // Only change target if enough time has passed
            if (!enemy.target || (currentTime - enemy.lastTargetChangeTime > enemy.targetChangeCooldown)) {
                let nearestPlayer: { id: string } | null = null;
                let minDistance = Infinity;
                
                for (const [playerId, player] of players.entries()) {
                    const dx = player.position.x - enemy.position.x;
                    const dz = player.position.z - enemy.position.z;
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestPlayer = player;
                    }
                }

                if (nearestPlayer) {
                    enemy.target = nearestPlayer.id;
                    enemy.lastTargetChangeTime = currentTime;
                }
            }
            
            // Move towards target if we have one
            if (enemy.target) {
                const targetPlayer = players.get(enemy.target);
                if (targetPlayer) {
                    const dx = targetPlayer.position.x - enemy.position.x;
                    const dz = targetPlayer.position.z - enemy.position.z;
                    const distance = Math.sqrt(dx * dx + dz * dz);

                    // Move towards player if not too close
                    if (distance > 0.5) {
                        const speed = enemyStats.speed;
                        const newX = enemy.position.x + (dx / distance) * speed;
                        const newZ = enemy.position.z + (dz / distance) * speed;
                        
                        // Apply collision-aware movement
                        const newPosition = applyEnemyMovement(enemy, newX, newZ);
                            enemy.position = newPosition;

                        // Calculate rotation to face player
                        const targetRotation = getEnemyRotation(enemy, Math.atan2(dx, dz));
                        io.emit('enemyMoved', {
                            id: enemyId,
                            position: enemy.position,
                            rotation: targetRotation
                        });
                    }
                }
            }
        }

        // Check for player collisions and apply knockback
        players.forEach((player) => {
            const dx = enemy.position.x - player.position.x;
            const dz = enemy.position.z - player.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            // If enemy is touching player's center
            if (distance < 1.0) {
                // Calculate knockback direction (away from player)
                const knockbackDir = {
                    x: dx / distance,
                    z: dz / distance
                };

                // Apply same knockback force as player hits
                const knockbackForce = 0.8;
                enemy.velocity.x = knockbackDir.x * knockbackForce;
                enemy.velocity.z = knockbackDir.z * knockbackForce;

                // Emit damage to player
                io.emit('playerDamaged', {
                    id: player.id,
                    health: player.health - 10
                });

                // Update player health on server
                player.health -= 10;
            }
        });

        // Handle passive movement for all enemies
        if (!enemy.isAggressive) {
            // Update wander direction periodically
            if (currentTime >= enemy.wanderTime) {
                enemy.wanderAngle = Math.random() * Math.PI * 2;
                enemy.wanderTime = currentTime + 2000 + Math.random() * 2000;
            }

            // Different movement for different enemy types
            if (enemy.type === 'spider' || enemy.type === 'soldier_ant') {
                // These enemies should already be aggressive from spawn, but just in case:
                let nearestPlayer: Player | null = null;
                let minDistance = Infinity;
                
                for (const [playerId, player] of players.entries()) {
                    const dx = player.position.x - enemy.position.x;
                    const dz = player.position.z - enemy.position.z;
                    const distance = Math.sqrt(dx * dx + dz * dz);
                    
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearestPlayer = player;
                    }
                }

                if (nearestPlayer) {
                    enemy.isAggressive = true;
                    enemy.target = nearestPlayer.id;
                }
            } else if (enemy.type === 'centipede') {
                // Centipede head moves in a smooth snake-like pattern
                const speed = enemyStats.passiveSpeed;
                const time = currentTime * 0.001; // Convert to seconds
                
                // Add sinusoidal movement to create snake-like pattern
                const baseX = Math.cos(enemy.wanderAngle) * speed;
                const baseZ = Math.sin(enemy.wanderAngle) * speed;
                const sineWave = Math.sin(time * 2) * 0.02; // Adjust frequency and amplitude
                
                // Calculate avoidance
                const avoidance = calculateAvoidanceVector(enemy);
                
                const newX = enemy.position.x + baseX + sineWave * Math.cos(enemy.wanderAngle + Math.PI/2) + avoidance.x;
                const newZ = enemy.position.z + baseZ + sineWave * Math.sin(enemy.wanderAngle + Math.PI/2) + avoidance.z;

                // Test movement with collision detection
                const radius = BASE_ENEMY_STATS[enemy.type].size;
                const testPosition = { x: newX, y: enemy.position.y, z: newZ };
                const collision = checkEnemyCollisionPlanes(testPosition, radius);
                
                if (collision.collided && collision.type === 'wall') {
                    // Hit wall: reverse direction
                    enemy.wanderAngle = Math.PI - enemy.wanderAngle;
                } else {
                    // Apply collision-aware movement
                    const newPosition = applyEnemyMovement(enemy, newX, newZ);
                    enemy.position = newPosition;
                }

                // Emit position update with rotation based on movement direction
                const wanderRotation = getEnemyRotation(enemy, enemy.wanderAngle);
                io.emit('enemyMoved', {
                    id: enemyId,
                    position: enemy.position,
                    rotation: wanderRotation
                });
            } else if (enemy.type === 'centipede_segment') {
                // Segments are handled by the follow logic below
            } else {
                // Other enemy types (ladybug, bee, spider, etc.) wander normally
                const speed = enemyStats.passiveSpeed;
                
                // Calculate base movement
                const baseX = Math.cos(enemy.wanderAngle) * speed;
                const baseZ = Math.sin(enemy.wanderAngle) * speed;
                
                // Calculate avoidance
                const avoidance = calculateAvoidanceVector(enemy);
                
                const newX = enemy.position.x + baseX + avoidance.x;
                const newZ = enemy.position.z + baseZ + avoidance.z;

                // Test movement with collision detection
                const radius = BASE_ENEMY_STATS[enemy.type].size;
                const testPosition = { x: newX, y: enemy.position.y, z: newZ };
                const collision = checkEnemyCollisionPlanes(testPosition, radius);
                
                if (collision.collided && collision.type === 'wall') {
                    // Hit wall: reverse direction
                    enemy.wanderAngle = Math.PI + enemy.wanderAngle;
                } else {
                    // Apply collision-aware movement
                    let newPosition = applyEnemyMovement(enemy, newX, newZ);
                    
                    // Special handling for bees - they hover above ground/terrain
                    if (enemy.type === 'bee') {
                        const time = currentTime * 0.001;
                        const verticalOffset = Math.sin(time) * 0.2;
                        const baseHeight = BASE_ENEMY_STATS.bee.size + 0.5;
                        newPosition.y = baseHeight + verticalOffset;
                    }
                    
                    enemy.position = newPosition;
                    
                    // Gradually adjust wanderAngle based on avoidance
                    if (Math.abs(avoidance.x) > 0.001 || Math.abs(avoidance.z) > 0.001) {
                        const avoidanceAngle = Math.atan2(avoidance.z, avoidance.x);
                        const angleDiff = avoidanceAngle - enemy.wanderAngle;
                        enemy.wanderAngle += angleDiff * 0.1; // Smooth turning
                    }
                }

                const wanderRotation = getEnemyRotation(enemy, enemy.wanderAngle);
                io.emit('enemyMoved', {
                    id: enemyId,
                    position: enemy.position,
                    rotation: wanderRotation
                });
            }
        }

        // Update centipede segment positions to follow their leader
        if (enemy.type === 'centipede_segment' && enemy.followsId) {
            const leader = enemies.get(enemy.followsId);
            if (leader) {
                const dx = leader.position.x - enemy.position.x;
                const dy = leader.position.y - enemy.position.y;
                const dz = leader.position.z - enemy.position.z;
                const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                
                // Each segment should be exactly one segment length away
                const segmentLength = 0.6;
                
                if (distance > segmentLength * 1.1 || distance < segmentLength * 0.9) {
                    // Calculate the exact position where this segment should be
                    const dirX = dx / distance;
                    const dirZ = dz / distance;
                    
                    // Set position directly behind leader
                    const newX = leader.position.x - dirX * segmentLength;
                    const newZ = leader.position.z - dirZ * segmentLength;

                    // Apply collision-aware movement
                    const newPosition = applyEnemyMovement(enemy, newX, newZ);
                        enemy.position = newPosition;

                    // Calculate rotation to face movement direction
                    const rotation = Math.atan2(dx, dz);
                    
                    // Emit position update
                    io.emit('enemyMoved', {
                        id: enemyId,
                        position: enemy.position,
                        rotation: Math.atan2(dx, dz) - Math.PI / 2
                    });
                }
            }
        }

        // Apply velocity decay (for knockback)
        if (enemy.velocity.x !== 0 || enemy.velocity.z !== 0) {
            const decay = 0.7; // 30% decay per frame (increased from 10%)
            
            // Apply stronger decay for very small velocities to prevent micro-movements
            if (Math.abs(enemy.velocity.x) < 0.01) enemy.velocity.x = 0;
            if (Math.abs(enemy.velocity.z) < 0.01) enemy.velocity.z = 0;
            
            enemy.velocity.x *= decay;
            enemy.velocity.z *= decay;

            // Apply velocity with collision detection
            const newX = enemy.position.x + enemy.velocity.x;
            const newZ = enemy.position.z + enemy.velocity.z;
            
            // Test movement with collision detection
            const radius = BASE_ENEMY_STATS[enemy.type].size;
            const testPosition = { x: newX, y: enemy.position.y, z: newZ };
            const collision = checkEnemyCollisionPlanes(testPosition, radius);
            
            if (collision.collided && collision.type === 'wall') {
                // Hit wall: stop velocity
                enemy.velocity.x = 0;
                enemy.velocity.z = 0;
            } else {
                // Apply collision-aware movement
                const newPosition = applyEnemyMovement(enemy, newX, newZ);
                enemy.position = newPosition;
            }

            const velocityRotation = getEnemyRotation(enemy, Math.atan2(enemy.velocity.x, enemy.velocity.z));
            io.emit('enemyMoved', {
                id: enemyId,
                position: enemy.position,
                rotation: velocityRotation
            });
        }
    });
}

function distributeXP(amount: number) {
    const playerCount = players.size;
    if (playerCount === 0) return;
    
    const xpPerPlayer = Math.floor(amount / playerCount);
    players.forEach((player) => {
        player.xp += xpPerPlayer;
        io.emit('playerXP', { id: player.id, xp: player.xp });
    });
    
    totalXPInWave += amount;
    
    // Only progress wave when all enemies are killed
    if (enemiesKilledInWave >= ENEMIES_PER_WAVE) {
        startNewWave();
    }
}

function startNewWave() {
    // Clear all existing enemies
    enemies.forEach((_, enemyId) => {
        io.emit('enemyDied', { 
            enemyId,
            position: { x: 0, y: 0, z: 0 },
            itemType: ''
        });
    });
    enemies.clear();
    
    currentWave++;
    enemiesKilledInWave = 0;
    totalXPInWave = 0;
    enemiesSpawnedInWave = 0;

    // Determine minimum rarity for this wave
    let minRarity: Rarity;
    if (currentWave >= 40) minRarity = Rarity.LEGENDARY;
    else if (currentWave >= 30) minRarity = Rarity.EPIC;
    else if (currentWave >= 20) minRarity = Rarity.RARE;
    else if (currentWave >= 10) minRarity = Rarity.UNCOMMON;
    else minRarity = Rarity.COMMON;
    
    // Clear any existing spawn interval
    if (waveSpawnInterval) {
        clearInterval(waveSpawnInterval);
    }
    
    // Broadcast wave start with minimum rarity info
    io.emit('waveStart', { 
        wave: currentWave,
        minRarity: minRarity
    });
    
    // Start spawning enemies for this wave
    waveSpawnInterval = setInterval(() => {
        if (enemiesSpawnedInWave < ENEMIES_PER_WAVE) {
            spawnRandomEnemy();
            enemiesSpawnedInWave++;
            
            if (enemiesSpawnedInWave >= ENEMIES_PER_WAVE) {
                if (waveSpawnInterval) {
                    clearInterval(waveSpawnInterval);
                    waveSpawnInterval = null;
                }
            }
        }
    }, WAVE_SPAWN_INTERVAL);
}

function spawnRandomEnemy() {
    // Use grid configuration for spawn position
    const position = serverConfig.getSpawnPosition();
    
    // Get random mob type based on configuration
    const type = serverConfig.getRandomMobType(currentWave);
    
    console.log('Spawning enemy:', type);
    
    spawnEnemy(type, { 
        x: position.x, 
        y: BASE_ENEMY_STATS[type].size, 
        z: position.z 
    });
}

// Function to check and reset server state if needed
function checkAndResetServer() {
    // Reset if there are no players
    if (players.size === 0) {
        console.log('No players connected. Resetting server state...');
        resetServerState();
        return;
    }
}

function resetServerState() {
    // Clear all existing enemies
    enemies.forEach((_, enemyId) => {
        io.emit('enemyDied', { 
            enemyId,
            position: { x: 0, y: 0, z: 0 },
            itemType: ''
        });
    });
    enemies.clear();

    // Reset wave state
    currentWave = 1;  // Reset to wave 1 instead of incrementing
    enemiesKilledInWave = 0;
    totalXPInWave = 0;
    enemiesSpawnedInWave = 0;

    // Clear any existing spawn interval
    if (waveSpawnInterval) {
        clearInterval(waveSpawnInterval);
        waveSpawnInterval = null;
    }

    // Broadcast wave reset with wave 1
    io.emit('waveStart', { 
        wave: currentWave,
        minRarity: Rarity.COMMON
    });

    // Start spawning enemies for wave 1
    waveSpawnInterval = setInterval(() => {
        if (enemiesSpawnedInWave < ENEMIES_PER_WAVE) {
            spawnRandomEnemy();
            enemiesSpawnedInWave++;
            
            if (enemiesSpawnedInWave >= ENEMIES_PER_WAVE) {
                if (waveSpawnInterval) {
                    clearInterval(waveSpawnInterval);
                    waveSpawnInterval = null;
                }
            }
        }
    }, WAVE_SPAWN_INTERVAL);
}

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    const accountId = socket.handshake.query.accountId as string;

    // Get or create account in database
    let account = dbManager.getAccount(accountId);
    if (!account) {
        account = dbManager.createAccount(accountId);
    }

    console.log(`Account ${accountId} loaded with ${account.inventory.collectedItems.length} items`);

    // Store new player with XP, join time, and account ID
    players.set(socket.id, {
        id: socket.id,
        accountId: accountId,
        position: { x: 0, y: 0.5, z: 0 },
        health: 100,
        xp: account.totalXP, // Use XP from database
        joinTime: Date.now()
    });

    // First, send initial game state
    socket.emit('healthSync', {
        health: 100
    });

    // Send a single, complete account sync with all data
    const fullAccountData = {
        totalXP: account.totalXP,
        highestWave: account.highestWave,
        stats: account.stats,
        inventory: {
            petals: account.inventory.petals,
            collectedItems: account.inventory.collectedItems
        }
    };

    // Log the data being sent
    console.log('Sending initial account data:', {
        accountId,
        itemCount: fullAccountData.inventory.collectedItems.length,
        petalTypes: fullAccountData.inventory.petals.map(p => `${p.type}(${p.amount})`)
    });

    // Send a single, complete sync event
    socket.emit('accountSync', fullAccountData);

    // Handle inventory request (for manual refresh)
    socket.on('requestInventory', () => {
        const player = players.get(socket.id);
        if (player) {
            const currentAccount = dbManager.getAccount(player.accountId);
            if (currentAccount) {
                const inventory = {
                    petals: currentAccount.inventory.petals,
                    collectedItems: currentAccount.inventory.collectedItems
                };
                
                console.log('Sending inventory refresh:', {
                    accountId: player.accountId,
                    itemCount: inventory.collectedItems.length,
                    petalTypes: inventory.petals.map(p => `${p.type}(${p.amount})`)
                });

                socket.emit('inventorySync', inventory);
            }
        }
    });

    // Handle item collection
    socket.on('itemCollected', ({ itemType }) => {
        const player = players.get(socket.id);
        if (player) {
            console.log(`Player ${player.accountId} collecting item: ${itemType}`);
            
            // Add to database as a petal if it's a petal type
            if (Object.values(PetalType).includes(itemType as PetalType)) {
                dbManager.addPetal(player.accountId, itemType as PetalType);
            } else {
                // Otherwise add as a collected item
                dbManager.addCollectedItem(player.accountId, itemType);
            }

            // Get updated inventory
            const updatedAccount = dbManager.getAccount(player.accountId);
            if (updatedAccount) {
                const inventory = {
                    petals: updatedAccount.inventory.petals,
                    collectedItems: updatedAccount.inventory.collectedItems
                };

                console.log('Confirming item collection:', {
                    accountId: player.accountId,
                    newItem: itemType,
                    totalItems: inventory.collectedItems.length,
                    petalTypes: inventory.petals.map(p => `${p.type}(${p.amount})`)
                });

                // Send complete inventory state
                socket.emit('itemCollectionConfirmed', {
                    type: itemType,
                    inventory: inventory
                });
            }
        }
    });

    // Handle inventory updates
    socket.on('inventoryUpdate', ({ type, action }: { type: PetalType, action: 'add' | 'remove' }) => {
        const player = players.get(socket.id);
        if (player) {
            console.log(`Updating inventory for ${player.accountId}: ${action} ${type}`);
            
            // Update petal in database
            if (action === 'add') {
                dbManager.addPetal(player.accountId, type);
            } else {
                dbManager.removePetal(player.accountId, type);
            }
            
            // Get current account state
            const currentAccount = dbManager.getAccount(player.accountId);
            if (currentAccount) {
                // Send confirmation with complete inventory state
                socket.emit('inventoryUpdateConfirmed', {
                    petals: currentAccount.inventory.petals,
                    collectedItems: currentAccount.inventory.collectedItems
                });
            }
        }
    });

    // Send existing players and enemies to the new player
    players.forEach((player) => {
        if (player.id !== socket.id) {
            socket.emit('playerJoined', {
                id: player.id,
                position: player.position,
                health: player.health,
                xp: player.xp
            });
        }
    });
    
    enemies.forEach((enemy) => {
        socket.emit('enemySpawned', {
            id: enemy.id,
            type: enemy.type,
            position: enemy.position,
            health: enemy.health,
            isAggressive: enemy.isAggressive,
            rarity: enemy.rarity
        });
    });

    // Broadcast to other players that a new player has joined
    socket.broadcast.emit('playerJoined', {
        id: socket.id,
        position: { x: 0, y: 0.5, z: 0 },
        health: 100,
        xp: 0
    });
    socket.broadcast.emit('playerMoved', {
        id: socket.id,
        position: { x: 0, y: 0.5, z: 0 }
    });

    // Handle player movement
    socket.on('move', (position) => {
        const player = players.get(socket.id);
        if (player) {
            player.position = position;
            socket.broadcast.emit('playerMoved', {
                id: socket.id,
                position
            });
        }
    });

    // Handle enemy damage
    socket.on('enemyDamaged', ({ enemyId, damage, knockback }) => {
        const enemy = enemies.get(enemyId);
        if (enemy) {
            const currentTime = Date.now();
            
            // Check knockback cooldown
            if (currentTime - enemy.lastKnockbackTime < enemy.knockbackCooldown) {
                return; // Skip knockback if on cooldown
            }
            
            enemy.health -= damage;
            
            // Only ladybugs become aggressive when hit
            if (enemy.type === 'ladybug' && !enemy.isAggressive) {
                enemy.isAggressive = true;
                enemy.target = socket.id;
                enemy.lastTargetChangeTime = currentTime;
            }
            
            // Apply knockback with cooldown
            const knockbackForce = 0.8;
            enemy.velocity.x = knockback.x * knockbackForce;
            enemy.velocity.z = knockback.z * knockbackForce;
            enemy.lastKnockbackTime = currentTime;
            
            // Apply knockback with collision detection
            const newX = enemy.position.x + enemy.velocity.x;
            const newZ = enemy.position.z + enemy.velocity.z;
            
            // Test movement with collision detection
            const radius = BASE_ENEMY_STATS[enemy.type].size;
            const testPosition = { x: newX, y: enemy.position.y, z: newZ };
            const collision = checkEnemyCollisionPlanes(testPosition, radius);
            
            if (collision.collided && collision.type === 'wall') {
                // Hit wall: stop velocity
                enemy.velocity.x = 0;
                enemy.velocity.z = 0;
            } else {
                // Apply collision-aware movement
                const newPosition = applyEnemyMovement(enemy, newX, newZ);
                enemy.position = newPosition;
            }
            
            if (enemy.health <= 0) {
                // Store position before any modifications
                const deathPosition = {
                    x: enemy.position.x,
                    y: enemy.position.y,
                    z: enemy.position.z
                };
                
                // Remove enemy first
                enemies.delete(enemyId);
                
                // Determine item drop
                let itemType: string = '';
                if (enemy.type === 'worker_ant') {
                    // Worker ants always drop leaves
                    itemType = 'leaf';
                } else if (enemy.type === 'bee') {
                    // Bees always drop stingers
                    itemType = 'stinger';
                } else if (enemy.type === 'centipede' || enemy.type === 'centipede_segment') {
                    // Centipedes and their segments always drop peas
                    itemType = 'pea';
                } else if (Math.random() < 0.5) {
                    // Other enemies have 50% chance to drop tetrahedron or cube
                    itemType = Math.random() < 0.7 ? 'tetrahedron' : 'cube';
                }
                
                // Emit death with item drop info
                io.emit('enemyDied', {
                    enemyId,
                    position: deathPosition,
                    itemType,
                    enemyRarity: enemy.rarity,
                    enemyType: enemy.type
                });
                
                // Get base XP and apply rarity multiplier
                const baseXP = BASE_ENEMY_STATS[enemy.type].xp;
                const rarityMultiplier = RARITY_MULTIPLIERS[enemy.rarity];
                const totalXP = Math.round(baseXP * rarityMultiplier);
                
                // Distribute XP and update wave progress
                distributeXP(totalXP);
                enemiesKilledInWave++;

                // If item drops, save it to the database
                if (itemType) {
                    const player = players.get(socket.id);
                    if (player) {
                        dbManager.addCollectedItem(player.accountId, itemType);
                    }
                }
            } else {
                // Update format to match what client expects
                io.emit('enemyDamaged', {
                    enemyId,
                    damage,
                    health: enemy.health
                });
                
                const velocityRotation = getEnemyRotation(enemy, Math.atan2(enemy.velocity.x, enemy.velocity.z));
                io.emit('enemyMoved', {
                    id: enemyId,
                    position: enemy.position,
                    rotation: velocityRotation
                });
            }
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        players.delete(socket.id);
        io.emit('playerLeft', socket.id);
        
        // Check if server needs to be reset after player disconnects
        checkAndResetServer();
    });

    // Add health sync request handler
    socket.on('requestHealthSync', () => {
        const player = players.get(socket.id);
        if (player) {
            socket.emit('healthSync', {
                health: player.health
            });
        }
    });

    // Handle player damage
    socket.on('playerDamaged', ({ damage }) => {
        const player = players.get(socket.id);
        if (player) {
            // Validate damage amount
            const validatedDamage = Math.max(0, Math.min(damage, player.health));
            player.health = Math.max(0, player.health - validatedDamage);

            // Broadcast the new health state to all clients
            io.emit('playerDamaged', {
                id: socket.id,
                health: player.health
            });

            // Send a health sync to the affected player
            socket.emit('healthSync', {
                health: player.health
            });

            // Handle player death
            if (player.health <= 0) {
                console.log('Player died:', socket.id);
                
                // Calculate detailed stats for death screen
                const deathStats = {
                    finalScore: player.xp,
                    wave: currentWave,
                    enemiesKilled: enemiesKilledInWave,
                    totalWaveProgress: Math.floor((enemiesKilledInWave / ENEMIES_PER_WAVE) * 100),
                    position: player.position,
                    gameStats: {
                        timeAlive: Date.now() - player.joinTime,
                        highestWave: currentWave,
                        finalPosition: player.position,
                        totalXP: player.xp,
                        kills: enemiesKilledInWave
                    }
                };

                // Update database with game stats
                dbManager.updateStats(player.accountId, deathStats.gameStats);
                
                // Send death events to client
                socket.emit('playerDied', deathStats);
                
                // First, notify all clients to freeze the game state
                io.emit('playerDeathSequence', {
                    id: socket.id,
                    position: player.position
                });
                
                // Keep the player in the game state briefly for death animation
                setTimeout(() => {
                    // Send final death confirmation to trigger death screen
                    socket.emit('showDeathScreen', deathStats);
                    
                    // Remove the player from the game state
                    players.delete(socket.id);
                    io.emit('playerLeft', socket.id);
                    
                    // Set a longer timeout for the death screen to be visible
                    setTimeout(() => {
                        if (socket.connected) {
                            // Send one final message before disconnect
                            socket.emit('deathScreenComplete');
                            socket.disconnect(true);
                        }
                        // Check if server needs reset (no players left)
                        checkAndResetServer();
                    }, 100); // 5 second delay to show death screen
                }, 100); // 1 second for death animation
            }
        }
    });

    // Handle leaderboard requests
    socket.on('requestLeaderboard', (sortBy: 'totalXP' | 'bestXP' | 'highestWave') => {
        const leaderboard = dbManager.getLeaderboard(sortBy);
        socket.emit('leaderboardUpdate', leaderboard);
    });

    // Send initial configuration to new client
    socket.emit('configUpdate', serverConfig.getCurrentConfig());

    // Handle collision plane updates
    socket.on('updateCollisionPlanes', (planes: CollisionPlaneConfig[]) => {
        console.log('Received collision plane update from client:', planes);
        serverConfig.updateCollisionPlanes(planes);
        // Broadcast the updated planes to all clients
        io.emit('lightingConfig', serverConfig.getCurrentConfig());
    });

    // Send initial lighting config
    socket.emit('lightingConfig', serverConfig.getCurrentConfig());
    console.log('Sent initial lighting config to client:', serverConfig.getCurrentConfig());
});

// Start the first wave when server starts
startNewWave();

// Start enemy update loop
setInterval(updateEnemies, 1000 / 60);  // 60 updates per second

// Add command line interface for spawning enemies
process.stdin.setEncoding('utf8');
process.stdin.on('data', (data: string) => {
    const command = data.trim();
    const [cmd, ...args] = command.split(' ');

    switch (cmd) {
        case 'spawn':
            if (args.length === 0) {
                console.log('Usage: spawn <type> [count] [rarity]');
                console.log('Available types:', serverConfig.getSpawnableMobs(currentWave).join(', '));
                console.log('Available rarities: common, uncommon, rare, epic, legendary');
                console.log('Example: spawn spider 3 rare');
                return;
            }

            const type = args[0].toLowerCase() as EnemyType;
            const count = parseInt(args[1]) || 1;
            let specifiedRarity: Rarity | undefined;

            // Check if rarity is specified
            if (args[2]) {
                const rarityArg = args[2].toLowerCase();
                if (Object.values(Rarity).includes(rarityArg as Rarity)) {
                    specifiedRarity = rarityArg as Rarity;
                } else {
                    console.log('Invalid rarity. Available rarities: common, uncommon, rare, epic, legendary');
                    return;
                }
            }

            // Validate mob type against current configuration
            const spawnableMobs = serverConfig.getSpawnableMobs(currentWave);
            if (!spawnableMobs.includes(type)) {
                console.log(`Invalid or disabled enemy type. Available types: ${spawnableMobs.join(', ')}`);
                return;
            }

            console.log(`Spawning ${count} ${specifiedRarity || 'random'} ${type}(s)...`);
            for (let i = 0; i < count; i++) {
                // Spawn at random edge of map
                const edge = Math.floor(Math.random() * 4);
                let x, z;
                switch (edge) {
                    case 0: x = -MAP_SIZE; z = (Math.random() * 2 - 1) * MAP_SIZE; break;
                    case 1: x = MAP_SIZE; z = (Math.random() * 2 - 1) * MAP_SIZE; break;
                    case 2: x = (Math.random() * 2 - 1) * MAP_SIZE; z = -MAP_SIZE; break;
                    case 3: x = (Math.random() * 2 - 1) * MAP_SIZE; z = MAP_SIZE; break;
                    default: x = -MAP_SIZE; z = -MAP_SIZE;
                }
                
                spawnEnemy(type, { 
                    x, 
                    y: BASE_ENEMY_STATS[type].size, 
                    z 
                }, specifiedRarity);
            }
            break;

        case 'spawnitem':
            if (args.length === 0) {
                console.log('Usage: spawnitem <type> [count]');
                console.log('Available types: tetrahedron, cube, leaf, stinger');
                console.log('Example: spawnitem tetrahedron 3');
                return;
            }

            const itemType = args[0].toLowerCase();
            const itemCount = parseInt(args[1]) || 1;

            if (!['tetrahedron', 'cube', 'leaf', 'stinger'].includes(itemType)) {
                console.log('Invalid item type. Available types: tetrahedron, cube, leaf, stinger');
                return;
            }

            console.log(`Spawning ${itemCount} ${itemType}(s) at center of map...`);
            for (let i = 0; i < itemCount; i++) {
                // Add some random offset around center
                const offset = 2; // 2 units max offset
                const x = (Math.random() * 2 - 1) * offset;
                const z = (Math.random() * 2 - 1) * offset;
                
                io.emit('itemSpawned', {
                    id: generateId(),
                    type: itemType,
                    position: { x, y: 0.5, z }
                });
            }
            break;

        case 'setsky':
            if (args.length !== 1) {
                console.log('Usage: setsky <color>');
                console.log('Example: setsky 0x87ceeb');
                return;
            }
            try {
                const color = parseInt(args[0]);
                serverConfig.setSkyColor(color);
                io.emit('configUpdate', serverConfig.getCurrentConfig());
                console.log('Sky color updated');
            } catch (e) {
                console.log('Invalid color format. Use hexadecimal (e.g., 0x87ceeb)');
            }
            break;

        case 'setground':
            if (args.length !== 1) {
                console.log('Usage: setground <color>');
                console.log('Example: setground 0x90EE90');
                return;
            }
            try {
                const color = parseInt(args[0]);
                serverConfig.setGroundColor(color);
                io.emit('configUpdate', serverConfig.getCurrentConfig());
                console.log('Ground color updated');
            } catch (e) {
                console.log('Invalid color format. Use hexadecimal (e.g., 0x90EE90)');
            }
            break;

        case 'setlight':
            if (args.length !== 3) {
                console.log('Usage: setlight <type> <prop> <val>');
                console.log('Types: ambient, directional, hemisphere');
                console.log('Properties: color, intensity');
                console.log('Example: setlight ambient intensity 0.7');
                console.log('Example: setlight directional color 0xffffff');
                return;
            }
            
            const [lightType, property, value] = args;
            if (!['ambient', 'directional', 'hemisphere'].includes(lightType)) {
                console.log('Invalid light type. Use: ambient, directional, or hemisphere');
                return;
            }

            try {
                if (property === 'intensity') {
                    const intensity = parseFloat(value);
                    serverConfig.setLightIntensity(lightType as any, intensity);
                } else if (property === 'color' && lightType !== 'hemisphere') {
                    const color = parseInt(value);
                    serverConfig.setLightColor(lightType as any, color);
                } else {
                    console.log('Invalid property. Use: color or intensity');
                    return;
                }
                io.emit('configUpdate', serverConfig.getCurrentConfig());
                console.log(`${lightType} light ${property} updated`);
            } catch (e) {
                console.log('Invalid value format');
            }
            break;

        case 'setlightpos':
            if (args.length !== 3) {
                console.log('Usage: setlightpos <x> <y> <z>');
                console.log('Example: setlightpos 5 10 5');
                return;
            }
            try {
                const [x, y, z] = args.map(Number);
                serverConfig.setDirectionalLightPosition(x, y, z);
                io.emit('configUpdate', serverConfig.getCurrentConfig());
                console.log('Directional light position updated');
            } catch (e) {
                console.log('Invalid position format. Use numbers for x, y, z coordinates');
            }
            break;

        case 'setgrid':
            if (args.length !== 1) {
                console.log('Usage: setgrid <color>');
                console.log('Example: setgrid 0x808080');
                return;
            }
            try {
                const color = parseInt(args[0]);
                serverConfig.setGridColor(color);
                io.emit('configUpdate', { ...serverConfig.getCurrentConfig(), gridConfig: serverConfig.getGridConfig() });
                console.log('Grid color updated');
            } catch (e) {
                console.log('Invalid color format. Use hexadecimal (e.g., 0x808080)');
            }
            break;

        case 'setmob':
            if (args.length < 3) {
                console.log('Usage: setmob <type> <property> <value>');
                console.log('Properties: enabled (true/false), weight (number), minwave (number)');
                console.log('Example: setmob spider enabled false');
                console.log('Example: setmob ladybug weight 50');
                console.log('Example: setmob soldier_ant minwave 3');
                return;
            }

            const mobTypeToSet = args[0].toLowerCase() as EnemyType;
            const mobProperty = args[1].toLowerCase();
            const mobValue = args[2];

            const validEnemyTypes: EnemyType[] = ['ladybug', 'bee', 'centipede', 'spider', 'soldier_ant', 'worker_ant', 'baby_ant', 'centipede_segment'];
            if (!validEnemyTypes.includes(mobTypeToSet)) {
                console.log('Invalid mob type');
                return;
            }

            switch (mobProperty) {
                case 'enabled':
                    serverConfig.setMobEnabled(mobTypeToSet, mobValue === 'true');
                    console.log(`${mobTypeToSet} enabled set to ${mobValue}`);
                    break;
                case 'weight':
                    const weight = parseInt(mobValue);
                    if (isNaN(weight) || weight < 0) {
                        console.log('Weight must be a non-negative number');
                        return;
                    }
                    serverConfig.setMobWeight(mobTypeToSet, weight);
                    console.log(`${mobTypeToSet} weight set to ${weight}`);
                    break;
                case 'minwave':
                    const wave = parseInt(mobValue);
                    if (isNaN(wave) || wave < 1) {
                        console.log('Minimum wave must be a positive number');
                        return;
                    }
                    serverConfig.setMobMinWave(mobTypeToSet, wave);
                    console.log(`${mobTypeToSet} minimum wave set to ${wave}`);
                    break;
                default:
                    console.log('Invalid property. Use: enabled, weight, or minwave');
            }
            break;

        case 'listmobs':
            const mobConfig = serverConfig.getMobConfig();
            console.log('\nCurrent mob configuration:');
            Object.entries(mobConfig).forEach(([type, settings]) => {
                if (type !== 'centipede_segment') {
                    console.log(`\n${type}:`);
                    console.log(`  Enabled: ${settings.enabled}`);
                    console.log(`  Weight: ${settings.weight}`);
                    console.log(`  Min Wave: ${settings.minWave}`);
                }
            });
            break;

        case 'help':
            console.log('Available commands:');
            console.log('  spawn <type> [count] [rarity] - Spawn enemies');
            console.log('    - type: ladybug, bee, centipede, spider, soldier_ant, worker_ant, baby_ant');
            console.log('    - count: number of enemies to spawn (default: 1)');
            console.log('    - rarity: common, uncommon, rare, epic, legendary (default: random)');
            console.log('  spawnitem <type> [count]      - Spawn items at center of map');
            console.log('    - type: tetrahedron, cube, leaf, stinger');
            console.log('    - count: number of items to spawn (default: 1)');
            console.log('  setsky <color>                 - Set sky color (hex)');
            console.log('  setground <color>              - Set ground color (hex)');
            console.log('  setlight <type> <prop> <val>   - Set light properties');
            console.log('  setlightpos <x> <y> <z>       - Set directional light position');
            console.log('  setgrid <color>                - Set grid color (hex)');
            console.log('  setmob <type> <property> <value> - Set mob properties');
            console.log('  listmobs                      - List current mob configuration');
            console.log('  help                          - Show this help message');
            break;

        default:
            if (cmd !== '') {
                console.log('Unknown command. Type "help" for available commands.');
            }
            break;
    }
});

console.log('Server running on port 3000');
console.log('Type "help" for available commands.');

httpServer.listen(3000, () => {
    console.log('Server running on port 3000');
}); 