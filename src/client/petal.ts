import * as THREE from 'three';
import { Rarity, RARITY_COLORS, RARITY_MULTIPLIERS, PetalType, PetalStats } from '../shared/types';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';

// Stats for different petal types
export const PETAL_STATS: Record<PetalType, PetalStats> = {
    [PetalType.BASIC]: { maxHealth: 100, cooldownTime: 1000, rarity: Rarity.COMMON, damage: 10, health: 100, speed: 1 },
    [PetalType.BASIC_UNCOMMON]: { maxHealth: 150, cooldownTime: 800, rarity: Rarity.UNCOMMON, damage: 15, health: 150, speed: 1.2 },
    [PetalType.BASIC_RARE]: { maxHealth: 225, cooldownTime: 600, rarity: Rarity.RARE, damage: 22, health: 225, speed: 1.4 },
    [PetalType.TETRAHEDRON]: { maxHealth: 80, cooldownTime: 1200, rarity: Rarity.COMMON, damage: 15, health: 80, speed: 1.5 },
    [PetalType.TETRAHEDRON_EPIC]: { maxHealth: 270, cooldownTime: 400, rarity: Rarity.EPIC, damage: 50, health: 270, speed: 2 },
    [PetalType.CUBE]: { maxHealth: 120, cooldownTime: 800, rarity: Rarity.COMMON, damage: 12, health: 120, speed: 0.8 },
    [PetalType.CUBE_LEGENDARY]: { maxHealth: 600, cooldownTime: 200, rarity: Rarity.LEGENDARY, damage: 60, health: 600, speed: 1 },
    [PetalType.LEAF]: { maxHealth: 50, cooldownTime: 0, rarity: Rarity.COMMON, damage: 5, health: 50, speed: 2 },
    [PetalType.STINGER]: { maxHealth: 20, cooldownTime: 1200, rarity: Rarity.COMMON, damage: 25, health: 20, speed: 2.5 },
    [PetalType.PEA]: { maxHealth: 60, cooldownTime: 1500, rarity: Rarity.COMMON, damage: 8, health: 60, speed: 1.8 }
};

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
    private type: PetalType;
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

    constructor(scene: THREE.Scene, parent: THREE.Mesh, index: number, totalPetals: number, type: PetalType = PetalType.BASIC) {
        this.scene = scene;
        this.parent = parent;
        this.index = index;
        this.totalPetals = totalPetals;
        this.type = type;

        // Initialize health and cooldown stats
        const stats = PETAL_STATS[type];
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
        // Create geometry based on rarity
        let geometry: THREE.BufferGeometry;
        const stats = PETAL_STATS[this.type];
        const rarity = stats.rarity;

        // Check if this is a pea type petal
        if (this.type.startsWith('pea')) {
            // Create a temporary sphere while the model loads
            geometry = new THREE.SphereGeometry(0.225, 32, 32);
            const material = new THREE.MeshPhongMaterial({
                color: RARITY_COLORS[rarity],
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
                            color: RARITY_COLORS[rarity],
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
                
                // Add glow effect for higher rarities
                // if (rarity !== Rarity.COMMON) {
                //     const glowMaterial = new THREE.MeshBasicMaterial({
                //         color: RARITY_COLORS[rarity],
                //         transparent: true,
                //         opacity: 0.3,
                //         side: THREE.BackSide
                //     });
                //     peaMesh.traverse((child) => {
                //         if (child instanceof THREE.Mesh) {
                //             const glowMesh = new THREE.Mesh(child.geometry.clone(), glowMaterial);
                //             glowMesh.scale.multiplyScalar(1.2);
                //             child.add(glowMesh);
                //         }
                //     });
                // }
            });
        } else {
            // Create geometry based on type
        let geometry: THREE.BufferGeometry;
        if (this.type === PetalType.TETRAHEDRON || this.type === PetalType.TETRAHEDRON_EPIC) {
            geometry = new THREE.TetrahedronGeometry(0.3);
        } else if (this.type === PetalType.STINGER) {
            geometry = new THREE.ConeGeometry(0.15, 0.4, 16); // Cone shape for stinger
        } else if (this.type === PetalType.LEAF) {
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
        } else if (this.type === 'basic' || this.type === 'basic_uncommon' || this.type === 'basic_rare') {
            geometry = new THREE.SphereGeometry(0.225, 32, 32);
        } else {
            geometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        }

        // Create material based on type and rarity
        const material = new THREE.MeshPhongMaterial({
            color: this.getPetalColor(),
            shininess: this.type === PetalType.LEAF ? 10 : 30,
            side: THREE.DoubleSide,
            transparent: this.type === 'basic' ? false : true, // Basic petals are opaque
            opacity: this.type === 'basic' ? 1.0 : 0.9
        });

        this.mesh = new THREE.Mesh(geometry, material);
        
        // Rotate leaf to be more visible
        if (this.type === PetalType.LEAF) {
            this.mesh.rotation.x = -Math.PI / 4;
        }
        }
        
        this.scene.add(this.mesh);
        this.updatePosition();
    }

    public updateColor(color: number): void {
        if (this.mesh) {
            if (this.mesh instanceof THREE.Group) {
                // For models (like pea), update all mesh materials
                this.mesh.traverse((child) => {
                    if (child instanceof THREE.Mesh && child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => {
                                if (mat instanceof THREE.MeshPhongMaterial) {
                                    mat.color.setHex(color);
                                }
                            });
                        } else if (child.material instanceof THREE.MeshPhongMaterial) {
                            child.material.color.setHex(color);
                        }
                    }
                });
            } else if (this.mesh instanceof THREE.Mesh) {
                // For basic meshes, update the material directly
                if (Array.isArray(this.mesh.material)) {
                    this.mesh.material.forEach(mat => {
                        if (mat instanceof THREE.MeshPhongMaterial) {
                            mat.color.setHex(color);
                        }
                    });
                } else if (this.mesh.material instanceof THREE.MeshPhongMaterial) {
                    this.mesh.material.color.setHex(color);
                }
            }
        }
    }

    private getPetalColor(): number {
        // Only return rarity color if not a basic petal
        if (this.type === PetalType.BASIC) {
            return 0xffffff;  // White for basic petals
        }
        // Use rarity color for other petals
        const stats = PETAL_STATS[this.type];
        return RARITY_COLORS[stats.rarity];
    }

    public getType(): PetalType {
        return this.type;
    }

    public update(): void {
        // Check if broken petal should respawn
        if (this.isBroken) {
            if (Date.now() - this.breakTime >= this.cooldownTime) {
                this.respawn();
            } else {
                // Keep broken petal hidden
                if (this.mesh) this.mesh.visible = false;
                return;
            }
        }

        this.angle += this.orbitSpeed;
        
        // Smoothly transition between base and expanded radius
        const targetRadius = this.isExpanded ? this.expandedRadius : this.baseRadius;
        this.currentRadius += (targetRadius - this.currentRadius) * this.transitionSpeed;
        
        this.updatePosition();
        if (this.mesh) this.mesh.visible = true;

        if (this.type === PetalType.PEA && this.isExpanded && this.miniPeas.length > 0) {
            // Update mini peas positions and make them move outward
            this.miniPeas.forEach((pea, index) => {
                const angle = (index / 8) * Math.PI * 2 + this.angle;
                const radius = 0.5 + (Date.now() - this.breakTime) * 0.001; // Increase radius over time
                pea.position.x = this.mesh.position.x + Math.cos(angle) * radius;
                pea.position.z = this.mesh.position.z + Math.sin(angle) * radius;
                pea.position.y = this.mesh.position.y;
                
                // Remove peas that have traveled too far
                if (radius > 5) {
                    this.scene.remove(pea);
                    const index = this.miniPeas.indexOf(pea);
                    if (index > -1) {
                        this.miniPeas.splice(index, 1);
                    }
                }
            });
        }
    }

    public expand(): void {
        if (!this.isBroken) {
            this.isExpanded = true;
            if (this.type === PetalType.PEA) {
                // Break the pea and shoot out mini peas
                this.break();
                
                // Create and shoot out 8 mini peas in a circle
                const radius = 0.5;
                for (let i = 0; i < 8; i++) {
                    const angle = (i / 8) * Math.PI * 2;
                    const x = this.mesh.position.x + Math.cos(angle) * radius;
                    const z = this.mesh.position.z + Math.sin(angle) * radius;
                    
                    const geometry = new THREE.SphereGeometry(0.1, 16, 16);
                    const material = new THREE.MeshPhongMaterial({
                        color: 0x90EE90,
                        shininess: 30,
                        transparent: false,
                        side: THREE.DoubleSide
                    });
                    
                    const miniPea = new THREE.Mesh(geometry, material);
                    miniPea.position.set(x, this.mesh.position.y, z);
                    this.scene.add(miniPea);
                    this.miniPeas.push(miniPea);
                }
            }
        }
    }

    public contract(): void {
        this.isExpanded = false;
        if (this.type === PetalType.PEA) {
            // Remove all mini peas
            this.miniPeas.forEach(pea => {
                this.scene.remove(pea);
            });
            this.miniPeas = [];
        }
    }

    private updatePosition(): void {
        const x = this.parent.position.x + Math.cos(this.angle) * this.currentRadius;
        const z = this.parent.position.z + Math.sin(this.angle) * this.currentRadius;
        const y = this.parent.position.y + this.height;
        
        this.mesh.position.set(x, y, z);
    }

    public remove(scene: THREE.Scene): void {
        scene.remove(this.mesh);
        if (this.type === PetalType.PEA) {
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
        if (this.health <= 0) {
            this.break();
        }
    }

    private break(): void {
        this.isBroken = true;
        this.breakTime = Date.now();
        this.mesh.visible = false;
        this.isExpanded = false;
    }

    private respawn(): void {
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
} 