import * as THREE from 'three';
import { PetalType } from './inventory';

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

    constructor(scene: THREE.Scene, parent: THREE.Mesh, index: number, totalPetals: number, type: PetalType = PetalType.BASIC) {
        this.scene = scene;
        this.parent = parent;
        this.index = index;
        this.totalPetals = totalPetals;
        this.type = type;

        // Create petal mesh
        const geometry = new THREE.SphereGeometry(0.2, 32, 32);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xffffff
        });
        this.mesh = new THREE.Mesh(geometry, material);
        
        // Set initial position and angle
        this.angle = (index / totalPetals) * Math.PI * 2;
        this.updatePosition();
        
        scene.add(this.mesh);
    }

    public getType(): PetalType {
        return this.type;
    }

    public update(): void {
        this.angle += this.orbitSpeed;
        
        // Smoothly transition between base and expanded radius
        const targetRadius = this.isExpanded ? this.expandedRadius : this.baseRadius;
        this.currentRadius += (targetRadius - this.currentRadius) * this.transitionSpeed;
        
        this.updatePosition();
    }

    public expand(): void {
        this.isExpanded = true;
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
} 