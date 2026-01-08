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
    size: number;
    grid: Cell[][];
    roles: Record<PlayerId, PlayerRole>;
    weapon_req: number;
    allow_skip: boolean;
    ai_wait: number;
    lang: 'en' | 'ru';
    turn: PlayerId;
    player_lost: Record<PlayerId, boolean>;
    game_over: boolean;
    highlight_weapon: boolean;
}

export class MarsMinersGame {
    size: number;
    grid: Cell[][];
    roles: Record<PlayerId, PlayerRole>;
    weapon_req: number;
    allow_skip: boolean;
    ai_wait: number;
    lang: 'en' | 'ru';
    highlight_weapon: boolean;
    player_lost: Record<PlayerId, boolean>;
    turn: PlayerId;
    game_over: boolean;

    players: Record<PlayerId, Player>;

    constructor(
        roles: Record<PlayerId, PlayerRole>,
        grid_size = 10,
        weapon_req = 4,
        allow_skip = true,
        ai_wait = 0,
        lang: 'en' | 'ru' = 'en'
    ) {
        this.size = grid_size;
        this.grid = Array(this.size).fill(null).map(() => Array(this.size).fill('.'));
        this.roles = roles;
        this.weapon_req = weapon_req;
        this.allow_skip = allow_skip;
        this.ai_wait = ai_wait;
        this.lang = lang;
        this.highlight_weapon = true;
        this.player_lost = { 1: false, 2: false, 3: false, 4: false };
        this.game_over = false;


        this.players = {
            1: { st: '↑', mi: '○', name: t('player_1', lang), pos: [1, 1], color: '#FF6464' },
            2: { st: '↓', mi: '△', name: t('player_2', lang), pos: [this.size - 2, this.size - 2], color: '#64FF64' },
            3: { st: '←', mi: '□', name: t('player_3', lang), pos: [1, this.size - 2], color: '#6464FF' },
            4: { st: '→', mi: '◇', name: t('player_4', lang), pos: [this.size - 2, 1], color: '#FFC832' }
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
            size: this.size,
            grid: JSON.parse(JSON.stringify(this.grid)),
            roles: { ...this.roles },
            weapon_req: this.weapon_req,
            allow_skip: this.allow_skip,
            ai_wait: this.ai_wait,
            lang: this.lang,
            turn: this.turn,
            player_lost: { ...this.player_lost },
            game_over: this.game_over,
            highlight_weapon: this.highlight_weapon
        };
    }

    fromDict(data: GameState) {
        this.size = data.size;
        this.grid = data.grid;
        this.roles = data.roles;
        this.weapon_req = data.weapon_req;
        this.allow_skip = data.allow_skip;
        this.ai_wait = data.ai_wait;
        this.lang = data.lang;
        this.turn = data.turn;
        this.player_lost = data.player_lost;
        this.game_over = data.game_over;
        this.highlight_weapon = data.highlight_weapon ?? true;
        // Re-init players pos if size changed?
        // Actually players pos logic is tied to size in constructor. We should update player pos based on loaded size.
        this.players[2].pos = [this.size - 2, this.size - 2];
        this.players[3].pos = [1, this.size - 2];
        this.players[4].pos = [this.size - 2, 1];
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
            for (let r = 0; r < this.size; r++) {
                let cur_line: [number, number][] = [];
                for (let c = 0; c < this.size; c++) {
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
            for (let c = 0; c < this.size; c++) {
                let cur_line: [number, number][] = [];
                for (let r = 0; r < this.size; r++) {
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

    getLinePower(p: PlayerId): number {
        const st = this.players[p].st;
        let max_p = 0;
        // Rows
        for (let r = 0; r < this.size; r++) {
            let cur = 0;
            for (let c = 0; c < this.size; c++) {
                cur = (this.grid[r][c] === st) ? cur + 1 : 0;
                max_p = Math.max(max_p, cur);
            }
        }
        // Cols
        for (let c = 0; c < this.size; c++) {
            let cur = 0;
            for (let r = 0; r < this.size; r++) {
                cur = (this.grid[r][c] === st) ? cur + 1 : 0;
                max_p = Math.max(max_p, cur);
            }
        }
        return max_p;
    }

    canPlayerMove(p: PlayerId): boolean {
        if (this.player_lost[p]) return false;
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.canBuild(r, c, p)) return true;
            }
        }
        return false;
    }

    canBuild(r: number, c: number, p: PlayerId): boolean {
        if (!(r >= 0 && r < this.size && c >= 0 && c < this.size)) return false;
        if (this.grid[r][c] !== '.') return false;
        const target_station = this.players[p].st;
        const adj = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of adj) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size) {
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
            }
            return true;
        }
        return false;
    }

    nextTurn() {
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

    aiMove() {
        const p = this.turn;
        const power = this.getLinePower(p);

        // Try shooting if power sufficient
        if (power >= this.weapon_req) {
            const weaponCells = Array.from(this.getWeaponCells()).map(s => s.split(',').map(Number) as [number, number]);
            const myWeaponCells = weaponCells.filter(([r, c]) => this.grid[r][c] === this.players[p].st);

            if (myWeaponCells.length > 0) {
                const enemyTargets: [number, number][] = [];
                for (let r = 0; r < this.size; r++) {
                    for (let c = 0; c < this.size; c++) {
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
        const centerMap = [this.size / 2 - 0.5, this.size / 2 - 0.5];

        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.canBuild(r, c, p)) {
                    // Calc freedom (open neighbors)
                    let openNeighbors = 0;
                    const adj = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                    for (const [dr, dc] of adj) {
                        const nr = r + dr;
                        const nc = c + dc;
                        if (nr >= 0 && nr < this.size && nc >= 0 && nc < this.size) {
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
    }
}
