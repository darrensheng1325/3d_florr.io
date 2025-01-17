import * as THREE from 'three';
import { HealthBar } from './health';
import { Petal } from './petal';
import { Game } from './game';

export class Enemy {
    private mesh: THREE.Mesh;
    private healthBar: HealthBar;
    private speed: number = 0.05;
    private target: THREE.Mesh | null = null;
    private scene: THREE.Scene;
    private damage: number = 10;
    private attackCooldown: number = 1000;
    private lastAttackTime: number = 0;
    private knockbackResistance: number = 0.37; // Increased from 0.95 for faster recovery
    private velocity: THREE.Vector3 = new THREE.Vector3();

    constructor(scene: THREE.Scene, position: THREE.Vector3, camera: THREE.Camera, game: Game) {
        this.scene = scene;
        this.scene.userData.game = game; // Store game reference
        const geometry = new THREE.SphereGeometry(0.5, 32, 32);
        const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.mesh.position.y = 0.5;
        this.healthBar = new HealthBar(camera, this.mesh, 50);
        scene.add(this.mesh);
    }

    public update(players: Map<string, THREE.Mesh>, playerPetals: Map<string, Petal[]>, playerHealthBars: Map<string, HealthBar>): void {
        this.healthBar.updatePosition();

        // Apply velocity with resistance (only to X and Z)
        this.mesh.position.x += this.velocity.x;
        this.mesh.position.z += this.velocity.z;
        this.velocity.multiplyScalar(this.knockbackResistance);
        this.mesh.position.y = 0.5;

        // Find nearest player if no target
        if (!this.target) {
            let nearestDistance = Infinity;
            players.forEach(player => {
                const distance = this.mesh.position.distanceTo(player.position);
                if (distance < nearestDistance) {
                    nearestDistance = distance;
                    this.target = player;
                }
            });
        }

        // Move towards target
        if (this.target) {
            const direction = new THREE.Vector3()
                .subVectors(this.target.position, this.mesh.position)
                .normalize();
            
            // Only move if not in significant knockback
            if (this.velocity.length() < 0.05) {
                this.mesh.position.x += direction.x * this.speed;
                this.mesh.position.z += direction.z * this.speed;
                this.mesh.position.y = 0.5;
            }

            // Check collision with player
            const distanceToTarget = this.mesh.position.distanceTo(this.target.position);
            if (distanceToTarget < 1) {
                this.handleCollision(this.target, playerHealthBars);
            }

            // Check collision with petals
            playerPetals.forEach((petals, playerId) => {
                petals.forEach(petal => {
                    const petalPosition = petal.getPosition();
                    const distanceToPetal = this.mesh.position.distanceTo(petalPosition);
                    if (distanceToPetal < 0.6) {
                        this.takeDamageWithKnockback(5, petalPosition);
                    }
                });
            });
        }
    }

    private handleCollision(player: THREE.Mesh, playerHealthBars: Map<string, HealthBar>): void {
        const currentTime = Date.now();
        
        // Calculate the distance and direction between enemy and player
        const separationVector = new THREE.Vector3().subVectors(this.mesh.position, player.position);
        const distance = separationVector.length();
        const minSeparation = 1.2; // Minimum required separation distance
        
        // If too close, push enemy away to maintain minimum separation
        if (distance < minSeparation) {
            const pushOutDirection = separationVector.normalize();
            this.mesh.position.copy(player.position).add(pushOutDirection.multiplyScalar(minSeparation));
        }

        if (currentTime - this.lastAttackTime >= this.attackCooldown) {
            // Get the game instance
            const game = this.scene.userData.game as Game;
            
            // Find the player's ID by comparing mesh references
            let playerId = '';
            Array.from(game.players).forEach(([id, p]) => {
                if (p === player) {
                    playerId = id;
                }
            });

            // Deal damage to player using the socket ID
            if (playerId && playerHealthBars.has(playerId)) {
                const playerHealth = playerHealthBars.get(playerId)!;
                playerHealth.takeDamage(this.damage);
            }

            // Calculate bounce direction based on centers
            const bounceDirection = new THREE.Vector3()
                .subVectors(this.mesh.position, player.position)
                .normalize();
            bounceDirection.y = 0;

            // Apply bounce effect to enemy (this)
            const enemyBounceForce = 0.15;
            this.velocity.copy(bounceDirection.multiplyScalar(enemyBounceForce));

            // Apply opposite bounce to player
            const playerBounceForce = 0.2;
            const playerKnockback = bounceDirection.clone().multiplyScalar(playerBounceForce);
            player.position.sub(playerKnockback);

            // Keep player within bounds
            const mapSize = 15;
            player.position.x = Math.max(-mapSize, Math.min(mapSize, player.position.x));
            player.position.z = Math.max(-mapSize, Math.min(mapSize, player.position.z));
            player.position.y = 0.5;

            this.lastAttackTime = currentTime;
        }
    }

    public takeDamageWithKnockback(amount: number, sourcePosition: THREE.Vector3): boolean {
        const isDead = this.healthBar.takeDamage(amount);
        
        // Calculate knockback direction (only in X and Z)
        const knockbackDirection = new THREE.Vector3()
            .subVectors(this.mesh.position, sourcePosition)
            .normalize();
        knockbackDirection.y = 0; // Remove vertical knockback
        
        // Apply knockback
        const knockbackForce = 0.3;
        this.velocity.add(knockbackDirection.multiplyScalar(knockbackForce));

        return isDead;
    }

    public remove(): void {
        this.scene.remove(this.mesh);
        this.healthBar.remove();
    }

    public getPosition(): THREE.Vector3 {
        return this.mesh.position;
    }
} 