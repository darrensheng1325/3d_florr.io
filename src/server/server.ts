import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import path from 'path';
import { Vector3 } from 'three';

interface Player {
    id: string;
    position: { x: number; y: number; z: number };
    health: number;
    xp: number;  // Added XP tracking
}

interface Enemy {
    id: string;
    type: 'ladybug' | 'bee';
    position: { x: number; y: number; z: number };
    health: number;
    target?: string;  // Socket ID of target player
    velocity: { x: number; y: number; z: number };
    isAggressive: boolean;
    wanderAngle: number;  // For passive movement
    wanderTime: number;   // Time until next direction change
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

// Enemy stats
const ENEMY_STATS = {
    ladybug: {
        health: 50,
        speed: 0.03,
        passiveSpeed: 0.02,
        damage: 10,
        size: 0.5,
        xp: 100
    },
    bee: {
        health: 30,
        speed: 0.08,
        passiveSpeed: 0.02,
        damage: 8,
        size: 0.4,
        xp: 200
    }
};

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, '../../dist')));

// Serve index.html for all routes (for client-side routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

function spawnEnemy() {
    const id = `enemy_${enemyIdCounter++}`;
    const type = Math.random() < 0.7 ? 'ladybug' : 'bee';
    
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

    const enemy: Enemy = {
        id,
        type,
        position: { x, y: ENEMY_STATS[type].size, z },
        health: ENEMY_STATS[type].health,
        velocity: { x: 0, y: 0, z: 0 },
        isAggressive: type === 'bee',
        wanderAngle: Math.random() * Math.PI * 2,
        wanderTime: Date.now() + 2000 + Math.random() * 2000 // Random time between 2-4 seconds
    };

    enemies.set(id, enemy);
    io.emit('enemySpawned', { id, type, position: enemy.position });
}

function updateEnemies() {
    const currentTime = Date.now();
    
    enemies.forEach((enemy, enemyId) => {
        if (!enemy.isAggressive) {
            // Passive wandering behavior
            if (currentTime >= enemy.wanderTime) {
                // Change direction and set new wander time
                enemy.wanderAngle += (Math.random() * Math.PI/2 + Math.PI/4) * (Math.random() < 0.5 ? 1 : -1);
                enemy.wanderTime = currentTime + 2000 + Math.random() * 2000;
            }

            // Move in current wander direction
            const speed = ENEMY_STATS[enemy.type].passiveSpeed;
            const dirX = Math.cos(enemy.wanderAngle);
            const dirZ = Math.sin(enemy.wanderAngle);

            // Update position
            let newX = enemy.position.x + dirX * speed;
            let newZ = enemy.position.z + dirZ * speed;

            // Bounce off map boundaries
            if (newX <= -MAP_SIZE || newX >= MAP_SIZE) {
                enemy.wanderAngle = Math.PI - enemy.wanderAngle;
                newX = enemy.position.x;
            }
            if (newZ <= -MAP_SIZE || newZ >= MAP_SIZE) {
                enemy.wanderAngle = -enemy.wanderAngle;
                newZ = enemy.position.z;
            }

            enemy.position.x = newX;
            enemy.position.z = newZ;

            // Emit position update with rotation
            io.emit('enemyMoved', {
                id: enemyId,
                position: enemy.position,
                rotation: enemy.wanderAngle - Math.PI/2
            });

            return;
        }

        // Aggressive behavior (existing code)
        if (!enemy.target || !players.has(enemy.target)) {
            let nearestDistance = Infinity;
            let nearestPlayer: string | null = null;
            
            players.forEach((player, playerId) => {
                const dx = player.position.x - enemy.position.x;
                const dz = player.position.z - enemy.position.z;
                const distance = Math.sqrt(dx * dx + dz * dz);
                
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    nearestPlayer = playerId;
                }
            });
            
            if (nearestPlayer) {
                enemy.target = nearestPlayer;
            }
        }

        // Move towards target
        const targetPlayer = enemy.target ? players.get(enemy.target) : null;
        if (targetPlayer) {
            const dx = targetPlayer.position.x - enemy.position.x;
            const dz = targetPlayer.position.z - enemy.position.z;
            const distance = Math.sqrt(dx * dx + dz * dz);
            
            if (distance > 0) {
                const speed = ENEMY_STATS[enemy.type].speed;
                const dirX = dx / distance;
                const dirZ = dz / distance;
                
                enemy.position.x += dirX * speed;
                enemy.position.z += dirZ * speed;
                
                // Apply velocity (for knockback)
                enemy.position.x += enemy.velocity.x;
                enemy.position.z += enemy.velocity.z;
                enemy.velocity.x *= 0.37;  // knockback resistance
                enemy.velocity.z *= 0.37;
                
                // Keep y position constant
                enemy.position.y = ENEMY_STATS[enemy.type].size;
                
                // Calculate rotation (sent to clients)
                const rotation = Math.atan2(dirX, dirZ) - Math.PI / 2;
                
                // Emit position update
                io.emit('enemyMoved', {
                    id: enemyId,
                    position: enemy.position,
                    rotation
                });
                
                // Check for collision with target
                const PLAYER_RADIUS = 0.5;  // Player sphere radius
                const enemyRadius = ENEMY_STATS[enemy.type].size;
                const collisionDistance = PLAYER_RADIUS + enemyRadius;
                
                if (distance < collisionDistance && enemy.target) {
                    const player = players.get(enemy.target);
                    if (player) {
                        // Calculate bounce direction
                        const bounceX = (enemy.position.x - player.position.x) / distance;
                        const bounceZ = (enemy.position.z - player.position.z) / distance;
                        
                        // Move enemy out of collision
                        enemy.position.x = player.position.x + bounceX * collisionDistance;
                        enemy.position.z = player.position.z + bounceZ * collisionDistance;
                        
                        // Deal damage
                        player.health -= ENEMY_STATS[enemy.type].damage;
                        io.emit('playerDamaged', {
                            id: enemy.target,
                            health: player.health
                        });
                        
                        // Apply knockback to enemy
                        const bounceForce = 0.2;
                        enemy.velocity.x = bounceX * bounceForce;
                        enemy.velocity.z = bounceZ * bounceForce;
                        
                        // Send updated position after bounce
                        io.emit('enemyMoved', {
                            id: enemyId,
                            position: enemy.position,
                            rotation: Math.atan2(bounceX, bounceZ) - Math.PI / 2
                        });
                    }
                }
            }
        }
    });
}

