import * as THREE from 'three';

export class Petal {
    private mesh: THREE.Mesh;
    private orbitRadius: number;
    private baseOrbitRadius: number = 1.0;
    private expandedOrbitRadius: number = 2.0;
    private orbitSpeed: number = 0.01;
    private angle: number;
    private centerObject: THREE.Mesh;
    private height: number;
    private isExpanded: boolean = false;
    private transitionSpeed: number = 0.1;

    constructor(scene: THREE.Scene, centerObject: THREE.Mesh, index: number, totalPetals: number = 8) {
        // Create petal geometry and material
        const geometry = new THREE.SphereGeometry(0.1, 16, 16);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        this.mesh = new THREE.Mesh(geometry, material);
        
        this.centerObject = centerObject;
        this.orbitRadius = this.baseOrbitRadius;
        this.height = 0.1;
        
        // Distribute petals evenly around the circle
        this.angle = (index / totalPetals) * Math.PI * 2;
        
        scene.add(this.mesh);
        this.updatePosition();
    }

    public update(): void {
        this.angle += this.orbitSpeed;
        
        // Smoothly transition between base and expanded radius
        const targetRadius = this.isExpanded ? this.expandedOrbitRadius : this.baseOrbitRadius;
        this.orbitRadius += (targetRadius - this.orbitRadius) * this.transitionSpeed;
        
        this.updatePosition();
    }

    public expand(): void {
        this.isExpanded = true;
    }

    public contract(): void {
        this.isExpanded = false;
    }

    private updatePosition(): void {
        const x = this.centerObject.position.x + Math.cos(this.angle) * this.orbitRadius;
        const z = this.centerObject.position.z + Math.sin(this.angle) * this.orbitRadius;
        const y = this.centerObject.position.y + this.height;
        
        this.mesh.position.set(x, y, z);
    }

    public remove(scene: THREE.Scene): void {
        scene.remove(this.mesh);
    }

    public getPosition(): THREE.Vector3 {
        return this.mesh.position;
    }
} 