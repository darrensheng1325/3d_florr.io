import * as THREE from 'three';
import { HealthBar } from './health';
import { Petal } from './petal';
import { Game } from './game';

export enum EnemyType {
    LADYBUG = 'ladybug',
    BEE = 'bee'
}

interface EnemyStats {
    health: number;
    speed: number;
    damage: number;
    size: number;
    attackCooldown: number;
}

const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
    [EnemyType.LADYBUG]: {
        health: 50,
        speed: 0.05,
        damage: 10,
        size: 0.5,
        attackCooldown: 1000
    },
    [EnemyType.BEE]: {
        health: 30,
        speed: 0.08,
        damage: 8,
        size: 0.4,
        attackCooldown: 800
    }
};

export class Enemy {
    protected mesh: THREE.Mesh;
    protected healthBar: HealthBar;
    protected speed: number;
    protected target: THREE.Mesh | null = null;
    protected scene: THREE.Scene;
    protected damage: number;
    protected attackCooldown: number;
    protected lastAttackTime: number = 0;
    protected knockbackResistance: number = 0.37;
    protected velocity: THREE.Vector3 = new THREE.Vector3();
    protected type: EnemyType;

    constructor(scene: THREE.Scene, position: THREE.Vector3, camera: THREE.Camera, game: Game, type: EnemyType = EnemyType.LADYBUG) {
        this.scene = scene;
        this.scene.userData.game = game;
        this.type = type;
        
        const stats = ENEMY_STATS[type];
        this.speed = stats.speed;
        this.damage = stats.damage;
        this.attackCooldown = stats.attackCooldown;

        // Create the base mesh with appropriate material based on type
        const geometry = new THREE.SphereGeometry(stats.size, 64, 32);
        let material: THREE.Material;

        if (type === EnemyType.LADYBUG) {
            // Create a canvas for the ladybug texture
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d')!;

            // Fill the background with red
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(0, 0, 512, 512);

            // Add the large black spot (head)
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(256, 128, 120, 0, Math.PI * 2);
            ctx.fill();

            // Add smaller spots on top
            const smallSpots = [
                { x: 128, y: 384 },  // Left spot
                { x: 384, y: 384 },  // Right spot
                { x: 256, y: 448 }   // Back spot
            ];

            smallSpots.forEach(spot => {
                ctx.beginPath();
                ctx.arc(spot.x, spot.y, 40, 0, Math.PI * 2);
                ctx.fill();
            });

            // Create texture from canvas
            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.repeat.set(1, 1);
            texture.center.set(0.5, 0.5);
            texture.rotation = Math.PI * 1.25;

            material = new THREE.MeshPhongMaterial({
                map: texture,
                side: THREE.FrontSide
            });
        } else {
            material = new THREE.MeshPhongMaterial({ color: this.getBaseColor() });
        }

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.mesh.position.y = stats.size;

        // Rotate ladybug base orientation
        if (type === EnemyType.LADYBUG) {
            this.mesh.rotation.y = Math.PI / 2;
            this.mesh.rotation.x = Math.PI / 4;
        }

        // Add decorative elements for non-ladybug types
        if (type !== EnemyType.LADYBUG) {
            this.addDecorativeElements();
        }

        this.healthBar = new HealthBar(camera, this.mesh, stats.health);
        scene.add(this.mesh);
    }

    protected getBaseColor(): number {
        switch (this.type) {
            case EnemyType.LADYBUG:
                return 0xff0000; // Red
            case EnemyType.BEE:
                return 0xffff00; // Gold
            default:
                return 0xff0000;
        }
    }

    protected addDecorativeElements(): void {
        if (this.type === EnemyType.BEE) {
            // Add black stripes
            const stripeGeometry = new THREE.BoxGeometry(0.8, 0.1, 0.3);
            const stripeMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
            
            [-0.2, 0, 0.2].forEach(zPos => {
                const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
                stripe.position.z = zPos;
                this.mesh.add(stripe);
            });

            // Add wings
            const wingGeometry = new THREE.PlaneGeometry(0.4, 0.3);
            const wingMaterial = new THREE.MeshPhongMaterial({ 
                color: 0xffffff,
                transparent: true,
                opacity: 0.5,
                side: THREE.DoubleSide
            });

            [-0.3, 0.3].forEach(xPos => {
                const wing = new THREE.Mesh(wingGeometry, wingMaterial);
                wing.position.set(xPos, 0.2, 0);
                wing.rotation.x = Math.PI / 4;
                this.mesh.add(wing);
            });
        }
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

                // Rotate ladybug to face movement direction (adjusted for 90-degree base rotation)
                if (this.type === EnemyType.LADYBUG) {
                    const angle = Math.atan2(direction.x, direction.z) + Math.PI / 2;
                    this.mesh.rotation.y = angle;
                }
            } else {
                // During knockback, rotate based on velocity direction (adjusted for 90-degree base rotation)
                if (this.type === EnemyType.LADYBUG && this.velocity.length() > 0.01) {
                    const angle = Math.atan2(this.velocity.x, this.velocity.z) + Math.PI / 2;
                    this.mesh.rotation.y = angle;
                }
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