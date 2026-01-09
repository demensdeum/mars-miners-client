import { PlayfieldDelegate } from '../PlayfieldDelegate';
import { BattlelogWriter } from './BattlelogWriter';
import { BattlelogWriterDelegate } from './BattlelogWriterDelegate';

export class WebsocketsBattlelogWriter extends BattlelogWriter implements PlayfieldDelegate {
    private socket: WebSocket;
    private playerSessionId: string;
    private battleSessionId: string;
    private onStateChange?: () => void;

    constructor(
        delegate: BattlelogWriterDelegate,
        socket: WebSocket,
        playerSessionId: string,
        battleSessionId: string,
        onStateChange?: () => void
    ) {
        super(delegate);
        this.socket = socket;
        this.playerSessionId = playerSessionId;
        this.battleSessionId = battleSessionId;
        this.onStateChange = onStateChange;

        this.socket.onmessage = (event) => {
            const data = event.data.toString().trim();
            if (data.startsWith('FULLLOG: ') || data.startsWith('UPDATE ')) {
                const jsonStr = data.startsWith('FULLLOG: ') ? data.substring(9) : data.substring(7);
                try {
                    const logs = JSON.parse(jsonStr);
                    if (Array.isArray(logs)) {
                        if ((this.delegate as any).replayLog) {
                            (this.delegate as any).replayLog(logs);
                        } else {
                            logs.forEach(log => this.delegate.addCommand(log));
                        }
                        if (this.onStateChange) {
                            this.onStateChange();
                        }
                    }
                } catch (e) {
                    console.error('Failed to parse log update', e);
                }
            } else if (data.startsWith('ERROR: ')) {
                console.error('Server error:', data);
            }
        };
    }

    private send(command: string, ...args: any[]) {
        const message = `${this.playerSessionId} ${command} ${this.battleSessionId} ${args.join(' ')}`.trim();
        this.socket.send(message);
    }

    buildStation(r: number, c: number) {
        this.send('WRITE', `S ${c} ${r}`);
    }

    buildMine(r: number, c: number) {
        this.send('WRITE', `M ${c} ${r}`);
    }

    shootLaser(tr: number, tc: number, sr: number, sc: number) {
        this.send('WRITE', `L ${tc} ${tr} ${sc} ${sr}`);
    }

    join(role: string, userId: string) {
        this.send('JOIN');
        this.send('WRITE', `JOIN ${role} ${userId}`);
    }

    setWeaponReq(req: number) {
        this.send('WRITE', `WEAPON_REQ ${req}`);
    }

    create() {
        this.send('CREATE');
    }

    readFull() {
        this.send('READFULL');
    }
}
