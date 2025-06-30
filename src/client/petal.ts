import * as THREE from 'three';
import { Rarity, RARITY_COLORS, RARITY_MULTIPLIERS, BasePetalType, PetalType, PetalStats, BasePetalStats, RARITY_DAMAGE_MULTIPLIERS, parsePetalType, getPetalType } from '../shared/types';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// Base stats for different petal types (before rarity multipliers)
export const BASE_PETAL_STATS: Record<BasePetalType, BasePetalStats> = {
    [BasePetalType.BASIC]: { maxHealth: 100, cooldownTime: 1000, damage: 10, health: 100, speed: 1 },
    [BasePetalType.TETRAHEDRON]: { maxHealth: 80, cooldownTime: 1200, damage: 15, health: 80, speed: 1.5 },
    [BasePetalType.CUBE]: { maxHealth: 120, cooldownTime: 800, damage: 12, health: 120, speed: 0.8 },
    [BasePetalType.LEAF]: { maxHealth: 50, cooldownTime: 0, damage: 5, health: 50, speed: 2 },
    [BasePetalType.STINGER]: { maxHealth: 20, cooldownTime: 1200, damage: 25, health: 20, speed: 2.5 },
    [BasePetalType.PEA]: { maxHealth: 60, cooldownTime: 1500, damage: 8, health: 60, speed: 1.8 }
};

// Function to calculate final petal stats based on base type and rarity
export function calculatePetalStats(baseType: BasePetalType, rarity: Rarity): PetalStats {
    const baseStats = BASE_PETAL_STATS[baseType];
    const healthMultiplier = RARITY_MULTIPLIERS[rarity];
    const damageMultiplier = RARITY_DAMAGE_MULTIPLIERS[rarity];
    
    return {
        maxHealth: Math.round(baseStats.maxHealth * healthMultiplier),
        cooldownTime: Math.max(200, Math.round(baseStats.cooldownTime / Math.sqrt(healthMultiplier))), // Faster cooldown for higher rarities
        damage: Math.round(baseStats.damage * damageMultiplier),
        health: Math.round(baseStats.health * healthMultiplier),
        speed: baseStats.speed * Math.sqrt(healthMultiplier), // Slightly faster for higher rarities
        rarity: rarity
    };
}

// Legacy PETAL_STATS for backward compatibility - dynamically generated
export const PETAL_STATS: Record<string, PetalStats> = {};

// Initialize legacy PETAL_STATS
function initializeLegacyPetalStats() {
    // Add all base types at common rarity
    Object.values(BasePetalType).forEach(baseType => {
        Object.values(Rarity).forEach(rarity => {
            const petalType = getPetalType(baseType, rarity);
            PETAL_STATS[petalType] = calculatePetalStats(baseType, rarity);
        });
    });
    
    // Add backward compatibility entries for old enum values
    PETAL_STATS[PetalType.BASIC] = calculatePetalStats(BasePetalType.BASIC, Rarity.COMMON);
    PETAL_STATS[PetalType.BASIC_UNCOMMON] = calculatePetalStats(BasePetalType.BASIC, Rarity.UNCOMMON);
    PETAL_STATS[PetalType.BASIC_RARE] = calculatePetalStats(BasePetalType.BASIC, Rarity.RARE);
    PETAL_STATS[PetalType.TETRAHEDRON] = calculatePetalStats(BasePetalType.TETRAHEDRON, Rarity.COMMON);
    PETAL_STATS[PetalType.TETRAHEDRON_EPIC] = calculatePetalStats(BasePetalType.TETRAHEDRON, Rarity.EPIC);
    PETAL_STATS[PetalType.CUBE] = calculatePetalStats(BasePetalType.CUBE, Rarity.COMMON);
    PETAL_STATS[PetalType.CUBE_LEGENDARY] = calculatePetalStats(BasePetalType.CUBE, Rarity.LEGENDARY);
    PETAL_STATS[PetalType.LEAF] = calculatePetalStats(BasePetalType.LEAF, Rarity.COMMON);
    PETAL_STATS[PetalType.STINGER] = calculatePetalStats(BasePetalType.STINGER, Rarity.COMMON);
    PETAL_STATS[PetalType.PEA] = calculatePetalStats(BasePetalType.PEA, Rarity.COMMON);
}

// Initialize the legacy stats
initializeLegacyPetalStats();

export class Petal {
    private mesh!: THREE.Mesh | THREE.Group;  // Update type to allow both Mesh and Group
    private currentRadius: number = 1.5;
    private baseRadius: number = 1.5;
    private expandedRadius: number = 3.0;
    private orbitSpeed: number = 0.01;
    private angle: number = 0;
    private height: number = 0.1;
    private isExpanded: boolean = false;
    private transitionSpeed: number = 0.1;
    private scene: THREE.Scene;
    private parent: THREE.Mesh;
    private index: number;
    private totalPetals: number;
    private type: string;  // Changed to string to support new format
    private baseType: BasePetalType;
    private rarity: Rarity;
    private onRespawn: (() => void) | null = null;  // Callback for respawn
    
