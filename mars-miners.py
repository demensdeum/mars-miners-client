import os
import random
import time
import sys

class MarsMiners4P:
    def __init__(self, roles):
        self.size = 10
        self.grid = [['.' for _ in range(self.size)] for _ in range(self.size)]
        self.roles = roles
        self.players = {
            1: {'st': '↑', 'mi': '○', 'name': 'P1', 'pos': (0,0)},
            2: {'st': '↓', 'mi': '△', 'name': 'P2', 'pos': (9,9)},
            3: {'st': '←', 'mi': '□', 'name': 'P3', 'pos': (0,9)},
            4: {'st': '→', 'mi': '◇', 'name': 'P4', 'pos': (9,0)}
        }

        for p_id, role in self.roles.items():
            r, c = self.players[p_id]['pos']
            if role != 'none':
                self.grid[r][c] = self.players[p_id]['st']
            else:
                self.grid[r][c] = 'X'

        self.turn = 1

    def draw(self):
        os.system('cls' if os.name == 'nt' else 'clear')
        print("\n=== MARS MINERS: QUAD SECTOR ===")
        print("   " + " ".join(map(str, range(self.size))))
        for i, row in enumerate(self.grid):
            print(f"{i} |" + " ".join(row) + "|")

        scores = {p: sum(row.count(self.players[p]['mi']) for row in self.grid) for p in self.players if self.roles[p] != 'none'}
        score_str = " | ".join([f"{self.players[p]['name']}: {scores[p]}" for p in scores])
        print(f"\nСЧЕТ: {score_str}")

        power = self.get_line_power(self.turn)
        status = f"ЛАЗЕР: {power}" if power >= 2 else "ЗАРЯДКА..."
        print(f"ХОД: {self.players[self.turn]['name']} ({self.roles[self.turn].upper()}) | {status}")
        print("(Нажмите Ctrl+C для выхода)")

    def get_line_power(self, p):
        st = self.players[p]['st']
        max_p = 0
        for r in range(self.size):
            cur = 0
            for c in range(self.size):
                cur = cur + 1 if self.grid[r][c] == st else 0
                max_p = max(max_p, cur)
        for c in range(self.size):
            cur = 0
            for r in range(self.size):
                cur = cur + 1 if self.grid[r][c] == st else 0
                max_p = max(max_p, cur)
        return max_p

    def can_build(self, r, c, p, is_mine=False):
        if not (0 <= r < self.size and 0 <= c < self.size) or self.grid[r][c] != '.':
            return False
        adj = [(-1,0), (1,0), (0,-1), (0,1)]
        neighbors = [self.grid[r+dr][c+dc] for dr, dc in adj if 0 <= r+dr < self.size and 0 <= c+dc < self.size]
        if is_mine:
            return self.players[p]['st'] in neighbors
        return any(n in self.players[p].values() for n in neighbors)

    def shoot(self, r, c, d, power):
        dr, dc = [(-1,0), (1,0), (0,-1), (0,1)][d]
        curr_r, curr_c = r + dr, c + dc
        target_st = None
        hits = 0
        while 0 <= curr_r < self.size and 0 <= curr_c < self.size and hits < power:
            cell = self.grid[curr_r][curr_c]
            is_any_st = any(cell == p['st'] for p in self.players.values())
            if is_any_st:
                if target_st is None: target_st = cell
                if cell == target_st:
                    self.grid[curr_r][curr_c] = '█'; hits += 1
                else: break
            elif cell != '.' and target_st: break
            curr_r, curr_c = curr_r + dr, curr_c + dc
        return hits > 0

    def ai_turn(self):
        p = self.turn
        power = self.get_line_power(p)
        if power >= 2:
            for r in range(self.size):
                for c in range(self.size):
                    for d in range(4):
                        if self.shoot(r, c, d, power): return
        mines = [(r,c) for r in range(self.size) for c in range(self.size) if self.can_build(r, c, p, True)]
        if mines:
            r, c = random.choice(mines)
            self.grid[r][c] = self.players[p]['mi']; return
        stations = [(r,c) for r in range(self.size) for c in range(self.size) if self.can_build(r, c, p)]
        if stations:
            r, c = min(stations, key=lambda x: (x[0]-4.5)**2 + (x[1]-4.5)**2)
            self.grid[r][c] = self.players[p]['st']; return

    def play(self):
        try:
            while any(cell == '.' for row in self.grid for cell in row):
                if self.roles[self.turn] == 'none':
                    self.turn = self.turn % 4 + 1; continue

                self.draw()
                if self.roles[self.turn] == 'ai':
                    time.sleep(0.5); self.ai_turn()
                    self.turn = self.turn % 4 + 1; continue

                print("\nКоманды: 1 r c (Станция), 2 r c (Шахта), 3 r c d (Выстрел: 0-U, 1-D, 2-L, 3-R)")
                try:
                    inp = input(">> ").split()
                    if not inp: continue
                    cmd, r, c = int(inp[0]), int(inp[1]), int(inp[2])
                    success = False
                    if cmd == 1 and self.can_build(r, c, self.turn):
                        self.grid[r][c] = self.players[self.turn]['st']; success = True
                    elif cmd == 2 and self.can_build(r, c, self.turn, True):
                        self.grid[r][c] = self.players[self.turn]['mi']; success = True
                    elif cmd == 3 and self.get_line_power(self.turn) >= 2:
                        if self.shoot(r, c, int(inp[3]), self.get_line_power(self.turn)): success = True
                    if success: self.turn = self.turn % 4 + 1
                except (ValueError, IndexError): continue

            print("\nИГРА ОКОНЧЕНА! Все ресурсы распределены.")

        except KeyboardInterrupt:
            print("\n\n[!] Сеанс прерван игроком. Экстренное завершение миссии...")
            scores = {p: sum(row.count(self.players[p]['mi']) for row in self.grid) for p in self.players if self.roles[p] != 'none'}
            print("Финальный счет на момент выхода:")
            for p, s in scores.items():
                print(f" - {self.players[p]['name']}: {s}")
            sys.exit(0)

if __name__ == "__main__":
    roles = {}
    print("--- НАСТРОЙКА ЭКСПЕДИЦИИ НА МАРС ---")
    for i in range(1, 5):
        print(f"\nИгрок {i}: 1-Человек, 2-Бот, 3-Никто")
        c = input(f"Выбор для P{i}: ")
        roles[i] = 'human' if c == '1' else 'ai' if c == '2' else 'none'

    MarsMiners4P(roles).play()
