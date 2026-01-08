import { PlayfieldDelegate } from '../PlayfieldDelegate';
import { BattlelogWriter } from './BattlelogWriter';

export class SingleplayerBattlelogWriter extends BattlelogWriter implements PlayfieldDelegate {
    buildStation(r: number, c: number) {
        this.delegate.addCommand(`S ${c} ${r}`);
    }

    buildMine(r: number, c: number) {
        this.delegate.addCommand(`M ${c} ${r}`);
    }

    shootLaser(tr: number, tc: number, sr: number, sc: number) {
        this.delegate.addCommand(`L ${tc} ${tr} ${sc} ${sr}`);
    }

    join(role: string) {
        this.delegate.addCommand(`JOIN ${role}`);
    }

    setWeaponReq(req: number) {
        this.delegate.addCommand(`WEAPON_REQ ${req}`);
    }
}
