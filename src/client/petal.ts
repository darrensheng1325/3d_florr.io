import * as THREE from 'three';
import { PetalType } from './inventory';
import { Rarity, RARITY_COLORS, RARITY_MULTIPLIERS } from '../shared/types';

// Stats for different petal types
const PETAL_STATS: Record<PetalType, { maxHealth: number; cooldownTime: number; rarity: Rarity }> = {
    'basic': {
        maxHealth: 50,
        cooldownTime: 3000, // 3 seconds
        rarity: Rarity.COMMON
    },
    'basic_uncommon': {
        maxHealth: 75,
        cooldownTime: 2800,
        rarity: Rarity.UNCOMMON
    },
    'basic_rare': {
        maxHealth: 112,
        cooldownTime: 2600,
        rarity: Rarity.RARE
    },
    'tetrahedron': {
        maxHealth: 100,
        cooldownTime: 5000, // 5 seconds
        rarity: Rarity.COMMON
    },
    'tetrahedron_epic': {
        maxHealth: 337,
        cooldownTime: 4000,
        rarity: Rarity.EPIC
    },
    'cube': {
        maxHealth: 75,
        cooldownTime: 4000, // 4 seconds
        rarity: Rarity.COMMON
    },
    'cube_legendary': {
        maxHealth: 375,
        cooldownTime: 3000,
        rarity: Rarity.LEGENDARY
    }
};

export class Petal {
    private mesh: THREE.Mesh;
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
    private isBroken: boolean = false;
    private health: number;
    private maxHealth: number;
    private cooldownTime: number;
    private breakTime: number = 0;

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
        let geometry: THREE.BufferGeometry;
        switch (type) {
            case PetalType.TETRAHEDRON:
                geometry = new THREE.TetrahedronGeometry(0.2);
                break;
            case PetalType.CUBE:
                geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
                break;
            default:
                geometry = new THREE.SphereGeometry(0.2, 32, 32);
        }

        const material = new THREE.MeshBasicMaterial({ 
            color: this.getPetalColor()
        });
        this.mesh = new THREE.Mesh(geometry, material);
        
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

    private getPetalColor(): number {
        // Get base color based on type
        let baseColor: number;
        switch (this.type) {
            case PetalType.TETRAHEDRON:
            case PetalType.TETRAHEDRON_EPIC:
                baseColor = 0xff0000; // Red
                break;
            case PetalType.CUBE:
            case PetalType.CUBE_LEGENDARY:
                baseColor = 0x0000ff; // Blue
                break;
            default:
                baseColor = 0xffffff; // White for basic
        }

        // Get rarity color
        const stats = PETAL_STATS[this.type];
        const rarityColor = RARITY_COLORS[stats.rarity];
        
        // Create a new color that blends the base color with the rarity color
        const baseThreeColor = new THREE.Color(baseColor);
        const rarityThreeColor = new THREE.Color(rarityColor);
        
        // Blend colors (70% base, 30% rarity)
        baseThreeColor.lerp(rarityThreeColor, 0.3);
        
        return baseThreeColor.getHex();
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
                this.mesh.visible = false;
                return;
            }
        }

        this.angle += this.orbitSpeed;
        
        // Smoothly transition between base and expanded radius
        const targetRadius = this.isExpanded ? this.expandedRadius : this.baseRadius;
        this.currentRadius += (targetRadius - this.currentRadius) * this.transitionSpeed;
        
        this.updatePosition();
        this.mesh.visible = true;
    }

    public expand(): void {
        if (!this.isBroken) {
            this.isExpanded = true;
        }
    }

    public contract(): void {
        this.isExpanded = false;
    }

    private updatePosition(): void {
        const x = this.parent.position.x + Math.cos(this.angle) * this.currentRadius;
        const z = this.parent.position.z + Math.sin(this.angle) * this.currentRadius;
        const y = this.parent.position.y + this.height;
        
        this.mesh.position.set(x, y, z);
    }

    public remove(scene: THREE.Scene): void {
        scene.remove(this.mesh);
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