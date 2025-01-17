import * as THREE from 'three';

export class Petal {
    private mesh: THREE.Mesh;
    private orbitRadius: number;
    private orbitSpeed: number;
    private angle: number;
    private centerObject: THREE.Mesh;
    private height: number;

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
        this.orbitRadius = 1.0; // Distance from player
        this.orbitSpeed = 0.01; // Speed of rotation
        this.height = 0.1; // Fixed height above ground
        
        // Distribute petals evenly around the circle
        this.angle = (index / totalPetals) * Math.PI * 2;
        
        scene.add(this.mesh);
        this.updatePosition();
    }

    public update(): void {
        this.angle += this.orbitSpeed;
        this.updatePosition();
    }

    private updatePosition(): void {
        // Calculate new position in a perfect circle parallel to the ground
        const x = this.centerObject.position.x + Math.cos(this.angle) * this.orbitRadius;
        const z = this.centerObject.position.z + Math.sin(this.angle) * this.orbitRadius;
        const y = this.centerObject.position.y + this.height;
        
        this.mesh.position.set(x, y, z);
    }

    public remove(scene: THREE.Scene): void {
        scene.remove(this.mesh);
    }
} 