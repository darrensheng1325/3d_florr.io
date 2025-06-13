import { io, Socket } from 'socket.io-client';
import { LightingConfig, Rarity, EnemyType, ItemType, PetalType } from '../../shared/types';
import { EventEmitter } from './EventEmitter';
import { AccountManager } from '../account';

export class NetworkManager extends EventEmitter<any> {
    public socket: Socket | null = null;
    private accountManager: AccountManager;

    constructor(accountManager: AccountManager) {
        super();
        this.accountManager = accountManager;
    }

    public initializeSpectatorConnection(): void {
        console.log('[DEBUG] NetworkManager: Initializing spectator connection');
        let accountId = 'spectator_' + Math.random().toString(36).substr(2, 9);
        
        if (this.accountManager.hasAccount()) {
            accountId = this.accountManager.getAccountId();
        }

        console.log('[DEBUG] NetworkManager: Connecting with accountId:', accountId);
        this.socket = io('/', {
            query: {
                accountId: accountId
            }
        });
        this.setupCommonEvents();
    }

    public connectWithAccount(accountId: string): void {
        console.log('[DEBUG] NetworkManager: Connecting with account:', accountId);
        if (this.socket) {
            console.log('[DEBUG] NetworkManager: Disconnecting existing socket');
            this.socket.disconnect();
        }
        this.socket = io('/', {
            query: {
                accountId: accountId
            }
        });
        this.setupGameEvents();
        this.setupCommonEvents();
    }
    
    public emit(event: string, data?: any) {
        console.log('[DEBUG] NetworkManager: Emitting event:', event, data);
        this.socket?.emit(event, data);
    }

    private setupCommonEvents(): void {
        if (!this.socket) return;
        
        console.log('[DEBUG] NetworkManager: Setting up common events');
        
        this.socket.on('disconnect', (reason) => {
            console.log('[DEBUG] NetworkManager: Socket disconnected:', reason);
            super.emit('disconnect', reason);
        });

        this.socket.on('connect_error', (error) => {
            console.log('[DEBUG] NetworkManager: Connection error:', error);
            super.emit('connect_error', error);
        });

        this.socket.on('connect', () => {
            console.log('[DEBUG] NetworkManager: Socket connected, ID:', this.socket?.id);
            super.emit('connect');
        });

        this.socket.on('playerJoined', (data: { id: string, position: { x: number, y: number, z: number } }) => {
            console.log('[DEBUG] NetworkManager: playerJoined received:', data);
            super.emit('playerJoined', data);
        });

        this.socket.on('playerLeft', (playerId: string) => {
            console.log('[DEBUG] NetworkManager: playerLeft received:', playerId);
            super.emit('playerLeft', playerId);
        });

        this.socket.on('playerMoved', (data: { id: string, position: { x: number, y: number, z: number } }) => {
            super.emit('playerMoved', data);
        });

        this.setupEnemyEvents();
    }

    private setupGameEvents(): void {
        if (!this.socket) return;

        console.log('[DEBUG] NetworkManager: Setting up game events');

        this.socket.on('connect', () => {
            console.log('[DEBUG] NetworkManager: Game socket connected, ID:', this.socket?.id);
            if (this.socket?.id) {
                super.emit('gameConnect', { id: this.socket.id });
                this.socket.emit('requestLightingConfig');
            }
        });

        this.socket.on('lightingConfig', (config: LightingConfig) => {
            super.emit('lightingConfig', config);
        });

        this.socket.on('configUpdate', (config: any) => {
            super.emit('configUpdate', config);
        });

        this.socket.on('playerDamaged', (data: { id: string, health: number }) => {
            super.emit('playerDamaged', data);
        });

        this.socket.on('playerDeathSequence', (data: { id: string }) => {
            super.emit('playerDeathSequence', data);
        });

        this.socket.on('itemSpawned', (data: { id: string, type: string, position: { x: number, y: number, z: number } }) => {
            super.emit('itemSpawned', data);
        });

        this.socket.on('enemyDamaged', (data: { enemyId: string, damage: number, health: number }) => {
            super.emit('enemyDamaged', data);
        });

        this.socket.on('waveStart', (data: { wave: number, minRarity: Rarity }) => {
            super.emit('waveStart', data);
        });

        this.socket.on('playerXP', (data: { id: string, xp: number }) => {
            super.emit('playerXP', data);
        });
        
        this.socket.on('accountSync', (data) => super.emit('accountSync', data));
        this.socket.on('inventorySync', (data) => super.emit('inventorySync', data));
        this.socket.on('itemCollectionConfirmed', (data) => super.emit('itemCollectionConfirmed', data));
        this.socket.on('inventoryUpdateConfirmed', (data) => super.emit('inventoryUpdateConfirmed', data));
    }
    
    private setupEnemyEvents(): void {
        if (!this.socket) return;

        this.socket.on('enemySpawned', (data) => super.emit('enemySpawned', data));
        this.socket.on('enemyMoved', (data) => super.emit('enemyMoved', data));
        this.socket.on('enemyDied', (data) => super.emit('enemyDied', data));
    }
} 