import { PlayfieldDelegate } from '../PlayfieldDelegate';
import { BattlelogWriter } from './BattlelogWriter';
import { BattlelogWriterDelegate } from './BattlelogWriterDelegate';

export class WebsocketsBattlelogWriter extends BattlelogWriter implements PlayfieldDelegate {
    private socket: WebSocket;
    private playerSessionId: string;
    private battleSessionId: string;

    constructor(
        delegate: BattlelogWriterDelegate,
        socket: WebSocket,
        playerSessionId: string,
        battleSessionId: string
    ) {
        super(delegate);
        this.socket = socket;
        this.playerSessionId = playerSessionId;
        this.battleSessionId = battleSessionId;

        this.socket.onmessage = (event) => {
            const data = event.data.toString().trim();
            if (data.startsWith('FULLLOG: ')) {
                try {
                    const logs = JSON.parse(data.substring(9));
                    if (Array.isArray(logs)) {
                        logs.forEach(log => this.delegate.addCommand(log));
                    }
                } catch (e) {
                    console.error('Failed to parse FULLLOG', e);
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
