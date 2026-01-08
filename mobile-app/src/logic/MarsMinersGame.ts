import { t } from './locales';

export type PlayerRole = 'human' | 'ai' | 'none';
export type Cell = string; // '.', 'X', or player symbols
export type PlayerId = 1 | 2 | 3 | 4;

export interface Player {
    st: string;
    mi: string;
    name: string;
    pos: [number, number];
    color: string;
}

export interface GameState {
    width: number;
    height: number;
    roles: Record<PlayerId, PlayerRole>;
    weapon_req: number;
    turn: PlayerId;
    player_lost: Record<PlayerId, boolean>;
    game_over: boolean;
    battleLog: string[];
}

export class MarsMinersGame {
    width: number;
    height: number;
    grid: Cell[][];
    roles: Record<PlayerId, PlayerRole>;
    weapon_req: number;
    player_lost: Record<PlayerId, boolean>;
    turn: PlayerId;
    game_over: boolean;
    battleLog: string[];
    highlight_weapon: boolean = true;

    players: Record<PlayerId, Player>;

    constructor(
        roles: Record<PlayerId, PlayerRole>,
        weapon_req = 4
    ) {
        this.width = 10;
        this.height = 10;
        this.grid = Array(this.height).fill(null).map(() => Array(this.width).fill('.'));
        this.roles = roles;
        this.weapon_req = weapon_req;
        this.player_lost = { 1: false, 2: false, 3: false, 4: false };
        this.game_over = false;
        this.battleLog = [];

        this.addLog(`WEAPON_REQ ${this.weapon_req}`);

        let p_count = 1;
        for (let p_id = 1; p_id <= 4; p_id++) {
            const role = roles[p_id as PlayerId];
            if (role !== 'none') {
                this.addLog(`JOIN ${role}`);
            }
        }


        this.players = {
            1: { st: '↑', mi: '○', name: t('player_1', 'en'), pos: [1, 1], color: '#FF6464' },
            2: { st: '↓', mi: '△', name: t('player_2', 'en'), pos: [this.height - 2, this.width - 2], color: '#64FF64' },
            3: { st: '←', mi: '□', name: t('player_3', 'en'), pos: [1, this.width - 2], color: '#6464FF' },
            4: { st: '→', mi: '◇', name: t('player_4', 'en'), pos: [this.height - 2, 1], color: '#FFC832' }
        };

        // Initialize board
        for (let p_id_str in this.roles) {
            const p_id = parseInt(p_id_str) as PlayerId;
            const role = this.roles[p_id];
            const [r, c] = this.players[p_id].pos;

            if (role !== 'none') {
                this.grid[r][c] = this.players[p_id].st;
            } else {
                this.grid[r][c] = 'X';
                this.player_lost[p_id] = true;
            }
        }

        this.turn = 1;
        while (this.roles[this.turn] === 'none' && this.turn < 4) {
            this.turn = (this.turn + 1) as PlayerId;
        }
        // If turn went past 4 without finding active player, handled logic? Python loops while turn < 4.
        // Actually Python logic:
        // while self.roles.get(self.turn) == 'none' and self.turn < 4: self.turn += 1
        // It could start at 1, increment to 4.
        // If all are none, handled elsewhere?
    }

    toDict(): GameState {
        return {
            width: this.width,
            height: this.height,
            roles: { ...this.roles },
            weapon_req: this.weapon_req,
            turn: this.turn,
            player_lost: { ...this.player_lost },
            game_over: this.game_over,
            battleLog: [...this.battleLog]
        };
    }

