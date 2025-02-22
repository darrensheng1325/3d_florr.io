"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CraftingSystem = void 0;
var petal_1 = require("./petal");
var types_1 = require("../shared/types");
var CraftingSystem = /** @class */ (function () {
    function CraftingSystem(scene, parent, game) {
        var _this = this;
        this.craftingSlots = [];
        console.log('Initializing CraftingSystem');
        this.scene = scene;
        this.parent = parent;
        this.game = game;
        // Create main container
        this.container = document.createElement('div');
        this.container.style.position = 'fixed';
        this.container.style.bottom = '20px'; // Match inventory position
        this.container.style.left = '200px';
        this.container.style.transform = 'translateX(-50%)';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.alignItems = 'center';
        this.container.style.gap = '20px';
        this.container.style.padding = '20px';
        this.container.style.background = 'rgba(221, 159, 96, 1)';
        this.container.style.borderRadius = '10px';
        this.container.style.display = 'none'; // Hidden by default
        this.container.id = 'crafting-container';
        this.container.style.zIndex = '1000'; // Ensure it's above other elements
        // Create crafting area
        var craftingArea = document.createElement('div');
        craftingArea.style.display = 'flex';
        craftingArea.style.alignItems = 'center';
        craftingArea.style.gap = '20px';
        craftingArea.id = 'crafting-area';
        // Create crafting slots container
        var slotsContainer = document.createElement('div');
        slotsContainer.style.position = 'relative';
        slotsContainer.style.width = '200px';
        slotsContainer.style.height = '200px';
        slotsContainer.id = 'slots-container';
        // Create 5 slots in a circle
        for (var i = 0; i < 5; i++) {
            console.log("Creating crafting slot ".concat(i));
            var slot = document.createElement('div');
            slot.id = "crafting-slot-".concat(i); // Add ID for debugging
            slot.style.position = 'absolute';
            slot.style.width = '60px';
            slot.style.height = '60px';
            slot.style.border = '2px solid white';
            slot.style.borderRadius = '50%';
            slot.style.background = 'rgba(255, 255, 255, 0.1)';
            slot.style.display = 'flex';
            slot.style.justifyContent = 'center';
            slot.style.alignItems = 'center';
            slot.style.zIndex = '1000'; // Ensure slots are clickable
            // Position slots in a circle
            var angle = (i * 2 * Math.PI) / 5;
            var radius = 70;
            var x = Math.cos(angle) * radius + 70;
            var y = Math.sin(angle) * radius + 70;
            slot.style.left = "".concat(x, "px");
            slot.style.top = "".concat(y, "px");
            // Add slot number for visibility
            var number = document.createElement('div');
            number.textContent = (i + 1).toString();
            number.style.color = 'rgba(255, 255, 255, 0.5)';
            number.style.fontSize = '20px';
            number.id = "slot-number-".concat(i); // Add ID for debugging
            slot.appendChild(number);
            this.craftingSlots.push({
                petal: null,
                element: slot,
                index: i
            });
            slotsContainer.appendChild(slot);
        }
        // Create craft button
        this.craftButton = document.createElement('button');
        this.craftButton.textContent = 'Craft';
        this.craftButton.style.padding = '10px 20px';
        this.craftButton.style.background = '#4CAF50';
        this.craftButton.style.border = 'none';
        this.craftButton.style.borderRadius = '5px';
        this.craftButton.style.color = 'white';
        this.craftButton.style.cursor = 'pointer';
        this.craftButton.style.fontSize = '16px';
        this.craftButton.addEventListener('click', function () { return _this.craft(); });
        this.craftButton.disabled = true;
        // Add elements to crafting area
        craftingArea.appendChild(slotsContainer);
        craftingArea.appendChild(this.craftButton);
        // Create inventory display
        var inventoryDisplay = document.createElement('div');
        inventoryDisplay.style.display = 'grid';
        inventoryDisplay.style.gridTemplateColumns = 'repeat(5, 1fr)';
        inventoryDisplay.style.gap = '10px';
        inventoryDisplay.style.padding = '10px';
        inventoryDisplay.style.background = 'rgba(255, 255, 255, 0.1)';
        inventoryDisplay.style.borderRadius = '5px';
        inventoryDisplay.style.maxWidth = '400px';
        inventoryDisplay.style.maxHeight = '200px';
        inventoryDisplay.style.overflowY = 'auto';
        // Add elements to main container
        this.container.appendChild(craftingArea);
        this.container.appendChild(inventoryDisplay);
        document.body.appendChild(this.container);
        // Add toggle button
        var toggleButton = document.createElement('button');
        toggleButton.textContent = 'Crafting';
        toggleButton.style.position = 'fixed';
        toggleButton.style.bottom = '110px';
        toggleButton.style.left = '10px';
        toggleButton.style.padding = '5px 10px';
        toggleButton.style.background = '#2196F3';
        toggleButton.style.border = 'none';
        toggleButton.style.borderRadius = '5px';
        toggleButton.style.color = 'white';
        toggleButton.style.cursor = 'pointer';
        toggleButton.addEventListener('click', function () { return _this.toggleVisibility(); });
        document.body.appendChild(toggleButton);
        // Start inventory update loop
        this.startInventoryUpdateLoop();
    }
    CraftingSystem.prototype.startInventoryUpdateLoop = function () {
        var _this = this;
        var updateInventoryDisplay = function () {
            if (_this.container.style.display !== 'none') {
                var inventoryDisplay_1 = _this.container.children[1];
                inventoryDisplay_1.innerHTML = ''; // Clear existing slots
                // Group collected petals by type AND rarity
                var collectedPetals = _this.game.getCollectedPetals();
                var groupedPetals = collectedPetals.reduce(function (acc, type) {
                    // Use both type and rarity as the key to prevent stacking different rarities
                    acc.set(type, (acc.get(type) || 0) + 1);
                    return acc;
                }, new Map());
                // Create slots for each type of petal
                groupedPetals.forEach(function (count, petalType) {
                    var slot = document.createElement('div');
                    slot.id = "inventory-slot-".concat(petalType);
                    // Make sure the slot is clickable
                    slot.style.pointerEvents = 'auto';
                    slot.style.cursor = 'pointer';
                    slot.style.userSelect = 'none';
                    slot.style.width = '60px';
                    slot.style.height = '60px';
                    slot.style.border = '2px solid white';
                    slot.style.borderRadius = '10px';
                    slot.style.position = 'relative';
                    slot.style.transition = 'transform 0.1s ease-in-out';
                    slot.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                    slot.style.zIndex = '1000';
                    // Set background color based on rarity
                    var rarity = petal_1.PETAL_STATS[petalType].rarity;
                    var color = '#' + types_1.RARITY_COLORS[rarity].toString(16).padStart(6, '0');
                    slot.style.backgroundColor = color;
                    // Create a container for the content to prevent click interference
                    var contentContainer = document.createElement('div');
                    contentContainer.style.pointerEvents = 'none';
                    contentContainer.style.width = '100%';
                    contentContainer.style.height = '100%';
                    contentContainer.style.position = 'relative';
                    // Add count badge
                    var countBadge = document.createElement('div');
                    countBadge.textContent = count.toString();
                    countBadge.style.position = 'absolute';
                    countBadge.style.bottom = '2px';
                    countBadge.style.right = '2px';
                    countBadge.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
                    countBadge.style.color = 'white';
                    countBadge.style.padding = '2px 6px';
                    countBadge.style.borderRadius = '10px';
                    countBadge.style.fontSize = '12px';
                    countBadge.style.pointerEvents = 'none';
                    contentContainer.appendChild(countBadge);
                    // Add petal type label
                    var typeLabel = document.createElement('div');
                    typeLabel.textContent = petalType;
                    typeLabel.style.position = 'absolute';
                    typeLabel.style.top = '2px';
                    typeLabel.style.left = '2px';
                    typeLabel.style.color = 'white';
                    typeLabel.style.fontSize = '10px';
                    typeLabel.style.pointerEvents = 'none';
                    contentContainer.appendChild(typeLabel);
                    // Add rarity label
                    var rarityLabel = document.createElement('div');
                    rarityLabel.textContent = rarity;
                    rarityLabel.style.position = 'absolute';
                    rarityLabel.style.top = '50%';
                    rarityLabel.style.left = '50%';
                    rarityLabel.style.transform = 'translate(-50%, -50%)';
                    rarityLabel.style.color = 'white';
                    rarityLabel.style.fontSize = '10px';
                    rarityLabel.style.pointerEvents = 'none';
                    contentContainer.appendChild(rarityLabel);
                    // Add the content container to the slot
                    slot.appendChild(contentContainer);
                    // Add both click and mousedown handlers for better responsiveness
                    var clickHandler = function (event) {
                        event.preventDefault();
                        event.stopPropagation();
                        console.log('Click/mousedown event triggered on inventory slot');
                        console.log('Clicked petal type:', petalType);
                        // Visual feedback
                        slot.style.transform = 'scale(0.95)';
                        setTimeout(function () {
                            slot.style.transform = 'scale(1)';
                        }, 100);
                        _this.handleInventorySlotClick(petalType);
                    };
                    slot.addEventListener('click', clickHandler);
                    slot.addEventListener('mousedown', clickHandler);
                    inventoryDisplay_1.appendChild(slot);
                });
            }
            requestAnimationFrame(updateInventoryDisplay);
        };
        updateInventoryDisplay();
    };
    CraftingSystem.prototype.handleInventorySlotClick = function (petalType) {
        console.log('=== handleInventorySlotClick ===');
        console.log('Petal type:', petalType);
        // Get collected petals
        var collectedPetals = this.game.getCollectedPetals();
        // Count how many of this petal type we have
        var availableCount = collectedPetals.filter(function (p) { return p === petalType; }).length;
        console.log("Available ".concat(petalType, " count:"), availableCount);
        // Check if we have enough petals
        if (availableCount < 5) {
            console.log('Not enough petals to fill all slots');
            return;
        }
        // Clear existing slots first
        this.clearSlots();
        // Fill all 5 slots with the petal
        for (var i = 0; i < 5; i++) {
            // Remove one petal from collected petals
            var petalIndex = collectedPetals.findIndex(function (p) { return p === petalType; });
            if (petalIndex !== -1) {
                collectedPetals.splice(petalIndex, 1);
                // Add to crafting slot
                this.craftingSlots[i].petal = petalType;
                // Update slot visuals
                var rarity = petal_1.PETAL_STATS[petalType].rarity;
                var color = this.game.isRarityTintingEnabled() ?
                    '#' + types_1.RARITY_COLORS[rarity].toString(16).padStart(6, '0') :
                    'rgba(255, 255, 255, 0.1)';
                var slotElement = this.craftingSlots[i].element;
                // Clear existing content
                while (slotElement.firstChild) {
                    slotElement.removeChild(slotElement.firstChild);
                }
                // Apply color with transition
                slotElement.style.transition = 'background-color 0.3s ease-in-out';
                slotElement.style.backgroundColor = color;
                // Add petal type indicator
                var typeIndicator = document.createElement('div');
                typeIndicator.textContent = petalType;
                typeIndicator.style.color = 'white';
                typeIndicator.style.fontSize = '12px';
                typeIndicator.style.textAlign = 'center';
                typeIndicator.style.width = '100%';
                typeIndicator.style.position = 'absolute';
                typeIndicator.style.top = '50%';
                typeIndicator.style.left = '50%';
                typeIndicator.style.transform = 'translate(-50%, -50%)';
                slotElement.appendChild(typeIndicator);
            }
        }
        // Update craft button state
        this.updateCraftButton();
        console.log('=== All slots filled ===');
        console.log('Updated crafting slots:', this.craftingSlots);
    };
    CraftingSystem.prototype.craft = function () {
        // Verify all slots are filled
        var petals = this.craftingSlots.map(function (slot) { return slot.petal; });
        if (petals.some(function (p) { return p === null; })) {
            return;
        }
        // Verify all petals are the same type
        var firstPetal = petals[0];
        if (!petals.every(function (p) { return p === firstPetal; })) {
            return;
        }
        // Get current rarity from PETAL_STATS
        var currentRarity = petal_1.PETAL_STATS[firstPetal].rarity;
        var nextRarity = this.getNextRarity(currentRarity);
        if (!nextRarity) {
            return;
        }
        // Get the next petal type with higher rarity
        var nextPetalType = this.getNextPetalType(firstPetal, nextRarity);
        // Add the new petal to collected petals
        this.game.getCollectedPetals().push(nextPetalType);
        // Clear crafting slots
        this.clearSlots();
        // Reset slot visuals
        this.craftingSlots.forEach(function (slot) {
            slot.element.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        });
    };
    CraftingSystem.prototype.clearSlots = function () {
        this.craftingSlots.forEach(function (slot) {
            slot.petal = null;
            slot.element.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            // Show the slot number again
            var numberElement = slot.element.querySelector('div');
            if (numberElement) {
                numberElement.style.display = 'block';
            }
        });
        this.updateCraftButton();
    };
    CraftingSystem.prototype.updateCraftButton = function () {
        var _this = this;
        var allSlotsFilled = this.craftingSlots.every(function (slot) { return slot.petal !== null; });
        var samePetalType = this.craftingSlots.every(function (slot) {
            return slot.petal === null || slot.petal === _this.craftingSlots[0].petal;
        });
        this.craftButton.disabled = !allSlotsFilled || !samePetalType;
    };
    CraftingSystem.prototype.toggleVisibility = function () {
        var newDisplay = this.container.style.display === 'none' ? 'flex' : 'none';
        this.container.style.display = newDisplay;
        // If showing the container, make sure crafting slots are properly initialized
        if (newDisplay === 'flex') {
            this.craftingSlots.forEach(function (slot, index) {
                if (!slot.petal) {
                    // Clear the slot and show the number
                    var slotElement = slot.element;
                    slotElement.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    // Clear existing content
                    while (slotElement.firstChild) {
                        slotElement.removeChild(slotElement.firstChild);
                    }
                    // Add slot number
                    var number = document.createElement('div');
                    number.textContent = (index + 1).toString();
                    number.style.color = 'rgba(255, 255, 255, 0.5)';
                    number.style.fontSize = '20px';
                    slotElement.appendChild(number);
                }
            });
        }
    };
    CraftingSystem.prototype.getNextRarity = function (rarity) {
        var rarityOrder = [
            types_1.Rarity.COMMON,
            types_1.Rarity.UNCOMMON,
            types_1.Rarity.RARE,
            types_1.Rarity.EPIC,
            types_1.Rarity.LEGENDARY,
            types_1.Rarity.MYTHIC
        ];
        var currentIndex = rarityOrder.indexOf(rarity);
        if (currentIndex === -1 || currentIndex === rarityOrder.length - 1) {
            return null;
        }
        return rarityOrder[currentIndex + 1];
    };
    CraftingSystem.prototype.getNextPetalType = function (currentType, nextRarity) {
        // Find the next petal type of the same base type but higher rarity
        var baseName = currentType.split('_')[0];
        var nextType = "".concat(baseName, "_").concat(nextRarity.toLowerCase());
        // If the next type exists in PETAL_STATS, use it
        if (petal_1.PETAL_STATS[nextType]) {
            return nextType;
        }
        // Otherwise, create a new entry in PETAL_STATS for this rarity
        petal_1.PETAL_STATS[nextType] = {
            maxHealth: petal_1.PETAL_STATS[currentType].maxHealth * 1.5,
            cooldownTime: petal_1.PETAL_STATS[currentType].cooldownTime,
            rarity: nextRarity,
            damage: petal_1.PETAL_STATS[currentType].damage * 1.5,
            health: petal_1.PETAL_STATS[currentType].health * 1.5,
            speed: petal_1.PETAL_STATS[currentType].speed * 1.2
        };
        return nextType;
    };
    return CraftingSystem;
}());
exports.CraftingSystem = CraftingSystem;
//# sourceMappingURL=crafting.js.map