function startNewWave() {
    // Clear all existing enemies
    enemies.forEach((_, enemyId) => {
        io.emit('enemyDied', enemyId);
    });
    enemies.clear();
    
    currentWave++;
    enemiesKilledInWave = 0;
    totalXPInWave = 0;
    enemiesSpawnedInWave = 0;  // Reset spawn counter
    
    // Clear any existing spawn interval
    if (waveSpawnInterval) {
        clearInterval(waveSpawnInterval);
    }
    
    // Broadcast wave start
    io.emit('waveStart', { wave: currentWave });
    
    // Start spawning enemies for this wave
    waveSpawnInterval = setInterval(() => {
        // Only spawn if we haven't reached the wave limit
        if (enemiesSpawnedInWave < ENEMIES_PER_WAVE) {
            spawnEnemy();
            enemiesSpawnedInWave++;
            
            // If we've spawned all enemies, clear the interval
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
            position: enemy.position
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
            
            if (enemy.type === 'ladybug' && !enemy.isAggressive) {
                enemy.isAggressive = true;
                enemy.target = socket.id;
            }
            
            const knockbackForce = 1.0;
            enemy.velocity.x = knockback.x * knockbackForce;
            enemy.velocity.z = knockback.z * knockbackForce;
            
            enemy.position.x += enemy.velocity.x;
            enemy.position.z += enemy.velocity.z;
            
            if (enemy.health <= 0) {
                enemies.delete(enemyId);
                io.emit('enemyDied', enemyId);
                
                // Distribute XP and update wave progress
                distributeXP(ENEMY_STATS[enemy.type].xp);
                enemiesKilledInWave++;
            } else {
                io.emit('enemyDamaged', {
                    id: enemyId,
                    health: enemy.health
                });
                
                io.emit('enemyMoved', {
                    id: enemyId,
                    position: enemy.position,
                    rotation: Math.atan2(enemy.velocity.x, enemy.velocity.z) - Math.PI / 2
                });
            }
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        players.delete(socket.id);
        io.emit('playerLeft', socket.id);
    });
});

// Start the first wave when server starts
startNewWave();

// Start enemy update loop
setInterval(updateEnemies, 1000 / 60);  // 60 updates per second

httpServer.listen(3000, () => {
    console.log('Server running on port 3000');
}); 