    replayLog(log: string[]) {
        let p_id_counter: PlayerId = 1;
        this.roles = { 1: 'none', 2: 'none', 3: 'none', 4: 'none' };

        // Apply moves
        for (const entry of log) {
            const parts = entry.split(' ');
            const cmd = parts[0];

            if (cmd === 'SIZE') {
                // Ignore SIZE commands in legacy logs, as we are hardcoded to 10x10 now
                continue;
            } else if (cmd === 'WEAPON_REQ') {
                this.weapon_req = parseInt(parts[1]);
            } else if (cmd === 'JOIN') {
                const role = parts[1] as PlayerRole;
                this.roles[p_id_counter] = role;
                const [r, c] = this.players[p_id_counter].pos;
                this.grid[r][c] = this.players[p_id_counter].st;
                p_id_counter = (p_id_counter + 1) as PlayerId;
            } else if (cmd === 'S' || cmd === 'M') {
                const c = parseInt(parts[1]);
                const r = parseInt(parts[2]);
                const to_build = cmd === 'S' ? 'st' : 'mi';
                this.grid[r][c] = (to_build === 'st') ? this.players[this.turn].st : this.players[this.turn].mi;
                this.battleLog.push(entry);
                this.nextTurnInternal();
            } else if (cmd === 'L') {
                const tc = parseInt(parts[1]);
                const tr = parseInt(parts[2]);
                this.grid[tr][tc] = '█';
                if (parts.length === 5) {
                    const sc = parseInt(parts[3]);
                    const sr = parseInt(parts[4]);
                    this.grid[sr][sc] = '█';
                }
                this.battleLog.push(entry);
                this.nextTurnInternal();
            }
        }

        // Set turn correctly if it's start of game
        if (this.battleLog.length === 0) {
            this.turn = 1;
            while (this.roles[this.turn] === 'none' && this.turn < 4) {
                this.turn = (this.turn + 1) as PlayerId;
            }
        }
    }

    private nextTurnInternal() {
        // Update lost status
        for (let p_id = 1; p_id <= 4; p_id++) {
            const pid = p_id as PlayerId;
            if (this.roles[pid] !== 'none' && !this.player_lost[pid]) {
                if (!this.canPlayerMove(pid)) {
                    this.player_lost[pid] = true;
                }
            }
        }

        // Check if game over (no active players)
        const activePlayers = [1, 2, 3, 4].filter(pid =>
            this.roles[pid as PlayerId] !== 'none' && !this.player_lost[pid as PlayerId]
        );
        if (activePlayers.length === 0) {
            this.game_over = true;
            return;
        }

        // Check for early win (one player left with more resources than others)
        if (activePlayers.length === 1) {
            const scores = this.getScores();
            const winnerId = activePlayers[0] as PlayerId;
            const winnerScore = scores[winnerId] || 0;

            let maxOtherScore = 0;
            for (let pid = 1; pid <= 4; pid++) {
                const id = pid as PlayerId;
                if (id !== winnerId && this.roles[id] !== 'none') {
                    maxOtherScore = Math.max(maxOtherScore, scores[id] || 0);
                }
            }

            if (winnerScore > maxOtherScore) {
                this.game_over = true;
                return;
            }
        }

        // Advance turn to next valid player
        const startTurn = this.turn;
        do {
            this.turn = (this.turn % 4 + 1) as PlayerId;
        } while ((this.roles[this.turn] === 'none' || this.player_lost[this.turn]) && this.turn !== startTurn);
    }

    fromDict(state: GameState) {
        this.width = state.width;
        this.height = state.height;
        this.roles = { ...state.roles };
        this.weapon_req = state.weapon_req;
        this.turn = state.turn;
        this.player_lost = { ...state.player_lost };
        this.game_over = state.game_over;
        this.battleLog = [...state.battleLog];

        // Reconstruct grid from log if needed, but here we assume the dict is complete
        // Actually fromDict should probably just set the values.
    }

    nextTurn() {
        this.nextTurnInternal();
    }

    getScores(): Record<PlayerId, number> {
        const scores: any = {};
        for (let p_id_str in this.roles) {
            const p_id = parseInt(p_id_str) as PlayerId;
            if (this.roles[p_id] !== 'none') {
                scores[p_id] = this.grid.reduce((acc, row) => acc + row.filter(c => c === this.players[p_id].mi).length, 0);
            }
        }
        return scores;
    }

