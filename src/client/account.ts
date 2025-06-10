import { v4 as uuidv4 } from 'uuid';
import { PetalType, Rarity } from '../shared/types';
import { LoginUI } from './login';

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
    private static readonly USERNAME_KEY = 'florr_username';
    private accountId: string | null = null;
    private username: string | null = null;
    private inventory: InventoryData = {
        petals: [],
        collectedItems: []
    };
    private loginUI: LoginUI;
    private isLoggedIn: boolean = false;

    constructor() {
        this.loginUI = new LoginUI();
        this.loadStoredAccount();
    }

    private loadStoredAccount(): void {
        // Try to load existing account from localStorage
        const storedId = localStorage.getItem(AccountManager.ACCOUNT_ID_KEY);
        const storedUsername = localStorage.getItem(AccountManager.USERNAME_KEY);
        
        if (storedId && storedUsername) {
            this.accountId = storedId;
            this.username = storedUsername;
            this.isLoggedIn = true;
        }
    }

    public getAccountId(): string {
        return this.accountId || '';
    }

    public getUsername(): string {
        return this.username || 'Guest';
    }

    public hasAccount(): boolean {
        return this.isLoggedIn && !!this.accountId;
    }

    public showLoginIfNeeded(): Promise<{ accountId: string; username: string }> {
        return new Promise((resolve) => {
            if (this.hasAccount()) {
                resolve({
                    accountId: this.getAccountId(),
                    username: this.getUsername()
                });
                return;
            }

            this.loginUI.show({
                onLogin: (accountId: string, username: string) => {
                    this.accountId = accountId;
                    this.username = username;
                    this.isLoggedIn = true;
                    
                    // Only store persistent accounts (not guests)
                    if (!accountId.startsWith('guest_')) {
                        localStorage.setItem(AccountManager.ACCOUNT_ID_KEY, accountId);
                        localStorage.setItem(AccountManager.USERNAME_KEY, username);
                    }
                    
                    resolve({ accountId, username });
                }
            });
        });
    }

    public logout(): void {
        this.accountId = null;
        this.username = null;
        this.isLoggedIn = false;
        this.inventory = { petals: [], collectedItems: [] };
        
        // Clear stored account
        localStorage.removeItem(AccountManager.ACCOUNT_ID_KEY);
        localStorage.removeItem(AccountManager.USERNAME_KEY);
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

    public destroy(): void {
        if (this.loginUI) {
            this.loginUI.destroy();
        }
    }
} 