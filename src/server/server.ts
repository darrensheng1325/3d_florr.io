import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import path from 'path';
import { Vector3 } from 'three';

interface Player {
    id: string;
    position: { x: number; y: number; z: number };
    health: number;
}

interface Enemy {
    id: string;
    type: 'ladybug' | 'bee';
    position: { x: number; y: number; z: number };
    health: number;
    target?: string;  // Socket ID of target player
    velocity: { x: number; y: number; z: number };
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

// Enemy stats
const ENEMY_STATS = {
    ladybug: {
        health: 50,
        speed: 0.05,
        damage: 10,
        size: 0.5
    },
    bee: {
        health: 30,
        speed: 0.08,
        damage: 8,
        size: 0.4
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
        case 0: x = -MAP_SIZE; z = (Math.random() * 2 - 1) * MAP_SIZE; break;  // Left
        case 1: x = MAP_SIZE; z = (Math.random() * 2 - 1) * MAP_SIZE; break;   // Right
        case 2: x = (Math.random() * 2 - 1) * MAP_SIZE; z = -MAP_SIZE; break;  // Top
        case 3: x = (Math.random() * 2 - 1) * MAP_SIZE; z = MAP_SIZE; break;   // Bottom
        default: x = -MAP_SIZE; z = -MAP_SIZE;
    }

    const enemy: Enemy = {
        id,
        type,
        position: { x, y: ENEMY_STATS[type].size, z },
        health: ENEMY_STATS[type].health,
        velocity: { x: 0, y: 0, z: 0 }
    };

    enemies.set(id, enemy);
    io.emit('enemySpawned', { id, type, position: enemy.position });
}

function updateEnemies() {
    enemies.forEach((enemy, enemyId) => {
        // Find nearest player if no target
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

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    // Store new player
    players.set(socket.id, {
        id: socket.id,
        position: { x: 0, y: 0.5, z: 0 },
        health: 100
    });

    // Send existing players and enemies to the new player
    players.forEach((player) => {
        if (player.id !== socket.id) {
            socket.emit('playerJoined', {
                id: player.id,
                position: player.position,
                health: player.health
            });
            socket.emit('playerMoved', {
                id: player.id,
                position: player.position
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
        health: 100
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
            
            // Apply stronger knockback
            const knockbackForce = 1.0;
            enemy.velocity.x = knockback.x * knockbackForce;
            enemy.velocity.z = knockback.z * knockbackForce;
            
            // Apply immediate position change for responsive feedback
            enemy.position.x += enemy.velocity.x;
            enemy.position.z += enemy.velocity.z;
            
            if (enemy.health <= 0) {
                enemies.delete(enemyId);
                io.emit('enemyDied', enemyId);
            } else {
                io.emit('enemyDamaged', {
                    id: enemyId,
                    health: enemy.health
                });
                
                // Emit immediate position update
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

// Start enemy spawning and update loop
setInterval(spawnEnemy, SPAWN_INTERVAL);
setInterval(updateEnemies, 1000 / 60);  // 60 updates per second

httpServer.listen(3000, () => {
    console.log('Server running on port 3000');
}); 