    getWeaponCells(): Set<string> {
        const weapon_cells = new Set<string>();
        for (let p_id = 1; p_id <= 4; p_id++) {
            const pid = p_id as PlayerId;
            if (this.roles[pid] === 'none') continue;
            const st = this.players[pid].st;

            // Check Rows
            for (let r = 0; r < this.height; r++) {
                let cur_line: [number, number][] = [];
                for (let c = 0; c < this.width; c++) {
                    if (this.grid[r][c] === st) {
                        cur_line.push([r, c]);
                    } else {
                        if (cur_line.length >= this.weapon_req) {
                            cur_line.forEach(pos => weapon_cells.add(pos.toString()));
                        }
                        cur_line = [];
                    }
                }
                if (cur_line.length >= this.weapon_req) {
                    cur_line.forEach(pos => weapon_cells.add(pos.toString()));
                }
            }

            // Check Columns
            for (let c = 0; c < this.width; c++) {
                let cur_line: [number, number][] = [];
                for (let r = 0; r < this.height; r++) {
                    if (this.grid[r][c] === st) {
                        cur_line.push([r, c]);
                    } else {
                        if (cur_line.length >= this.weapon_req) {
                            cur_line.forEach(pos => weapon_cells.add(pos.toString()));
                        }
                        cur_line = [];
                    }
                }
                if (cur_line.length >= this.weapon_req) {
                    cur_line.forEach(pos => weapon_cells.add(pos.toString()));
                }
            }
        }
        return weapon_cells;
    }

    addLog(command: string, r?: number, c?: number, sr?: number, sc?: number) {
        if (r !== undefined && c !== undefined) {
            if (sr !== undefined && sc !== undefined) {
                this.battleLog.push(`${command} ${c} ${r} ${sc} ${sr}`);
            } else {
                this.battleLog.push(`${command} ${c} ${r}`);
            }
        } else {
            this.battleLog.push(command);
        }
    }

    silentAddLog(entry: string) {
        this.battleLog.push(entry);
    }

    getLinePower(p: PlayerId): number {
        const st = this.players[p].st;
        let max_p = 0;
        // Rows
        for (let r = 0; r < this.height; r++) {
            let cur = 0;
            for (let c = 0; c < this.width; c++) {
                cur = (this.grid[r][c] === st) ? cur + 1 : 0;
                max_p = Math.max(max_p, cur);
            }
        }
        // Cols
        for (let c = 0; c < this.width; c++) {
            let cur = 0;
            for (let r = 0; r < this.height; r++) {
                cur = (this.grid[r][c] === st) ? cur + 1 : 0;
                max_p = Math.max(max_p, cur);
            }
        }
        return max_p;
    }

