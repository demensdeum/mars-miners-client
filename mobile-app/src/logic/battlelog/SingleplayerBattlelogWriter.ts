import { PlayfieldDelegate } from '../PlayfieldDelegate';
import { BattlelogWriter } from './BattlelogWriter';

export class SingleplayerBattlelogWriter extends BattlelogWriter implements PlayfieldDelegate {
    private onStateChange?: () => void;

    constructor(delegate: any, onStateChange?: () => void) {
        super(delegate);
        this.onStateChange = onStateChange;
    }

    private cmd(c: string) {
        console.log('SPWriter cmd:', c);
        this.delegate.addCommand(c);
        this.onStateChange?.();
    }

    buildStation(r: number, c: number) {
        this.cmd(`S ${c} ${r}`);
    }

    buildMine(r: number, c: number) {
        this.cmd(`M ${c} ${r}`);
    }

    shootLaser(tr: number, tc: number, sr: number, sc: number) {
        this.cmd(`L ${tc} ${tr} ${sc} ${sr}`);
    }

    join(role: string, userId: string) {
        this.cmd(`JOIN ${role} ${userId}`);
    }

    setWeaponReq(req: number) {
        this.cmd(`WEAPON_REQ ${req}`);
    }
}
