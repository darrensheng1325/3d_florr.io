import fs from 'fs';
import path from 'path';
import { BasePetalType, PetalInventoryEntry, Rarity, parsePetalType, getPetalType } from '../shared/types';

interface AccountData {
    id: string;
    lastSeen: number;
    totalXP: number;
    highestWave: number;
    inventory: {
        petals: PetalInventoryEntry[];
        collectedItems: Array<{
            type: string;
            amount: number;
        }>;
    };
    stats: {
        totalKills: number;
        totalDeaths: number;
        totalPlayTime: number;
        bestXP: number;
    };
}

class DatabaseManager {
    private dbPath: string;
    private data: { [accountId: string]: AccountData } = {};

    constructor() {
        this.dbPath = path.join(__dirname, '../../data/accounts.json');
        this.loadData();
    }

    private loadData(): void {
        try {
            if (fs.existsSync(this.dbPath)) {
                const rawData = fs.readFileSync(this.dbPath, 'utf8');
                this.data = JSON.parse(rawData);
                
                // Migrate old format to new format if needed
                this.migrateOldData();
            }
        } catch (error) {
            console.error('Error loading database:', error);
            this.data = {};
        }
    }

    private migrateOldData(): void {
        let migrationNeeded = false;
        
        Object.values(this.data).forEach(account => {
            let accountMigrated = false;
            
            // Check if this account has old format petals in the petals array
            if (account.inventory.petals && account.inventory.petals.length > 0) {
                const firstPetal = account.inventory.petals[0];
                
                // If it has a 'type' property, it's old format
                if ('type' in firstPetal && !('baseType' in firstPetal)) {
                    console.log(`Migrating account ${account.id} petals array from old format to new format`);
                    migrationNeeded = true;
                    accountMigrated = true;
                    
                    // Convert old format to new format
                    const baseTypeGroups: { [key in BasePetalType]?: { [key in Rarity]: number } } = {};
                    const oldPetals = account.inventory.petals as any[];
                    
                    oldPetals.forEach(oldPetal => {
                        const petalType = oldPetal.type;
                        const amount = oldPetal.amount || 1;
                        
                        // Parse the old petal type to get base type and rarity
                        const { baseType, rarity } = parsePetalType(petalType);
                        
                        if (!baseTypeGroups[baseType]) {
                            baseTypeGroups[baseType] = {
                                [Rarity.COMMON]: 0,
                                [Rarity.UNCOMMON]: 0,
                                [Rarity.RARE]: 0,
                                [Rarity.EPIC]: 0,
                                [Rarity.LEGENDARY]: 0,
                                [Rarity.MYTHIC]: 0
                            };
                        }
                        
                        baseTypeGroups[baseType]![rarity] += amount;
                    });
                    
                    // Convert to new format
                    const newPetals: PetalInventoryEntry[] = [];
                    Object.entries(baseTypeGroups).forEach(([baseType, rarities]) => {
                        newPetals.push({
                            baseType: baseType as BasePetalType,
                            rarities: rarities!
                        });
                    });
                    
                    account.inventory.petals = newPetals;
                }
            }
            
            // Check if this account has items in collectedItems that should be migrated to new petal format
            if (account.inventory.collectedItems && account.inventory.collectedItems.length > 0) {
                // Check if we need to migrate from collectedItems to new petal format
                // This happens when collectedItems has petal types that need to be migrated
                const petalItemsInCollected = account.inventory.collectedItems.filter(item => 
                    item.type === 'PEA' || item.type === 'LEAF' || item.type === 'STINGER' || 
                    item.type === 'CUBE' || item.type === 'TETRAHEDRON' || 
                    item.type.includes('_') // rarity variants like pea_uncommon
                );
                
                // Check if any of these items represent significant quantities that should be migrated
                const hasSignificantPetalItems = petalItemsInCollected.some(item => item.amount > 0);
                
                if (hasSignificantPetalItems) {
                    console.log(`Migrating account ${account.id} collected items to new petal format`);
                    migrationNeeded = true;
                    
                    // Group collected items by base type and rarity
                    const baseTypeGroups: { [key in BasePetalType]?: { [key in Rarity]: number } } = {};
                    
                    account.inventory.collectedItems.forEach(item => {
                        // Only migrate petal-type items
                        const petalTypes = ['pea', 'leaf', 'stinger', 'cube', 'tetrahedron', 'basic'];
                        const isPetalType = petalTypes.some(type => item.type === type || item.type.startsWith(type + '_'));
                        
                        if (isPetalType) {
                            try {
                                const { baseType, rarity } = parsePetalType(item.type);
                                
                                if (!baseTypeGroups[baseType]) {
                                    baseTypeGroups[baseType] = {
                                        [Rarity.COMMON]: 0,
                                        [Rarity.UNCOMMON]: 0,
                                        [Rarity.RARE]: 0,
                                        [Rarity.EPIC]: 0,
                                        [Rarity.LEGENDARY]: 0,
                                        [Rarity.MYTHIC]: 0
                                    };
                                }
                                
                                baseTypeGroups[baseType]![rarity] += item.amount;
                                console.log(`  Migrating ${item.amount}x ${item.type} -> ${baseType} (${rarity})`);
                            } catch (error) {
                                console.log(`  Skipping unknown petal type: ${item.type}`);
                            }
                        }
                    });
                    
                    // Merge with existing petals or create new
                    Object.entries(baseTypeGroups).forEach(([baseType, rarities]) => {
                        const existingEntry = account.inventory.petals.find(p => p.baseType === baseType as BasePetalType);
                        if (existingEntry) {
                            // Merge with existing
                            Object.entries(rarities!).forEach(([rarity, count]) => {
                                existingEntry.rarities[rarity as Rarity] += count;
                            });
                        } else {
                            // Create new entry
                            account.inventory.petals.push({
                                baseType: baseType as BasePetalType,
                                rarities: rarities!
                            });
                        }
                    });
                    
                    console.log(`  Migration complete for account ${account.id}`);
                }
            }
        });
        
        if (migrationNeeded) {
            this.saveData();
            console.log('Database migration completed');
        }
    }

