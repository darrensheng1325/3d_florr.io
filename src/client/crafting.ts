import * as THREE from 'three';
import { Petal, PETAL_STATS } from './petal';
import { PetalType, Rarity, RARITY_COLORS, PetalStats } from '../shared/types';
import { Inventory } from './inventory';
import { Game } from './game';

interface CraftingSlot {
    petal: PetalType | null;
    element: HTMLDivElement;
    index: number;
}

export class CraftingSystem {
    private container: HTMLDivElement;
    private craftingSlots: CraftingSlot[] = [];
    private craftButton: HTMLButtonElement;
    private scene: THREE.Scene;
    private parent: THREE.Mesh;
    private game: Game;

    constructor(scene: THREE.Scene, parent: THREE.Mesh, game: Game) {
        console.log('Initializing CraftingSystem');
        this.scene = scene;
        this.parent = parent;
        this.game = game;
        
        // Create main container
        this.container = document.createElement('div');
        this.container.style.position = 'fixed';
        this.container.style.bottom = '20px';  // Match inventory position
        this.container.style.left = '200px';
        this.container.style.transform = 'translateX(-50%)';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.alignItems = 'center';
        this.container.style.gap = '20px';
        this.container.style.padding = '20px';
        this.container.style.background = 'rgba(221, 159, 96, 1)';
        this.container.style.borderRadius = '10px';
        this.container.style.display = 'none';  // Hidden by default
        this.container.id = 'crafting-container';
        this.container.style.zIndex = '1000'; // Ensure it's above other elements

        // Create crafting area
        const craftingArea = document.createElement('div');
        craftingArea.style.display = 'flex';
        craftingArea.style.alignItems = 'center';
        craftingArea.style.gap = '20px';
        craftingArea.id = 'crafting-area';

        // Create crafting slots container
        const slotsContainer = document.createElement('div');
        slotsContainer.style.position = 'relative';
        slotsContainer.style.width = '200px';
        slotsContainer.style.height = '200px';
        slotsContainer.id = 'slots-container';

        // Create 5 slots in a circle
        for (let i = 0; i < 5; i++) {
            console.log(`Creating crafting slot ${i}`);
            const slot = document.createElement('div');
            slot.id = `crafting-slot-${i}`; // Add ID for debugging
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
            const angle = (i * 2 * Math.PI) / 5;
            const radius = 70;
            const x = Math.cos(angle) * radius + 70;
            const y = Math.sin(angle) * radius + 70;
            slot.style.left = `${x}px`;
            slot.style.top = `${y}px`;

            // Add slot number for visibility
            const number = document.createElement('div');
            number.textContent = (i + 1).toString();
            number.style.color = 'rgba(255, 255, 255, 0.5)';
            number.style.fontSize = '20px';
            number.id = `slot-number-${i}`; // Add ID for debugging
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
        this.craftButton.addEventListener('click', () => this.craft());
        this.craftButton.disabled = true;

        // Add elements to crafting area
        craftingArea.appendChild(slotsContainer);
        craftingArea.appendChild(this.craftButton);

        // Create inventory display
        const inventoryDisplay = document.createElement('div');
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
        const toggleButton = document.createElement('button');
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
        toggleButton.addEventListener('click', () => this.toggleVisibility());
        document.body.appendChild(toggleButton);

        // Start inventory update loop
        this.startInventoryUpdateLoop();
    }

    private startInventoryUpdateLoop() {
        const updateInventoryDisplay = () => {
            if (this.container.style.display !== 'none') {
                const inventoryDisplay = this.container.children[1] as HTMLElement;
                inventoryDisplay.innerHTML = ''; // Clear existing slots

                // Group collected petals by type AND rarity
                const collectedPetals = this.game.getCollectedPetals();
                const groupedPetals = collectedPetals.reduce((acc: Map<string, number>, type: PetalType) => {
                    // Use both type and rarity as the key to prevent stacking different rarities
                    acc.set(type, (acc.get(type) || 0) + 1);
                    return acc;
                }, new Map<string, number>());

                // Create slots for each type of petal
                groupedPetals.forEach((count: number, petalType: string) => {
                    const slot = document.createElement('div');
                    slot.id = `inventory-slot-${petalType}`;
                    
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
                    const rarity = PETAL_STATS[petalType as PetalType].rarity;
                    const color = '#' + RARITY_COLORS[rarity].toString(16).padStart(6, '0');
                    slot.style.backgroundColor = color;

                    // Create a container for the content to prevent click interference
                    const contentContainer = document.createElement('div');
                    contentContainer.style.pointerEvents = 'none';
                    contentContainer.style.width = '100%';
                    contentContainer.style.height = '100%';
                    contentContainer.style.position = 'relative';

                    // Add count badge
                    const countBadge = document.createElement('div');
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
                    const typeLabel = document.createElement('div');
                    typeLabel.textContent = petalType;
                    typeLabel.style.position = 'absolute';
                    typeLabel.style.top = '2px';
                    typeLabel.style.left = '2px';
                    typeLabel.style.color = 'white';
                    typeLabel.style.fontSize = '10px';
                    typeLabel.style.pointerEvents = 'none';
                    contentContainer.appendChild(typeLabel);

                    // Add rarity label
                    const rarityLabel = document.createElement('div');
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
                    const clickHandler = (event: Event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        console.log('Click/mousedown event triggered on inventory slot');
                        console.log('Clicked petal type:', petalType);
                        
                        // Visual feedback
                        slot.style.transform = 'scale(0.95)';
                        setTimeout(() => {
                            slot.style.transform = 'scale(1)';
                        }, 100);

                        this.handleInventorySlotClick(petalType as PetalType);
                    };

                    slot.addEventListener('click', clickHandler);
                    slot.addEventListener('mousedown', clickHandler);

                    inventoryDisplay.appendChild(slot);
                });
            }
            requestAnimationFrame(updateInventoryDisplay);
        };
        updateInventoryDisplay();
    }

    private handleInventorySlotClick(petalType: PetalType) {
        console.log('=== handleInventorySlotClick ===');
        console.log('Petal type:', petalType);
        
        // Get collected petals
        const collectedPetals = this.game.getCollectedPetals();
        
        // Count how many of this petal type we have
        const availableCount = collectedPetals.filter(p => p === petalType).length;
        console.log(`Available ${petalType} count:`, availableCount);

        // Check if we have enough petals
        if (availableCount < 5) {
            console.log('Not enough petals to fill all slots');
            return;
        }

        // Clear existing slots first
        this.clearSlots();

        // Fill all 5 slots with the petal
        for (let i = 0; i < 5; i++) {
            // Remove one petal from collected petals
            const petalIndex = collectedPetals.findIndex(p => p === petalType);
            if (petalIndex !== -1) {
                collectedPetals.splice(petalIndex, 1);
                
                // Add to crafting slot
                this.craftingSlots[i].petal = petalType;
                
                // Update slot visuals
                const rarity = PETAL_STATS[petalType].rarity;
                const color = this.game.isRarityTintingEnabled() ? 
                    '#' + RARITY_COLORS[rarity].toString(16).padStart(6, '0') : 
                    'rgba(255, 255, 255, 0.1)';
                const slotElement = this.craftingSlots[i].element;
                
                // Clear existing content
                while (slotElement.firstChild) {
                    slotElement.removeChild(slotElement.firstChild);
                }

                // Apply color with transition
                slotElement.style.transition = 'background-color 0.3s ease-in-out';
                slotElement.style.backgroundColor = color;

                // Add petal type indicator
                const typeIndicator = document.createElement('div');
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
    }

    private craft() {
        // Verify all slots are filled
        const petals = this.craftingSlots.map(slot => slot.petal);
        if (petals.some(p => p === null)) {
            return;
        }

        // Verify all petals are the same type
        const firstPetal = petals[0]!;
        if (!petals.every(p => p === firstPetal)) {
            return;
        }

        // Get current rarity from PETAL_STATS
        const currentRarity = PETAL_STATS[firstPetal].rarity;
        const nextRarity = this.getNextRarity(currentRarity);
        if (!nextRarity) {
            return;
        }

        // Get the next petal type with higher rarity
        const nextPetalType = this.getNextPetalType(firstPetal, nextRarity);

        // Add the new petal to collected petals
        this.game.getCollectedPetals().push(nextPetalType);

        // Clear crafting slots
        this.clearSlots();

        // Reset slot visuals
        this.craftingSlots.forEach(slot => {
            slot.element.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        });
    }

    private clearSlots() {
        this.craftingSlots.forEach(slot => {
            slot.petal = null;
            slot.element.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
            // Show the slot number again
            const numberElement = slot.element.querySelector('div');
            if (numberElement) {
                numberElement.style.display = 'block';
            }
        });
        this.updateCraftButton();
    }

    private updateCraftButton() {
        const allSlotsFilled = this.craftingSlots.every(slot => slot.petal !== null);
        const samePetalType = this.craftingSlots.every(slot => 
            slot.petal === null || slot.petal === this.craftingSlots[0].petal
        );
        
        this.craftButton.disabled = !allSlotsFilled || !samePetalType;
    }

    public toggleVisibility() {
        const newDisplay = this.container.style.display === 'none' ? 'flex' : 'none';
        this.container.style.display = newDisplay;
        
        // If showing the container, make sure crafting slots are properly initialized
        if (newDisplay === 'flex') {
            this.craftingSlots.forEach((slot, index) => {
                if (!slot.petal) {
                    // Clear the slot and show the number
                    const slotElement = slot.element;
                    slotElement.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                    
                    // Clear existing content
                    while (slotElement.firstChild) {
                        slotElement.removeChild(slotElement.firstChild);
                    }
                    
                    // Add slot number
                    const number = document.createElement('div');
                    number.textContent = (index + 1).toString();
                    number.style.color = 'rgba(255, 255, 255, 0.5)';
                    number.style.fontSize = '20px';
                    slotElement.appendChild(number);
                }
            });
        }
    }

    private getNextRarity(rarity: Rarity): Rarity | null {
        const rarityOrder = [
            Rarity.COMMON,
            Rarity.UNCOMMON,
            Rarity.RARE,
            Rarity.EPIC,
            Rarity.LEGENDARY,
            Rarity.MYTHIC
        ];
        
        const currentIndex = rarityOrder.indexOf(rarity);
        if (currentIndex === -1 || currentIndex === rarityOrder.length - 1) {
            return null;
        }
        
        return rarityOrder[currentIndex + 1];
    }

    private getNextPetalType(currentType: PetalType, nextRarity: Rarity): PetalType {
        // Find the next petal type of the same base type but higher rarity
        const baseName = currentType.split('_')[0];
        const nextType = `${baseName}_${nextRarity.toLowerCase()}` as PetalType;
        
        // If the next type exists in PETAL_STATS, use it
        if (PETAL_STATS[nextType]) {
            return nextType;
        }
        
        // Otherwise, create a new entry in PETAL_STATS for this rarity
        PETAL_STATS[nextType] = {
            maxHealth: PETAL_STATS[currentType].maxHealth * 1.5,
            cooldownTime: PETAL_STATS[currentType].cooldownTime,
            rarity: nextRarity,
            damage: PETAL_STATS[currentType].damage * 1.5,
            health: PETAL_STATS[currentType].health * 1.5,
            speed: PETAL_STATS[currentType].speed * 1.2
        };
        
        return nextType;
    }
} 