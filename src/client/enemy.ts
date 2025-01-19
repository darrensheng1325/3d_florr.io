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

        // Create the base mesh with appropriate material based on type
        const geometry = new THREE.SphereGeometry(stats.size, 64, 32);
        let material: THREE.Material;

        if (type === EnemyType.LADYBUG) {
            // Load the SVG texture with clean mapping
            const texture = new THREE.TextureLoader().load(ladybugSvg);
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.center.set(0.5, 0.5);
            texture.rotation = 0;  // No initial rotation needed since we'll rotate the mesh to face direction

            material = new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.FrontSide
            });
        } else {
            material = new THREE.MeshPhongMaterial({ color: this.getBaseColor() });
        }

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.mesh.position.y = stats.size;

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