    canPlayerMove(p: PlayerId): boolean {
        if (this.player_lost[p]) return false;
        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                if (this.canBuild(r, c, p)) return true;
            }
        }
        return false;
    }

    canBuild(r: number, c: number, p: PlayerId): boolean {
        if (!(r >= 0 && r < this.height && c >= 0 && c < this.width)) return false;
        if (this.grid[r][c] !== '.') return false;
        const target_station = this.players[p].st;
        const adj = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of adj) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < this.height && nc >= 0 && nc < this.width) {
                if (this.grid[nr][nc] === target_station) return true;
            }
        }
        return false;
    }

    shootLaser(r: number, c: number, sacrifice?: [number, number]): boolean {
        if (this.grid[r][c] !== '.' && this.grid[r][c] !== '█') {
            this.grid[r][c] = '█';
            if (sacrifice) {
                const [sr, sc] = sacrifice;
                this.grid[sr][sc] = '█';
                this.addLog('L', r, c, sr, sc);
            } else {
                this.addLog('L', r, c);
            }
            return true;
        }
        return false;
    }

    aiMove() {
        const p = this.turn;
        const power = this.getLinePower(p);

        // Try shooting if power sufficient
        if (power >= this.weapon_req) {
            const weaponCells = Array.from(this.getWeaponCells()).map(s => s.split(',').map(Number) as [number, number]);
            const myWeaponCells = weaponCells.filter(([r, c]) => this.grid[r][c] === this.players[p].st);

            if (myWeaponCells.length > 0) {
                const enemyTargets: [number, number][] = [];
                for (let r = 0; r < this.height; r++) {
                    for (let c = 0; c < this.width; c++) {
                        const cell = this.grid[r][c];
                        // Check if cell is an enemy station
                        for (let pidStr in this.players) {
                            const pid = parseInt(pidStr) as PlayerId;
                            if (pid !== p && cell === this.players[pid].st) {
                                enemyTargets.push([r, c]);
                                break; // only add once
                            }
                        }
                    }
                }
                if (enemyTargets.length > 0) {
                    const [tr, tc] = enemyTargets[Math.floor(Math.random() * enemyTargets.length)];
                    const sacrifice = myWeaponCells[Math.floor(Math.random() * myWeaponCells.length)];
                    if (this.shootLaser(tr, tc, sacrifice)) return;
                }
            }
        }

        // Build
        interface Candidate {
            pos: [number, number];
            freedom: number;
            dist: number;
        }
        const candidates: Candidate[] = [];
        const centerMap: [number, number] = [(this.height - 1) / 2, (this.width - 1) / 2];

        for (let r = 0; r < this.height; r++) {
            for (let c = 0; c < this.width; c++) {
                if (this.canBuild(r, c, p)) {
                    // Calc freedom (open neighbors)
                    let openNeighbors = 0;
                    const adj = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                    for (const [dr, dc] of adj) {
                        const nr = r + dr;
                        const nc = c + dc;
                        if (nr >= 0 && nr < this.height && nc >= 0 && nc < this.width) {
                            if (this.grid[nr][nc] === '.') openNeighbors++;
                        }
                    }
                    const dist = Math.sqrt((r - centerMap[0]) ** 2 + (c - centerMap[1]) ** 2);
                    candidates.push({ pos: [r, c], freedom: openNeighbors, dist });
                }
            }
        }

        if (candidates.length === 0) return;

        // Sort: freedom desc, dist asc (python: -dist for reverse=True means dist desc? Wait.)
        // Python: candidates.sort(key=lambda x: (x['freedom'], -x['dist']), reverse=True)
        // Sorts by tuple (freedom, -dist) DESCENDING.
        // So higher freedom comes first.
        // If freedom equal, higher -dist comes first => lower dist comes LAST?
        // Wait. -dist descending means (-10, -5) -> -5 > -10. So smaller distance (5) is "greater" in negative? No.
        // -5 > -10. So 5 is "smaller distance". -5 is "larger value".
        // So reverse=True puts LARGER values first.
        // So it prefers LARGER freedom and LARGER -dist (which means SMALLER dist).
        // Correct.

        candidates.sort((a, b) => {
            if (a.freedom !== b.freedom) return b.freedom - a.freedom; // Desc
            return a.dist - b.dist; // Asc (smaller dist is better)
        });

        // Pick top 3
        const topN = candidates.slice(0, Math.min(3, Math.max(1, candidates.length)));
        const choice = topN[Math.floor(Math.random() * topN.length)];
        const [r, c] = choice.pos;

        let to_build = 'st';
        if (choice.freedom === 0) {
            to_build = (power < this.weapon_req) ? 'st' : 'mi';
        } else {
            // Python: 'mi' if len(candidates) > 5 and random.random() < 0.2 else 'st'
            if (candidates.length > 5 && Math.random() < 0.2) {
                to_build = 'mi';
            } else {
                to_build = 'st';
            }
        }

        this.grid[r][c] = (to_build === 'st') ? this.players[p].st : this.players[p].mi;
        this.addLog(to_build === 'st' ? 'S' : 'M', r, c);
    }
}
