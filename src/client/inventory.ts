import * as THREE from 'three';
import { Petal } from './petal';
import { PETAL_ROTATION_SPEED, PetalType } from '../shared/types';

export interface PetalSlot {
    petal: Petal | null;
    isActive: boolean;
    index: number;
    position: number;
}

export class Inventory {
    public slots: PetalSlot[] = [];
    private maxSlots: number = 5;  // Default max slots
    private scene: THREE.Scene;
    private parent: THREE.Mesh;

    constructor(scene: THREE.Scene, parent: THREE.Mesh) {
        this.scene = scene;
        this.parent = parent;
        
        // Initialize default slots
        for (let i = 0; i < this.maxSlots; i++) {
            this.slots.push({
                petal: null,
                isActive: false,
                index: i,
                position: (Math.PI * 2 / this.maxSlots) * i
            });
        }
    }

    public initializeSlots(): void {
        for (let i = 0; i < this.maxSlots; i++) {
            this.slots.push({
                petal: null,
                isActive: false,
                index: i,
                position: (Math.PI * 2 / this.maxSlots) * i
            });
        }
    }
    

    public addPetal(type: string, slotIndex: number): boolean {
        if (slotIndex < 0 || slotIndex >= this.slots.length) {
            return false;
        }

        // Remove existing petal if any
        if (this.slots[slotIndex].petal) {
            this.slots[slotIndex].petal.remove(this.scene);
        }

        // Create new petal
        const petal = new Petal(this.scene, this.parent, slotIndex, this.slots.length, type, this);
        petal.angle = this.slots[slotIndex].position;
        
        // Set up respawn callback to reequip petal
        petal.setRespawnCallback(() => {
            // Remove the broken petal
            this.removePetal(slotIndex);
            
            // Create and add a fresh petal of the same type
            this.addPetal(type, slotIndex);
        });
        
        this.slots[slotIndex].petal = petal;

        // // Recalculate positions for all petals
        // this.slots.forEach((slot, index) => {
        //     if (slot.petal) {
        //         // Remove and recreate each petal to update its position
        //         const petalType = slot.petal.getType();
        //         slot.petal.remove(this.scene);
        //         slot.petal = new Petal(this.scene, this.parent, index, this.slots.length, petalType);
                
        //         // Set up respawn callback for the new petal
        //         slot.petal.setRespawnCallback(() => {
        //             // Remove the broken petal
        //             this.removePetal(index);
                    
        //             // Create and add a fresh petal of the same type
        //             this.addPetal(petalType, index);
        //         });
        //     }
        // });
        this.savePetals();

        return true;
    }

    public addSlot(): boolean {
        if (this.slots.length >= 8) {  // Maximum of 8 slots
            return false;
        }

        // Add new slot
        this.slots.push({
            petal: null,
            isActive: false,
            index: this.slots.length,
            position: (Math.PI * 2 / this.maxSlots) * this.slots.length
        });

        // Recreate all petals with new total count
        const tempPetals = this.slots.map(slot => slot.petal !== null);
        
        // Remove all existing petals
        this.slots.forEach(slot => {
            if (slot.petal) {
                slot.petal.remove(this.scene);
                slot.petal = null;
            }
        });

        // Create new petals with updated positions
        tempPetals.forEach((hasPetal, index) => {
            if (hasPetal) {
                this.slots[index].petal = new Petal(this.scene, this.parent, index, this.slots.length, this.slots[index].petal!.getType(), this);
            }
        });

        return true;
    }

    public swapPetals(fromIndex: number, toIndex: number): boolean {
        if (fromIndex < 0 || fromIndex >= this.slots.length ||
            toIndex < 0 || toIndex >= this.slots.length) {
            return false;
        }

        // Remove existing petals
        const fromPetal = this.slots[fromIndex].petal;
        const toPetal = this.slots[toIndex].petal;
        
        if (fromPetal) fromPetal.remove(this.scene);
        if (toPetal) toPetal.remove(this.scene);

        // Create new petals in swapped positions
        if (fromPetal) {
            this.slots[toIndex].petal = new Petal(this.scene, this.parent, toIndex, this.slots.length, fromPetal.getType(), this);
        }
        if (toPetal) {
            this.slots[fromIndex].petal = new Petal(this.scene, this.parent, fromIndex, this.slots.length, toPetal.getType(), this);
        }

        this.savePetals(); // Save to localStorage whenever petals are swapped
        return true;
    }

