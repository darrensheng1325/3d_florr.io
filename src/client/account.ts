import { v4 as uuidv4 } from 'uuid';
import { PetalType, Rarity } from '../shared/types';
import { hash } from 'crypto';

interface InventoryData {
    petals: Array<{
        type: PetalType;
        amount: number;
    }>;
    collectedItems: Array<{
        type: string;
        rarity: string;
        obtainedAt: number;
    }>;
}

export class AccountManager {
    private static readonly ACCOUNT_ID_KEY = 'florr_account_id';
    private accountId: string;
    private inventory: InventoryData = {
        petals: [],
        collectedItems: []
    };

    constructor() {
        // Try to load existing account ID from localStorage
        let storedId = localStorage.getItem(AccountManager.ACCOUNT_ID_KEY);
        
        if (!storedId) {
            // Generate new ID if none exists
            const username = prompt("Enter a username");
            if (username) {
                let username_lower = username.toLowerCase().replace(/ /g, '_');
                let total_characters = 1;
                for (let i = 0; i < username_lower.length; i++) {
                    let character = username_lower.charCodeAt(i); 
                    total_characters *= character;
                }
                storedId = total_characters.toString();
                localStorage.setItem(AccountManager.ACCOUNT_ID_KEY, storedId);
            } else {
                console.error("No username provided");
            }
        }
        
        this.accountId = storedId || '';
    }

    public getAccountId(): string {
        return this.accountId;
    }

    public getInventory(): InventoryData {
        return this.inventory;
    }

    public setInventory(inventory: InventoryData): void {
        this.inventory = inventory;
    }

    public addPetal(type: PetalType): void {
        const existingPetal = this.inventory.petals.find(p => p.type === type);
        if (existingPetal) {
            existingPetal.amount++;
        } else {
            this.inventory.petals.push({
                type,
                amount: 1
            });
        }
    }

    public removePetal(type: PetalType): void {
        const petalIndex = this.inventory.petals.findIndex(p => p.type === type);
        if (petalIndex !== -1) {
            const petal = this.inventory.petals[petalIndex];
            petal.amount--;
            if (petal.amount <= 0) {
                this.inventory.petals.splice(petalIndex, 1);
            }
        }
    }

    public getPetalAmount(type: PetalType): number {
        const petal = this.inventory.petals.find(p => p.type === type);
        return petal?.amount || 0;
    }

    public addCollectedItem(type: string, rarity: string): void {
        this.inventory.collectedItems.push({
            type,
            rarity,
            obtainedAt: Date.now()
        });
    }

    public clearCollectedItems(): void {
        this.inventory.collectedItems = [];
    }
} 