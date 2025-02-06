"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Inventory = exports.PetalType = void 0;
const petal_1 = require("./petal");
var PetalType;
(function (PetalType) {
    PetalType["BASIC"] = "basic";
    PetalType["BASIC_UNCOMMON"] = "basic_uncommon";
    PetalType["BASIC_RARE"] = "basic_rare";
    PetalType["TETRAHEDRON"] = "tetrahedron";
    PetalType["TETRAHEDRON_EPIC"] = "tetrahedron_epic";
    PetalType["CUBE"] = "cube";
    PetalType["CUBE_LEGENDARY"] = "cube_legendary";
})(PetalType || (exports.PetalType = PetalType = {}));
class Inventory {
    constructor(scene, parent) {
        this.slots = [];
        this.maxSlots = 5; // Default max slots
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
    addPetal(type, slotIndex, itemId, initialHealth) {
        if (slotIndex < 0 || slotIndex >= this.slots.length) {
            return false;
        }
        // Remove existing petal if any
        if (this.slots[slotIndex].petal) {
            this.slots[slotIndex].petal.remove(this.scene);
        }
        // Create new petal with optional ID and health
        const petal = new petal_1.Petal(this.scene, this.parent, slotIndex, this.slots.length, type, itemId, initialHealth);
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
                const petalId = slot.petal.getId();
                const petalHealth = slot.petal.getHealth();
                slot.petal.remove(this.scene);
                slot.petal = new petal_1.Petal(this.scene, this.parent, index, this.slots.length, petalType, petalId, petalHealth);
                // Set up respawn callback for the new petal
                slot.petal.setRespawnCallback(() => {
                    // Remove the broken petal
                    this.removePetal(index);
                    // Create and add a fresh petal of the same type
                    this.addPetal(petalType, index);
                });
            }
        });
        return true;
    }
    addSlot() {
        if (this.slots.length >= 8) { // Maximum of 8 slots
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
                this.slots[index].petal = new petal_1.Petal(this.scene, this.parent, index, this.slots.length);
            }
        });
        return true;
    }
    swapPetals(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.slots.length ||
            toIndex < 0 || toIndex >= this.slots.length) {
            return false;
        }
        // Remove existing petals
        const fromPetal = this.slots[fromIndex].petal;
        const toPetal = this.slots[toIndex].petal;
        if (fromPetal)
            fromPetal.remove(this.scene);
        if (toPetal)
            toPetal.remove(this.scene);
        // Create new petals in swapped positions
        if (fromPetal) {
            this.slots[toIndex].petal = new petal_1.Petal(this.scene, this.parent, toIndex, this.slots.length);
        }
        if (toPetal) {
            this.slots[fromIndex].petal = new petal_1.Petal(this.scene, this.parent, fromIndex, this.slots.length);
        }
        return true;
    }
    expandPetals() {
        this.slots.forEach(slot => {
            if (slot.petal) {
                slot.petal.expand();
                slot.isActive = true;
            }
        });
    }
    contractPetals() {
        this.slots.forEach(slot => {
            if (slot.petal) {
                slot.petal.contract();
                slot.isActive = false;
            }
        });
    }
    getPetals() {
        return this.slots
            .filter(slot => slot.petal !== null)
            .map(slot => slot.petal);
    }
    getActivePetals() {
        return this.slots
            .filter(slot => slot.petal !== null && slot.isActive)
            .map(slot => slot.petal);
    }
    removePetal(index) {
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
    getSlots() {
        return this.slots;
    }
    clear() {
        this.slots.forEach(slot => {
            if (slot.petal) {
                slot.petal.remove(this.scene);
            }
        });
        this.slots = [];
    }
}
exports.Inventory = Inventory;
//# sourceMappingURL=inventory.js.map