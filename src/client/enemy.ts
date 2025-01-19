import * as THREE from 'three';
import { HealthBar } from './health';
import ladybugSvg from './ladybug.svg';

export enum EnemyType {
    LADYBUG = 'ladybug',
    BEE = 'bee'
}

interface EnemyStats {
    health: number;
    size: number;
}

const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
    [EnemyType.LADYBUG]: {
        health: 50,
        size: 0.5
    },
    [EnemyType.BEE]: {
        health: 30,
        size: 0.4
    }
};

export class Enemy {
    protected mesh: THREE.Mesh;
    protected healthBar: HealthBar;
    protected type: EnemyType;
    protected scene: THREE.Scene;
    public id: string;

    constructor(scene: THREE.Scene, position: THREE.Vector3, camera: THREE.Camera, type: EnemyType, id: string) {
        this.type = type;
        this.id = id;
        this.scene = scene;
        
        const stats = ENEMY_STATS[type];

        if (type === EnemyType.LADYBUG) {
            // Create the base mesh with appropriate material based on type
            const geometry = new THREE.SphereGeometry(stats.size, 64, 32);
            // Load the SVG texture with clean mapping
            const texture = new THREE.TextureLoader().load(ladybugSvg);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.center.set(0.5, 0.5);
            texture.rotation = 0;  // No initial rotation needed since we'll rotate the mesh to face direction

            const material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.FrontSide
            });
            this.mesh = new THREE.Mesh(geometry, material);
        } else {
            // For bees, create an invisible mesh as the base
            const geometry = new THREE.BoxGeometry(0.01, 0.01, 0.01);
            const material = new THREE.MeshBasicMaterial({ visible: false });
            this.mesh = new THREE.Mesh(geometry, material);
        }

        this.mesh.position.copy(position);
        this.scene.add(this.mesh);

        // Add health bar
        this.healthBar = new HealthBar(camera, this.mesh, stats.health);

        // Add decorative elements based on type
        this.addDecorativeElements();
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
            // Make main body longer
            const bodyGeometry = new THREE.CapsuleGeometry(0.2, 0.4, 4, 8);
            const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
            const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
            body.rotation.z = Math.PI / 2; // Rotate to be horizontal
            this.mesh.add(body);

            // Add stinger
            const stingerGeometry = new THREE.ConeGeometry(0.05, 0.2, 8);
            const stingerMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
            const stinger = new THREE.Mesh(stingerGeometry, stingerMaterial);
            stinger.position.set(-0.4, 0, 0); // Position at back
            stinger.rotation.z = -Math.PI / 2; // Point backward
            body.add(stinger);

            // Add antennae
            const antennaGeometry = new THREE.CylinderGeometry(0.04, 0.03, 0.4);
            const antennaMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
            
            [-0.15, 0.15].forEach(zPos => {
                const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
                antenna.position.set(0.5, -0.3, zPos);
                
                // First rotate 90 degrees towards front
                antenna.rotation.z = Math.PI / 2;
                
                // Then angle outward
                if (zPos < 0) {
                    antenna.rotateOnAxis(new THREE.Vector3(1, 0, 0), Math.PI / 6);
                } else {
                    antenna.rotateOnAxis(new THREE.Vector3(1, 0, 0), -Math.PI / 6);
                }
                body.add(antenna);
            });
        }
    }

    public updatePosition(position: { x: number; y: number; z: number }, rotation: number): void {
        this.mesh.position.set(position.x, position.y, position.z);
        this.mesh.rotation.y = rotation;
        this.healthBar.updatePosition();
    }

    public takeDamage(amount: number): boolean {
        return this.healthBar.takeDamage(amount);
    }

    public remove(): void {
        this.scene.remove(this.mesh);
        this.healthBar.remove();
    }

    public getPosition(): THREE.Vector3 {
        return this.mesh.position;
    }
} 