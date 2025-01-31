import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import path from 'path';
import { Vector3 } from 'three';
import { Rarity, RARITY_MULTIPLIERS, EnemyType, EnemyStats, BASE_SIZES } from '../shared/types';

interface Player {
    id: string;
    position: { x: number; y: number; z: number };
    health: number;
    xp: number;  // Added XP tracking
}

interface Enemy {
    id: string;
    type: 'ladybug' | 'bee' | 'centipede' | 'centipede_segment' | 'spider';  // Add spider type
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
const MAP_SIZE = 15;

// Wave management
let currentWave = 1;
let enemiesKilledInWave = 0;
let totalXPInWave = 0;
let enemiesSpawnedInWave = 0;  // Track how many enemies we've spawned
const ENEMIES_PER_WAVE = 20;
const XP_PER_WAVE = 1000;
const WAVE_SPAWN_INTERVAL = 1000;  // Spawn enemy every second during wave
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
            rarity
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
                rarity
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
        isAggressive: false,
        velocity: { x: 0, y: 0, z: 0 },
        wanderAngle: Math.random() * Math.PI * 2,
        wanderTime: Date.now() + 2000 + Math.random() * 2000,
        segments: [],
        rarity
    };
    enemies.set(id, enemy);
    
    io.emit('enemySpawned', {
        id: enemy.id,
        type: enemy.type,
        position: enemy.position,
        health: enemy.health,
        isAggressive: false,
        rarity: enemy.rarity
    });
}

// Add this helper function to constrain position within map bounds
function constrainToMap(position: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    return {
        x: Math.max(-MAP_SIZE, Math.min(MAP_SIZE, position.x)),
        y: position.y,
        z: Math.max(-MAP_SIZE, Math.min(MAP_SIZE, position.z))
    };
}

// Add helper function to calculate avoidance vector
function calculateAvoidanceVector(enemy: Enemy): { x: number, z: number } {
    const avoidanceRadius = 1.5; // Radius to start avoiding other enemies
    const avoidanceForce = 0.02; // Strength of avoidance
    const boundaryAvoidanceRadius = 2; // Start avoiding boundaries when this close
    const boundaryForce = 0.03; // Stronger force for boundary avoidance
    let avoidX = 0;
    let avoidZ = 0;

    // Avoid other enemies
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

    // Avoid map boundaries
    const distanceToLeft = enemy.position.x + MAP_SIZE;
    const distanceToRight = MAP_SIZE - enemy.position.x;
    const distanceToBottom = enemy.position.z + MAP_SIZE;
    const distanceToTop = MAP_SIZE - enemy.position.z;

    // Add boundary avoidance forces
    if (distanceToLeft < boundaryAvoidanceRadius) {
        avoidX += boundaryForce * (1 - distanceToLeft / boundaryAvoidanceRadius);
    }
    if (distanceToRight < boundaryAvoidanceRadius) {
        avoidX -= boundaryForce * (1 - distanceToRight / boundaryAvoidanceRadius);
    }
    if (distanceToBottom < boundaryAvoidanceRadius) {
        avoidZ += boundaryForce * (1 - distanceToBottom / boundaryAvoidanceRadius);
    }
    if (distanceToTop < boundaryAvoidanceRadius) {
        avoidZ -= boundaryForce * (1 - distanceToTop / boundaryAvoidanceRadius);
    }

    return { x: avoidX, z: avoidZ };
}

// Helper function to get rotation based on enemy type and angle
function getEnemyRotation(enemy: Enemy, angle: number): number {
    return enemy.type === 'ladybug' ? angle : angle - Math.PI / 2;
}