    private saveData(): void {
        try {
            const dir = path.dirname(this.dbPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2));
        } catch (error) {
            console.error('Error saving database:', error);
        }
    }

    public getAccount(accountId: string): AccountData | null {
        return this.data[accountId] || null;
    }

    public createAccount(accountId: string): AccountData {
        const newAccount: AccountData = {
            id: accountId,
            lastSeen: Date.now(),
            totalXP: 0,
            highestWave: 0,
            inventory: {
                petals: [],
                collectedItems: []
            },
            stats: {
                totalKills: 0,
                totalDeaths: 0,
                totalPlayTime: 0,
                bestXP: 0
            }
        };

        this.data[accountId] = newAccount;
        
        // Give new accounts 5 common basic petals to start with
        this.addPetal(accountId, BasePetalType.BASIC, Rarity.COMMON, 5);
        
        this.saveData();
        return newAccount;
    }

    public updateAccount(accountId: string, updates: Partial<AccountData>): void {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }

        Object.assign(account, updates);
        account.lastSeen = Date.now();
        this.saveData();
    }

    public addPetal(accountId: string, baseType: BasePetalType, rarity: Rarity = Rarity.COMMON, amount: number = 1): void {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }

        // Find existing entry for this base type
        let petalEntry = account.inventory.petals.find(p => p.baseType === baseType);
        
        if (!petalEntry) {
            // Create new entry
            petalEntry = {
                baseType: baseType,
                rarities: {
                    [Rarity.COMMON]: 0,
                    [Rarity.UNCOMMON]: 0,
                    [Rarity.RARE]: 0,
                    [Rarity.EPIC]: 0,
                    [Rarity.LEGENDARY]: 0,
                    [Rarity.MYTHIC]: 0
                }
            };
            account.inventory.petals.push(petalEntry);
        }

        petalEntry.rarities[rarity] += amount;
        account.lastSeen = Date.now();
        this.saveData();
    }

    public removePetal(accountId: string, baseType: BasePetalType, rarity: Rarity = Rarity.COMMON, amount: number = 1): boolean {
        const account = this.data[accountId];
        if (!account) {
            console.log(`[removePetal] Account ${accountId} not found`);
            throw new Error(`Account ${accountId} not found`);
        }

        const petalEntry = account.inventory.petals.find(p => p.baseType === baseType);
        if (!petalEntry) {
            console.log(`[removePetal] No petal entry found for baseType: ${baseType}`);
            return false;
        }
        
        const availableAmount = petalEntry.rarities[rarity];
        console.log(`[removePetal] Trying to remove ${amount} ${baseType} (${rarity}), available: ${availableAmount}`);
        
        if (availableAmount < amount) {
            console.log(`[removePetal] Not enough petals - need ${amount}, have ${availableAmount}`);
            return false; // Not enough petals of this type/rarity
        }

        petalEntry.rarities[rarity] -= amount;
        console.log(`[removePetal] Successfully removed ${amount} ${baseType} (${rarity}), remaining: ${petalEntry.rarities[rarity]}`);
        
        // If all rarities are 0, remove the entry
        const hasAnyPetals = Object.values(petalEntry.rarities).some(count => count > 0);
        if (!hasAnyPetals) {
            const index = account.inventory.petals.indexOf(petalEntry);
            account.inventory.petals.splice(index, 1);
            console.log(`[removePetal] Removed empty petal entry for ${baseType}`);
        }

        account.lastSeen = Date.now();
        this.saveData();
        return true;
    }

    // Legacy method for backward compatibility - converts old petal type format
    public addPetalLegacy(accountId: string, petalType: string): void {
        const { baseType, rarity } = parsePetalType(petalType);
        this.addPetal(accountId, baseType, rarity);
    }

    // Legacy method for backward compatibility - converts old petal type format
    public removePetalLegacy(accountId: string, petalType: string): boolean {
        const { baseType, rarity } = parsePetalType(petalType);
        return this.removePetal(accountId, baseType, rarity);
    }

    // Get petals in the old format for backward compatibility
    public getPetalsLegacyFormat(accountId: string): Array<{ type: string; amount: number }> {
        const account = this.data[accountId];
        if (!account) {
            return [];
        }

        const legacyPetals: Array<{ type: string; amount: number }> = [];
        
        account.inventory.petals.forEach(petalEntry => {
            Object.entries(petalEntry.rarities).forEach(([rarity, amount]) => {
                if (amount > 0) {
                    const petalType = getPetalType(petalEntry.baseType, rarity as Rarity);
                    legacyPetals.push({
                        type: petalType,
                        amount: amount
                    });
                }
            });
        });

        return legacyPetals;
    }

    public addCollectedItem(accountId: string, itemType: string): void {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }

        const existingItem = account.inventory.collectedItems.find(item => item.type === itemType);
        if (existingItem) {
            existingItem.amount++;
        } else {
            account.inventory.collectedItems.push({
                type: itemType,
                amount: 1
            });
        }

        account.lastSeen = Date.now();
        this.saveData();
    }

    public removeCollectedItem(accountId: string, itemType: string): void {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }

        const itemIndex = account.inventory.collectedItems.findIndex(item => item.type === itemType);
        if (itemIndex !== -1) {
            const item = account.inventory.collectedItems[itemIndex];
            item.amount--;
            if (item.amount <= 0) {
                account.inventory.collectedItems.splice(itemIndex, 1);
            }
        }

        account.lastSeen = Date.now();
        this.saveData();
    }

    public updateStats(accountId: string, stats: Partial<AccountData['stats']>): void {
        const account = this.data[accountId];
        if (!account) {
            throw new Error(`Account ${accountId} not found`);
        }

        Object.assign(account.stats, stats);
        account.lastSeen = Date.now();
        this.saveData();
    }

    public getAllAccounts(): AccountData[] {
        return Object.values(this.data);
    }

    public getTopPlayers(limit: number = 10): AccountData[] {
        return Object.values(this.data)
            .sort((a, b) => b.totalXP - a.totalXP)
            .slice(0, limit);
    }
}

export const dbManager = new DatabaseManager(); 