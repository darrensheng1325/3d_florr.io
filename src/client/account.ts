import { v4 as uuidv4 } from 'uuid';

export class AccountManager {
    private static readonly ACCOUNT_ID_KEY = 'florr_account_id';
    private accountId: string;

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
} 