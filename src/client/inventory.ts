import * as THREE from 'three';
import { Petal } from './petal';
import { PetalType } from '../shared/types';

export interface PetalSlot {
    petal: Petal | null;
    isActive: boolean;
    index: number;
}

export class Inventory {
    private slots: PetalSlot[] = [];
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
                index: i
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
        const petal = new Petal(this.scene, this.parent, slotIndex, this.slots.length, type);
        
        // Set up respawn callback to reequip petal
        petal.setRespawnCallback(() => {
            // Remove the broken petal
            this.removePetal(slotIndex);
            
            // Create and add a fresh petal of the same type
            this.addPetal(type, slotIndex);
        });
        
        this.slots[slotIndex].petal = petal;

        // Recalculate positions for all petals
        this.slots.forEach((slot, index) => {
            if (slot.petal) {
                // Remove and recreate each petal to update its position
                const petalType = slot.petal.getType();
                slot.petal.remove(this.scene);
                slot.petal = new Petal(this.scene, this.parent, index, this.slots.length, petalType);
                
                // Set up respawn callback for the new petal
                slot.petal.setRespawnCallback(() => {
                    // Remove the broken petal
                    this.removePetal(index);
                    
                    // Create and add a fresh petal of the same type
                    this.addPetal(petalType, index);
                });
            }
        });
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
            index: this.slots.length
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
                this.slots[index].petal = new Petal(this.scene, this.parent, index, this.slots.length);
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
            this.slots[toIndex].petal = new Petal(this.scene, this.parent, toIndex, this.slots.length);
        }
        if (toPetal) {
            this.slots[fromIndex].petal = new Petal(this.scene, this.parent, fromIndex, this.slots.length);
        }

        return true;
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
    }

    public loadPetals(): void {
        // Load petals from local storage
        const storedPetals = localStorage.getItem('loadout');
        if (storedPetals) {
            const petalData: Array<{ type: string; slotIndex: number }> = JSON.parse(storedPetals);
            petalData.forEach(({ type, slotIndex }) => {
                this.addPetal(type, slotIndex);
            });
        }
    }

    public savePetals(): void {
        const petalData = this.slots
            .map((slot, index) => ({
                type: slot.petal?.getType(),
                slotIndex: index
            }))
            .filter(data => data.type !== undefined);
        
        localStorage.setItem('loadout', JSON.stringify(petalData));

        // Also emit inventory update to server
        const socket = (window as any).socket;
        if (socket) {
            socket.emit('requestInventory');
        }
    }
} 