    // New attributes
    private health: number;
    private maxHealth: number;
    private cooldownTime: number;
    private breakTime: number = 0;
    private lastDamageTime: number = 0;
    private readonly HEAL_DELAY = 5000; // 5 seconds before healing starts
    private readonly HEAL_RATE = 0.1; // Heal 10% per second
    private readonly HEAL_INTERVAL = 100; // Heal every 100ms
    private lastHealTime: number = 0;
    private isBroken: boolean = false;

    private miniPeas: THREE.Mesh[] = [];

    constructor(scene: THREE.Scene, parent: THREE.Mesh, index: number, totalPetals: number, type: string = BasePetalType.BASIC) {
        this.scene = scene;
        this.parent = parent;
        this.index = index;
        this.totalPetals = totalPetals;
        this.type = type;

        // Parse the type to get base type and rarity
        const parsed = parsePetalType(type);
        this.baseType = parsed.baseType;
        this.rarity = parsed.rarity;

        // Initialize health and cooldown stats using the new calculation system
        const stats = calculatePetalStats(this.baseType, this.rarity);
        this.maxHealth = stats.maxHealth;
        this.health = this.maxHealth;
        this.cooldownTime = stats.cooldownTime;

        // Create petal mesh with properties based on type
        this.createMesh();
        
        // Use same radius and speed for all types
        this.baseRadius = 1.5;
        this.expandedRadius = 3.0;
        this.orbitSpeed = 0.01;
        this.currentRadius = this.baseRadius;
        
        // Set initial position and angle
        this.angle = (index / totalPetals) * Math.PI * 2;
        this.updatePosition();
        
        scene.add(this.mesh);
    }

    private createMesh(): void {
        // Create geometry based on base type and apply rarity color
        let geometry: THREE.BufferGeometry;

        // Check if this is a pea type petal
        if (this.baseType === BasePetalType.PEA) {
            // Create a temporary sphere while the model loads
            geometry = new THREE.SphereGeometry(0.225, 32, 32);
            const material = new THREE.MeshPhongMaterial({
                color: RARITY_COLORS[this.rarity],
                shininess: 30,
                transparent: true,
                opacity: 0.9,
                side: THREE.DoubleSide
            });
            this.mesh = new THREE.Mesh(geometry, material);

            // Load the pea model
            const modelLoader = new GLTFLoader();
            modelLoader.load('peas.glb', (gltf) => {
                const peaMesh = gltf.scene;
                peaMesh.scale.set(0.15, 0.15, 0.15);
                
                // Apply rarity color to all meshes in the model
                peaMesh.traverse((child) => {
                    if (child instanceof THREE.Mesh) {
                        child.material = new THREE.MeshPhongMaterial({
                            color: RARITY_COLORS[this.rarity],
                            shininess: 30,
                            transparent: true,
                            opacity: 0.9,
                            side: THREE.DoubleSide
                        });
                    }
                });
                
                // Replace the temporary sphere with the loaded model
                this.scene.remove(this.mesh);
                this.mesh = peaMesh;
                this.scene.add(this.mesh);
            });
        } else {
            // Create geometry based on base type
            if (this.baseType === BasePetalType.TETRAHEDRON) {
                geometry = new THREE.TetrahedronGeometry(0.3);
            } else if (this.baseType === BasePetalType.STINGER) {
                geometry = new THREE.ConeGeometry(0.15, 0.4, 16); // Cone shape for stinger
            } else if (this.baseType === BasePetalType.LEAF) {
                // Create a custom leaf shape using a custom geometry
                geometry = new THREE.BufferGeometry();
                
                // Define vertices for a simple leaf shape
                const vertices = new Float32Array([
                    0, 0, 0,      // base
                    -0.2, 0.2, 0, // left point
                    0, 0.4, 0,    // top point
                    0.2, 0.2, 0,  // right point
                ]);
                
                // Define indices for triangles
                const indices = new Uint16Array([
                    0, 1, 2,
                    0, 2, 3
                ]);
                
                geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
                geometry.setIndex(new THREE.BufferAttribute(indices, 1));
                geometry.computeVertexNormals();
            } else if (this.baseType === BasePetalType.BASIC) {
                geometry = new THREE.SphereGeometry(0.225, 32, 32);
            } else {
                geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
            }

            // Create material based on type and rarity
            const material = new THREE.MeshPhongMaterial({
                color: this.getPetalColor(),
                shininess: this.baseType === BasePetalType.LEAF ? 10 : 30,
                side: THREE.DoubleSide,
                transparent: this.baseType === BasePetalType.BASIC ? false : true, // Basic petals are opaque
                opacity: this.baseType === BasePetalType.BASIC ? 1.0 : 0.9
            });

            this.mesh = new THREE.Mesh(geometry, material);
        }
        
        // Update color and positioning
        this.updateMeshRotation();
    }

