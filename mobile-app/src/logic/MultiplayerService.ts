import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_SERVER_URL = 'http://localhost:3000';
const SERVER_URL_KEY = 'mm_server_url';

export interface BattleSession {
    battleID: string;
    sessionID: string;
    players: string[];
    status?: string;
    gameState?: any;
}

export interface CreateBattleResponse {
    success: boolean;
    battleID: string;
    battleSession: BattleSession;
}

export interface JoinBattleResponse {
    success: boolean;
    battleID: string;
    message: string;
    battleSession: BattleSession;
}

export interface SendCommandResponse {
    success: boolean;
    battleID: string;
    command: string;
    message: string;
}

export interface ReadBattleLogResponse {
    success: boolean;
    battleID: string;
    battleLog: string;
}

export interface ErrorResponse {
    error: string;
    message?: string;
    currentLength?: number;
    maxLength?: number;
    currentPlayers?: number;
    maxPlayers?: number;
}

export class MultiplayerService {
    private serverUrl: string = DEFAULT_SERVER_URL;

    constructor() {
        this.loadServerUrl();
    }

    private async loadServerUrl(): Promise<void> {
        try {
            const saved = await AsyncStorage.getItem(SERVER_URL_KEY);
            if (saved) {
                this.serverUrl = saved;
            }
        } catch (e) {
            console.error('Failed to load server URL:', e);
        }
    }

    async setServerUrl(url: string): Promise<void> {
        this.serverUrl = url;
        try {
            await AsyncStorage.setItem(SERVER_URL_KEY, url);
        } catch (e) {
            console.error('Failed to save server URL:', e);
        }
    }

    getServerUrl(): string {
        return this.serverUrl;
    }

    async getOrGenerateSessionID(): Promise<string> {
        try {
            const saved = await AsyncStorage.getItem('mm_session_id');
            if (saved) return saved;

            const newID = this.generateSessionID();
            await AsyncStorage.setItem('mm_session_id', newID);
            return newID;
        } catch (e) {
            return this.generateSessionID();
        }
    }

    generateSessionID(): string {
        // Generate a simple UUID v4
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    private async fetchWithRetry(
        url: string,
        options: RequestInit,
        retries: number = 3
    ): Promise<Response> {
        let lastError: Error | null = null;

        for (let i = 0; i < retries; i++) {
            try {
                const response = await fetch(url, {
                    ...options,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers,
                    },
                });
                return response;
            } catch (error) {
                lastError = error as Error;
                if (i < retries - 1) {
                    // Wait before retry (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
                }
            }
        }

        throw lastError || new Error('Failed to fetch');
    }

    async createBattle(sessionID: string): Promise<CreateBattleResponse> {
        const url = `${this.serverUrl}/createBattle`;
        const response = await this.fetchWithRetry(url, {
            method: 'POST',
            body: JSON.stringify({ sessionID }),
        });

        if (!response.ok) {
            const error: ErrorResponse = await response.json();
            throw new Error(error.error || error.message || 'Failed to create battle');
        }

        return await response.json();
    }

    async createAndJoinBattle(sessionID: string): Promise<JoinBattleResponse> {
        // 1. Create
        const createData = await this.createBattle(sessionID);

        // 2. Join
        return await this.joinBattle(sessionID, createData.battleID);
    }

    async joinBattle(sessionID: string, battleID: string): Promise<JoinBattleResponse> {
        // We need to use the joinBattle endpoint
        const url = `${this.serverUrl}/joinBattle`;
        const response = await this.fetchWithRetry(url, {
            method: 'POST',
            body: JSON.stringify({ sessionID, battleID }),
        });

        if (!response.ok) {
            const error: ErrorResponse = await response.json();
            throw new Error(error.error || error.message || 'Failed to join battle');
        }

        return await response.json();
    }

    async sendCommand(sessionID: string, battleID: string, command: string): Promise<SendCommandResponse> {
        const url = `${this.serverUrl}/sendBattleCommand`;
        const response = await this.fetchWithRetry(url, {
            method: 'POST',
            body: JSON.stringify({ sessionID, battleID, command }),
        });

        if (!response.ok) {
            const error: ErrorResponse = await response.json();
            throw new Error(error.error || error.message || 'Failed to send command');
        }

        return await response.json();
    }

    async readBattleLog(battleID: string): Promise<ReadBattleLogResponse> {
        const url = `${this.serverUrl}/readBattleLog?battleID=${encodeURIComponent(battleID)}`;
        const response = await this.fetchWithRetry(url, {
            method: 'GET',
        });

        if (!response.ok) {
            const error: ErrorResponse = await response.json();
            throw new Error(error.error || error.message || 'Failed to read battle log');
        }

        return await response.json();
    }

    async getBattleSession(sessionID: string, battleID: string): Promise<BattleSession | null> {
        try {
            // Get the battleID for this session first
            const url = `${this.serverUrl}/joinBattle`;
            const response = await this.fetchWithRetry(url, {
                method: 'POST',
                body: JSON.stringify({ sessionID, battleID }),
            });

            if (!response.ok) {
                return null;
            }

            const data: JoinBattleResponse = await response.json();
            return data.battleSession;
        } catch (error) {
            console.error('Failed to get battle session:', error);
            return null;
        }
    }
}

// Singleton instance
export const multiplayerService = new MultiplayerService();