function updateEnemies() {
    const currentTime = Date.now();
    
    enemies.forEach((enemy, enemyId) => {
        const enemyStats = getEnemyStats(enemy.type, enemy.rarity);
        
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
            if (enemy.type === 'spider') {
                // Spiders are always aggressive, find nearest player
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
                
                const newPosition = {
                    x: enemy.position.x + baseX + sineWave * Math.cos(enemy.wanderAngle + Math.PI/2) + avoidance.x,
                    y: enemy.position.y,
                    z: enemy.position.z + baseZ + sineWave * Math.sin(enemy.wanderAngle + Math.PI/2) + avoidance.z
                };

                // Check if new position would be out of bounds
                if (newPosition.x <= -MAP_SIZE || newPosition.x >= MAP_SIZE) {
                    enemy.wanderAngle = Math.PI - enemy.wanderAngle;
                } else if (newPosition.z <= -MAP_SIZE || newPosition.z >= MAP_SIZE) {
                    enemy.wanderAngle = -enemy.wanderAngle;
                } else {
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
                // Regular enemies (ladybugs and bees) use normal wandering
                const speed = enemyStats.passiveSpeed;
                
                // Calculate avoidance
                const avoidance = calculateAvoidanceVector(enemy);
                
                let newPosition;
                if (enemy.type === 'bee') {
                    // Bees have gentle vertical movement
                    const time = currentTime * 0.001; // Convert to seconds
                    const verticalOffset = Math.sin(time) * 0.2; // Reduced oscillation amplitude
                    const baseHeight = BASE_ENEMY_STATS.bee.size + 0.5; // Lower base hover height
                    
                    newPosition = {
                        x: enemy.position.x + Math.cos(enemy.wanderAngle) * speed + avoidance.x,
                        y: baseHeight + verticalOffset, // Gentler height variation
                        z: enemy.position.z + Math.sin(enemy.wanderAngle) * speed + avoidance.z
                    };
                } else {
                    newPosition = {
                        x: enemy.position.x + Math.cos(enemy.wanderAngle) * speed + avoidance.x,
                        y: enemy.position.y,
                        z: enemy.position.z + Math.sin(enemy.wanderAngle) * speed + avoidance.z
                    };
                }

                // Check if new position would be out of bounds
                if (newPosition.x <= -MAP_SIZE || newPosition.x >= MAP_SIZE ||
                    newPosition.z <= -MAP_SIZE || newPosition.z >= MAP_SIZE) {
                    // Reverse direction if would go out of bounds
                    enemy.wanderAngle = Math.PI + enemy.wanderAngle;
                } else {
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
        } else if (enemy.target) {
            // Get target player
            const targetPlayer = players.get(enemy.target);
            if (targetPlayer) {
                // Calculate direction to player
                const dx = targetPlayer.position.x - enemy.position.x;
                const dz = targetPlayer.position.z - enemy.position.z;
                const distance = Math.sqrt(dx * dx + dz * dz);

                // Move towards player
                if (distance > 0.5) {  // Don't get too close
                    const speed = enemyStats.speed;
                    const newPosition = {
                        x: enemy.position.x + (dx / distance) * speed,
                        y: enemy.position.y,
                        z: enemy.position.z + (dz / distance) * speed
                    };

                    // Only update position if it's within bounds
                    if (Math.abs(newPosition.x) <= MAP_SIZE && Math.abs(newPosition.z) <= MAP_SIZE) {
                        enemy.position = newPosition;
                    }

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
                    const newPosition = {
                        x: leader.position.x - dirX * segmentLength,
                        y: leader.position.y,
                        z: leader.position.z - dirZ * segmentLength
                    };

                    // Only update if within bounds
                    if (Math.abs(newPosition.x) <= MAP_SIZE && Math.abs(newPosition.z) <= MAP_SIZE) {
                        enemy.position = newPosition;
                    }

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

            // Apply velocity while respecting bounds
            const newPosition = {
                x: enemy.position.x + enemy.velocity.x,
                y: enemy.position.y,
                z: enemy.position.z + enemy.velocity.z
            };

            // Only update if within bounds
            if (Math.abs(newPosition.x) <= MAP_SIZE && Math.abs(newPosition.z) <= MAP_SIZE) {
                enemy.position = newPosition;
            } else {
                // If hitting boundary, stop velocity
                enemy.velocity.x = 0;
                enemy.velocity.z = 0;
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
                }
            }
        }
    }, WAVE_SPAWN_INTERVAL);
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
    
    // Check if wave should end
    if (enemiesKilledInWave >= ENEMIES_PER_WAVE || totalXPInWave >= XP_PER_WAVE) {
        startNewWave();
    }
}

function spawnRandomEnemy() {
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

    // Randomly choose enemy type with more balanced weights
    const rand = Math.random();
    let type: EnemyType;
    
    if (currentWave >= 5) {
        // Include spiders after wave 5
        type = rand < 0.35 ? 'ladybug' : 
               (rand < 0.6 ? 'bee' : 
               (rand < 0.85 ? 'centipede' : 'spider')); // 15% chance for spider
    } else {
        // Before wave 5, only basic enemies
        type = rand < 0.4 ? 'ladybug' : 
               (rand < 0.7 ? 'bee' : 'centipede');
    }
    
    console.log('Spawning enemy:', type);
    
    spawnEnemy(type, { 
        x, 
        y: BASE_ENEMY_STATS[type].size, 
        z 
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

    // Check if all players are dead (health <= 0)
    let allPlayersDead = true;
    players.forEach((player) => {
        if (player.health > 0) {
            allPlayersDead = false;
        }
    });

    if (allPlayersDead && players.size > 0) {
        console.log('All players are dead. Resetting server state...');
        resetServerState();
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
    currentWave = 1;
    enemiesKilledInWave = 0;
    totalXPInWave = 0;
    enemiesSpawnedInWave = 0;

    // Clear any existing spawn interval
    if (waveSpawnInterval) {
        clearInterval(waveSpawnInterval);
        waveSpawnInterval = null;
    }

    // Broadcast wave reset
    io.emit('waveStart', { wave: currentWave });

    // Start a new wave
    startNewWave();
}

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Store new player with XP
    players.set(socket.id, {
        id: socket.id,
        position: { x: 0, y: 0.5, z: 0 },
        health: 100,
        xp: 0
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
            enemy.health -= damage;
            
            // Only ladybugs become aggressive when hit
            if (enemy.type === 'ladybug' && !enemy.isAggressive) {
                enemy.isAggressive = true;
                enemy.target = socket.id;
            }
            
            const knockbackForce = 0.8; // Reduced from 1.0 to compensate for slower decay
            enemy.velocity.x = knockback.x * knockbackForce;
            enemy.velocity.z = knockback.z * knockbackForce;
            
            // Apply knockback while respecting bounds
            const newPosition = {
                x: enemy.position.x + enemy.velocity.x,
                y: enemy.position.y,
                z: enemy.position.z + enemy.velocity.z
            };

            // Only update if within bounds
            if (Math.abs(newPosition.x) <= MAP_SIZE && Math.abs(newPosition.z) <= MAP_SIZE) {
                enemy.position = newPosition;
            } else {
                // If hitting boundary, stop velocity
                enemy.velocity.x = 0;
                enemy.velocity.z = 0;
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
                
                // Determine item drop (50% chance)
                let itemType: string = 'cube';
                if (Math.random() < 0.5) {
                    itemType = Math.random() < 0.7 ? 'tetrahedron' : 'cube';
                }
                
                // Emit death with item drop info
                io.emit('enemyDied', {
                    enemyId,
                    position: deathPosition,
                    itemType,
                    enemyRarity: enemy.rarity
                });
                
                // Distribute XP and update wave progress
                distributeXP(BASE_ENEMY_STATS[enemy.type].xp);
                enemiesKilledInWave++;
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

    // Handle player damage
    socket.on('playerDamaged', ({ damage }) => {
        const player = players.get(socket.id);
        if (player) {
            player.health -= damage;
            io.emit('playerDamaged', {
                id: socket.id,
                health: player.health
            });

            // Check if server needs to be reset after player takes damage
            checkAndResetServer();
        }
    });
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
                console.log('Available types: ladybug, bee, centipede, spider');
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

            if (!['ladybug', 'bee', 'centipede', 'spider'].includes(type)) {
                console.log('Invalid enemy type. Available types: ladybug, bee, centipede, spider');
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

        case 'help':
            console.log('Available commands:');
            console.log('  spawn <type> [count] [rarity] - Spawn enemies');
            console.log('    - type: ladybug, bee, centipede, spider');
            console.log('    - count: number of enemies to spawn (default: 1)');
            console.log('    - rarity: common, uncommon, rare, epic, legendary (default: random)');
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