    private updateMeshRotation(): void {
        // Apply specific rotations based on petal type
        if (this.baseType === BasePetalType.LEAF) {
            this.mesh.rotation.z = Math.PI / 4; // 45 degree rotation for leaf
        } else if (this.baseType === BasePetalType.STINGER) {
            this.mesh.rotation.x = Math.PI / 2; // Point the stinger outward
        }
    }

    private getPetalColor(): number {
        // Only return rarity color if not a basic petal
        if (this.baseType === BasePetalType.BASIC) {
            return 0xffffff;  // White for basic petals
        }
        else if (this.baseType === BasePetalType.PEA) {
            return 0x00ff00;
        }
        else if (this.baseType === BasePetalType.LEAF) {
            return 0x00ff00;
        }
        else if (this.baseType === BasePetalType.STINGER) {
            return 0x000000;
        }
        else if (this.baseType === BasePetalType.CUBE) {
            return 0xffff00;
        }
        else if (this.baseType === BasePetalType.TETRAHEDRON) {
            return 0xff0000;
        }
        // Use rarity color for higher rarities
        return RARITY_COLORS[this.rarity];
    }

    public getType(): string {
        return this.type;
    }

    public getBaseType(): BasePetalType {
        return this.baseType;
    }

    public getRarity(): Rarity {
        return this.rarity;
    }

    public getDamage(): number {
        const stats = calculatePetalStats(this.baseType, this.rarity);
        return stats.damage;
    }

    public updatePosition(): void {
        const x = this.parent.position.x + Math.cos(this.angle) * this.currentRadius;
        const z = this.parent.position.z + Math.sin(this.angle) * this.currentRadius;
        
        this.mesh.position.set(x, this.parent.position.y + this.height, z);
        
        // Rotate the petal around its own center
        this.mesh.rotation.y += 0.02;
        
        // Update angle for orbit
        this.angle += this.orbitSpeed;
        
        // Update radius transition
        if (this.isExpanded && this.currentRadius < this.expandedRadius) {
            this.currentRadius = Math.min(this.expandedRadius, this.currentRadius + this.transitionSpeed);
        } else if (!this.isExpanded && this.currentRadius > this.baseRadius) {
            this.currentRadius = Math.max(this.baseRadius, this.currentRadius - this.transitionSpeed);
        }
    }

    public expand(): void {
        this.isExpanded = true;
    }

    public contract(): void {
        this.isExpanded = false;
    }

    public update(): void {
        this.updatePosition();
        
        // Handle healing over time
        if (!this.isBroken && this.health < this.maxHealth) {
            const currentTime = Date.now();
            
            // Start healing after delay
            if (currentTime - this.lastDamageTime >= this.HEAL_DELAY) {
                if (currentTime - this.lastHealTime >= this.HEAL_INTERVAL) {
                    this.health = Math.min(this.maxHealth, this.health + (this.maxHealth * this.HEAL_RATE * this.HEAL_INTERVAL / 1000));
                    this.lastHealTime = currentTime;
                }
            }
        }
        
        // Handle respawn
        if (this.isBroken && Date.now() - this.breakTime >= this.cooldownTime) {
            this.respawn();
        }
        
        // Update mini peas for pea petal
        if (this.baseType === BasePetalType.PEA) {
            this.miniPeas.forEach((pea, index) => {
                const peaAngle = (Date.now() * 0.01) + (index * Math.PI * 2 / 3);
                const radius = 0.5;
                pea.position.set(
                    this.mesh.position.x + Math.cos(peaAngle) * radius,
                    this.mesh.position.y,
                    this.mesh.position.z + Math.sin(peaAngle) * radius
                );
            });
        }
    }

    public remove(scene: THREE.Scene): void {
        scene.remove(this.mesh);
        if (this.baseType === BasePetalType.PEA) {
            this.miniPeas.forEach(pea => {
                scene.remove(pea);
            });
        }
    }

    public getPosition(): THREE.Vector3 {
        return this.mesh.position;
    }

    public takeDamage(amount: number): void {
        if (this.isBroken) return;
        
        this.health -= amount;
        this.lastDamageTime = Date.now();
        
        if (this.health <= 0) {
            this.break();
        }
    }

    public break(): void {
        this.isBroken = true;
        this.breakTime = Date.now();
        this.mesh.visible = false;
        this.isExpanded = false;
    }

    public respawn(): void {
        // Call respawn callback if set
        if (this.onRespawn) {
            this.onRespawn();
        }
        
        this.isBroken = false;
        this.health = this.maxHealth;
        this.mesh.visible = true;
    }

    // Add method to set respawn callback
    public setRespawnCallback(callback: () => void): void {
        this.onRespawn = callback;
    }

    public isBrokenState(): boolean {
        return this.isBroken;
    }

    public getHealthPercent(): number {
        return (this.health / this.maxHealth) * 100;
    }

    public updateColor(color: number): void {
        if (this.mesh instanceof THREE.Mesh && this.mesh.material instanceof THREE.MeshPhongMaterial) {
            this.mesh.material.color.setHex(color);
        }
    }
} 