import * as THREE from 'three';

export class CollisionManager {
    private collisionPlanes: THREE.Mesh[] = [];
    private terrainPlanes: THREE.Mesh[] = [];

    constructor(private scene: THREE.Scene) {}

    public addCollisionPlane(plane: THREE.Mesh, type: 'wall' | 'terrain'): void {
        this.scene.add(plane);
        if (type === 'terrain') {
            this.terrainPlanes.push(plane);
        } else {
            this.collisionPlanes.push(plane);
        }
    }
    
    public clearCollisionPlanes(): void {
        this.collisionPlanes.forEach(plane => this.scene.remove(plane));
        this.collisionPlanes = [];
        this.terrainPlanes.forEach(plane => this.scene.remove(plane));
        this.terrainPlanes = [];
    }
    
    public getCollisionPlanes(): THREE.Mesh[] {
        return this.collisionPlanes;
    }

    public getTerrainPlanes(): THREE.Mesh[] {
        return this.terrainPlanes;
    }

    public checkCollisionPlanes(position: THREE.Vector3, radius: number = 0.5): { collided: boolean; normal?: THREE.Vector3; type?: 'wall' | 'terrain'; terrainHeight?: number } {
        // Check wall collisions first
        for (const plane of this.collisionPlanes) {
            const collision = this.checkSinglePlaneCollision(plane, position, radius);
            if (collision.collided) {
                return { ...collision, type: 'wall' };
            }
        }
        
        // Check terrain collisions
        for (const plane of this.terrainPlanes) {
            // Check for walking on top of terrain
            const terrainCollision = this.checkTerrainCollision(plane, position, radius);
            if (terrainCollision.collided) {
                return { ...terrainCollision, type: 'terrain' };
            }
            
            // Check for bumping into terrain from below or sides (as a wall)
            const wallCollision = this.checkSinglePlaneCollision(plane, position, radius);
            if (wallCollision.collided) {
                const planeNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(plane.quaternion);
                
                // If the collision normal is opposite to the plane's "up" direction,
                // it means we are hitting it from underneath.
                if (wallCollision.normal!.dot(planeNormal) > 0.1) {
                    return { ...wallCollision, type: 'wall' };
                }
            }
        }
        
        return { collided: false };
    }
    
    private checkSinglePlaneCollision(plane: THREE.Mesh, position: THREE.Vector3, radius: number): { collided: boolean; normal?: THREE.Vector3 } {
        // Get plane's world transform
        const planePosition = new THREE.Vector3();
        plane.getWorldPosition(planePosition);
        const worldQuaternion = new THREE.Quaternion();
        plane.getWorldQuaternion(worldQuaternion);

        // The default normal for PlaneGeometry is (0, 0, 1). Transform it to world space.
        const planeNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuaternion);

        // Calculate distance from sphere center to the infinite plane
        const distance = planeNormal.dot(position.clone().sub(planePosition));

        // If the sphere is too far from the plane, no collision
        if (Math.abs(distance) > radius) {
            return { collided: false };
        }

        // Project sphere center onto the plane to find the closest point on the infinite plane
        const projectedPoint = position.clone().sub(planeNormal.clone().multiplyScalar(distance));

        // Transform the projected point to the plane's local space to check against its finite bounds
        const localPoint = plane.worldToLocal(projectedPoint.clone());

        // Get plane dimensions. PlaneGeometry is in the XY plane in local space.
        const planeWidth = (plane.geometry as THREE.PlaneGeometry).parameters.width;
        const planeHeight = (plane.geometry as THREE.PlaneGeometry).parameters.height;
        const halfWidth = planeWidth / 2;
        const halfHeight = planeHeight / 2;

        // Find the closest point on the plane's rectangle to the local projected point
        const closestX = Math.max(-halfWidth, Math.min(halfWidth, localPoint.x));
        const closestY = Math.max(-halfHeight, Math.min(halfHeight, localPoint.y));
        const closestPointLocal = new THREE.Vector3(closestX, closestY, 0);

        // Transform this closest point from local back to world space
        const closestPointWorld = plane.localToWorld(closestPointLocal.clone());

        // Calculate the distance from the sphere's center to this closest point on the rectangle
        const distanceToClosest = position.distanceTo(closestPointWorld);

        // If the distance is less than the sphere's radius, there is a collision.
        if (distanceToClosest <= radius) {
            // The collision normal is the vector from the closest point on the rectangle to the sphere's center.
            const normal = position.clone().sub(closestPointWorld).normalize();
            return { collided: true, normal };
        }
        
        return { collided: false };
    }
    
    private checkTerrainCollision(plane: THREE.Mesh, position: THREE.Vector3, radius: number): { collided: boolean; normal?: THREE.Vector3; terrainHeight?: number } {
        // Get plane's world transform
        const planePosition = new THREE.Vector3();
        plane.getWorldPosition(planePosition);
        const worldQuaternion = new THREE.Quaternion();
        plane.getWorldQuaternion(worldQuaternion);
        const planeNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(worldQuaternion);

        // Transform player position to plane's local space
        const localPlayerPos = plane.worldToLocal(position.clone());

        // Get plane dimensions. PlaneGeometry is in the XY plane in local space.
        const planeWidth = (plane.geometry as THREE.PlaneGeometry).parameters.width;
        const planeHeight = (plane.geometry as THREE.PlaneGeometry).parameters.height;
        const halfWidth = planeWidth / 2;
        const halfHeight = planeHeight / 2;

        // Check if player is within the plane's horizontal bounds
        if (localPlayerPos.x >= -halfWidth && localPlayerPos.x <= halfWidth &&
            localPlayerPos.y >= -halfHeight && localPlayerPos.y <= halfHeight) {
            
            // Calculate the world height at this position on the terrain
            const terrainPointLocal = new THREE.Vector3(localPlayerPos.x, localPlayerPos.y, 0);
            const terrainPointWorld = plane.localToWorld(terrainPointLocal);
            const targetHeight = terrainPointWorld.y + radius;
            
            // Player is inside the vertical bounds of the plane.
            // Check if player is at or above the terrain surface.
            if (position.y >= targetHeight - radius) { // Check from below
                // If the player is on top of the terrain, we should adjust their height
                if (position.y < targetHeight + 0.2) {
                    return { 
                        collided: true, 
                        terrainHeight: targetHeight,
                        normal: new THREE.Vector3(0, 1, 0)
                    };
                }
            }
        }
        
        return { collided: false };
    }
} 