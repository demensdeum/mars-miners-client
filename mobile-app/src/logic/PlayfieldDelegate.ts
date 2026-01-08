export interface PlayfieldDelegate {
    buildStation(r: number, c: number): void;
    buildMine(r: number, c: number): void;
    shootLaser(tr: number, tc: number, sr: number, sc: number): void;
    join(role: string): void;
    setWeaponReq(req: number): void;
}