    public updatePetalPositions(): void {
        this.slots.forEach(slot => {
            this.slots[slot.index].position += PETAL_ROTATION_SPEED;
            if (slot.petal) {
                slot.petal.updatePosition();
            }
        });
    }

    public expandPetals(): void {
        this.slots.forEach(slot => {
            if (slot.petal) {
                slot.petal.expand();
                slot.isActive = true;
            }
        });
    }

    public contractPetals(): void {
        this.slots.forEach(slot => {
            if (slot.petal) {
                slot.petal.contract();
                slot.isActive = false;
            }
        });
    }

    public getPetals(): Petal[] {
        return this.slots
            .filter(slot => slot.petal !== null)
            .map(slot => slot.petal!) as Petal[];
    }

    public getActivePetals(): Petal[] {
        return this.slots
            .filter(slot => slot.petal !== null && slot.isActive)
            .map(slot => slot.petal!) as Petal[];
    }

    public removePetal(index: number): boolean {
        if (index < 0 || index >= this.slots.length) {
            return false;
        }

        if (this.slots[index].petal) {
            this.slots[index].petal.remove(this.scene);
            this.slots[index].petal = null;
            this.slots[index].isActive = false;
            this.savePetals(); // Save to localStorage whenever a petal is removed
            return true;
        }
        return false;
    }

    public getSlots(): PetalSlot[] {
        return this.slots;
    }

    public clear(): void {
        this.slots.forEach(slot => {
            if (slot.petal) {
                slot.petal.remove(this.scene);
            }
        });
        this.slots = [];
        this.savePetals(); // Save empty state to localStorage when cleared
    }

    public loadPetals(): void {
        // Load petals from local storage
        const storedPetals = localStorage.getItem('loadout');
        if (storedPetals) {
            try {
                const petalData: Array<{ type: string; slotIndex: number }> = JSON.parse(storedPetals);
                petalData.forEach(({ type, slotIndex }) => {
                    this.addPetalWithoutSaving(type, slotIndex);
                });
                console.log('Loaded loadout from localStorage:', petalData);
            } catch (error) {
                console.error('Failed to load loadout from localStorage:', error);
                // Clear corrupted data
                localStorage.removeItem('loadout');
            }
        }
    }

    private addPetalWithoutSaving(type: string, slotIndex: number): boolean {
        if (slotIndex < 0 || slotIndex >= this.slots.length) {
            return false;
        }

        // Remove existing petal if any
        if (this.slots[slotIndex].petal) {
            this.slots[slotIndex].petal.remove(this.scene);
        }

        // Create new petal
        const petal = new Petal(this.scene, this.parent, slotIndex, this.slots.length, type, this);
        petal.angle = this.slots[slotIndex].position;
        
        // Set up respawn callback to reequip petal
        petal.setRespawnCallback(() => {
            // Remove the broken petal
            this.removePetal(slotIndex);
            
            // Create and add a fresh petal of the same type
            this.addPetal(type, slotIndex);
        });
        
        this.slots[slotIndex].petal = petal;
        // Note: NOT calling savePetals() here to avoid infinite recursion during loading

        return true;
    }

    public savePetals(): void {
        try {
            const petalData = this.slots
                .map((slot, index) => ({
                    type: slot.petal?.getType(),
                    slotIndex: index
                }))
                .filter(data => data.type !== undefined);
            
            localStorage.setItem('loadout', JSON.stringify(petalData));
            console.log('Saved loadout to localStorage:', petalData);

            // Also emit inventory update to server
            const socket = (window as any).socket;
            if (socket) {
                socket.emit('requestInventory');
            }
        } catch (error) {
            console.error('Failed to save loadout to localStorage:', error);
        }
    }

    public clearStoredLoadout(): void {
        localStorage.removeItem('loadout');
        console.log('Cleared localStorage loadout');
    }

    public clearSavedLoadout(): void {
        try {
            localStorage.removeItem('loadout');
            console.log('Cleared saved loadout from localStorage');
        } catch (error) {
            console.error('Failed to clear saved loadout:', error);
        }
    }

    public hasSavedLoadout(): boolean {
        try {
            return localStorage.getItem('loadout') !== null;
        } catch (error) {
            console.error('Failed to check for saved loadout:', error);
            return false;
        }
    }
} 
