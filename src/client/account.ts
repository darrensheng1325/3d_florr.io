import { v4 as uuidv4 } from 'uuid';
import { PetalType, Rarity } from '../shared/types';

interface InventoryData {
    petals: Array<{
        type: string;
        slotIndex: number;
        rarity: string;
        health: number;
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
            storedId = uuidv4();
            localStorage.setItem(AccountManager.ACCOUNT_ID_KEY, storedId);
        }
        
        this.accountId = storedId;
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