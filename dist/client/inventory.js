"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Inventory = void 0;
var petal_1 = require("./petal");
var Inventory = /** @class */ (function () {
    function Inventory(scene, parent) {
        this.slots = [];
        this.maxSlots = 5; // Default max slots
        this.scene = scene;
        this.parent = parent;
        // Initialize default slots
        for (var i = 0; i < this.maxSlots; i++) {
            this.slots.push({
                petal: null,
                isActive: false,
                index: i
            });
        }
    }
    Inventory.prototype.addPetal = function (type, slotIndex) {
        var _this = this;
        if (slotIndex < 0 || slotIndex >= this.slots.length) {
            return false;
        }
        // Remove existing petal if any
        if (this.slots[slotIndex].petal) {
            this.slots[slotIndex].petal.remove(this.scene);
        }
        // Create new petal
        var petal = new petal_1.Petal(this.scene, this.parent, slotIndex, this.slots.length, type);
        // Set up respawn callback to reequip petal
        petal.setRespawnCallback(function () {
            // Remove the broken petal
            _this.removePetal(slotIndex);
            // Create and add a fresh petal of the same type
            _this.addPetal(type, slotIndex);
        });
        this.slots[slotIndex].petal = petal;
        // Recalculate positions for all petals
        this.slots.forEach(function (slot, index) {
            if (slot.petal) {
                // Remove and recreate each petal to update its position
                var petalType_1 = slot.petal.getType();
                slot.petal.remove(_this.scene);
                slot.petal = new petal_1.Petal(_this.scene, _this.parent, index, _this.slots.length, petalType_1);
                // Set up respawn callback for the new petal
                slot.petal.setRespawnCallback(function () {
                    // Remove the broken petal
                    _this.removePetal(index);
                    // Create and add a fresh petal of the same type
                    _this.addPetal(petalType_1, index);
                });
            }
        });
        this.savePetals();
        return true;
    };
    Inventory.prototype.addSlot = function () {
        var _this = this;
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
        var tempPetals = this.slots.map(function (slot) { return slot.petal !== null; });
        // Remove all existing petals
        this.slots.forEach(function (slot) {
            if (slot.petal) {
                slot.petal.remove(_this.scene);
                slot.petal = null;
            }
        });
        // Create new petals with updated positions
        tempPetals.forEach(function (hasPetal, index) {
            if (hasPetal) {
                _this.slots[index].petal = new petal_1.Petal(_this.scene, _this.parent, index, _this.slots.length);
            }
        });
        return true;
    };
    Inventory.prototype.swapPetals = function (fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.slots.length ||
            toIndex < 0 || toIndex >= this.slots.length) {
            return false;
        }
        // Remove existing petals
        var fromPetal = this.slots[fromIndex].petal;
        var toPetal = this.slots[toIndex].petal;
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
    };
    Inventory.prototype.expandPetals = function () {
        this.slots.forEach(function (slot) {
            if (slot.petal) {
                slot.petal.expand();
                slot.isActive = true;
            }
        });
    };
    Inventory.prototype.contractPetals = function () {
        this.slots.forEach(function (slot) {
            if (slot.petal) {
                slot.petal.contract();
                slot.isActive = false;
            }
        });
    };
    Inventory.prototype.getPetals = function () {
        return this.slots
            .filter(function (slot) { return slot.petal !== null; })
            .map(function (slot) { return slot.petal; });
    };
    Inventory.prototype.getActivePetals = function () {
        return this.slots
            .filter(function (slot) { return slot.petal !== null && slot.isActive; })
            .map(function (slot) { return slot.petal; });
    };
    Inventory.prototype.removePetal = function (index) {
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
    };
    Inventory.prototype.getSlots = function () {
        return this.slots;
    };
    Inventory.prototype.clear = function () {
        var _this = this;
        this.slots.forEach(function (slot) {
            if (slot.petal) {
                slot.petal.remove(_this.scene);
            }
        });
        this.slots = [];
    };
    Inventory.prototype.loadPetals = function () {
        var _this = this;
        // Load petals from local storage
        var storedPetals = localStorage.getItem('loadout');
        if (storedPetals) {
            var petalData = JSON.parse(storedPetals);
            petalData.forEach(function (_a) {
                var type = _a.type, slotIndex = _a.slotIndex;
                _this.addPetal(type, slotIndex);
            });
        }
    };
    Inventory.prototype.savePetals = function () {
        var petalData = this.slots
            .map(function (slot, index) {
            var _a;
            return ({
                type: (_a = slot.petal) === null || _a === void 0 ? void 0 : _a.getType(),
                slotIndex: index
            });
        })
            .filter(function (data) { return data.type !== undefined; });
        localStorage.setItem('loadout', JSON.stringify(petalData));
        // Also emit inventory update to server
        var socket = window.socket;
        if (socket) {
            socket.emit('requestInventory');
        }
    };
    return Inventory;
}());
exports.Inventory = Inventory;
//# sourceMappingURL=inventory.js.map