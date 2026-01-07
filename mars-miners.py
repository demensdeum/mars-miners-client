import os
import random
import time

class MarsMiners:
    def __init__(self, vs_ai=False):
        self.size = 10
        self.grid = [['.' for _ in range(self.size)] for _ in range(self.size)]
        # Игрок 1: (Станция ↑, Шахта ○), Игрок 2: (Станция ↓, Шахта △)
        self.players = {1: {'st': '↑', 'mi': '○'}, 2: {'st': '↓', 'mi': '△'}}
        self.grid[0][0] = self.players[1]['st']
        self.grid[9][9] = self.players[2]['st']
        self.turn = 1
        self.vs_ai = vs_ai

    def draw(self):
        os.system('cls' if os.name == 'nt' else 'clear')
        print("\n=== MARS MINERS: RED PLANET ===")
        print("   " + " ".join(map(str, range(self.size))))
        for i, row in enumerate(self.grid):
            print(f"{i} |" + " ".join(row) + "|")
        
        p1_score = sum(row.count('○') for row in self.grid)
        p2_score = sum(row.count('△') for row in self.grid)
        print(f"\nСЧЕТ: Игрок 1 (○): {p1_score} | Игрок 2 (△/AI): {p2_score}")
        
        power = self.get_line_power(self.turn)
        status_laser = f"{power} (ГОТОВ)" if power >= 2 else f"{power} (ЗАРЯДКА... нужно >= 2)"
        
        print(f"Ход: {'AI (Mars-Bot)' if self.vs_ai and self.turn == 2 else f'Игрок {self.turn}'}")
        print(f"Мощность лазера: {status_laser}")

    def get_neighbors(self, r, c):
        res = []
        for dr, dc in [(-1,0), (1,0), (0,-1), (0,1)]:
            if 0 <= r+dr < self.size and 0 <= c+dc < self.size:
                res.append((r+dr, c+dc))
        return res

    def can_build_station(self, r, c, p):
        if self.grid[r][c] != '.': return False
        return any(self.grid[nr][nc] in self.players[p].values() for nr, nc in self.get_neighbors(r, c))

    def can_build_mine(self, r, c, p):
        if self.grid[r][c] != '.': return False
        return any(self.grid[nr][nc] == self.players[p]['st'] for nr, nc in self.get_neighbors(r, c))

    def get_line_power(self, p):
        st = self.players[p]['st']
        max_p = 0
        # Горизонтальные линии
        for r in range(self.size):
            count = 0
            for c in range(self.size):
                count = count + 1 if self.grid[r][c] == st else 0
                max_p = max(max_p, count)
        # Вертикальные линии
        for c in range(self.size):
            count = 0
            for r in range(self.size):
                count = count + 1 if self.grid[r][c] == st else 0
                max_p = max(max_p, count)
        return max_p

    def shoot(self, r, c, dr, dc, power, p, dry_run=False):
        enemy_st = self.players[3-p]['st']
        hits = 0
        targets = []
        curr_r, curr_c = r, c
        while 0 <= curr_r < self.size and 0 <= curr_c < self.size and hits < power:
            if self.grid[curr_r][curr_c] == enemy_st:
                targets.append((curr_r, curr_c))
                hits += 1
            curr_r += dr
            curr_c += dc
        
        if not dry_run and hits > 0:
            for tr, tc in targets: self.grid[tr][tc] = '█'
        return hits

    def ai_turn(self):
        time.sleep(1)
        power = self.get_line_power(2)
        
        # Бот стреляет только если мощность 2 и выше
        if power >= 2:
            for r in range(self.size):
                for c in range(self.size):
                    for d_idx, (dr, dc) in enumerate([(-1,0), (1,0), (0,-1), (0,1)]):
                        if self.shoot(r, c, dr, dc, power, 2, dry_run=True) > 0:
                            self.shoot(r, c, dr, dc, power, 2)
                            return

        # Иначе — строит шахту или станцию
        options_mine = [(r, c) for r in range(self.size) for c in range(self.size) if self.can_build_mine(r, c, 2)]
        if options_mine:
            r, c = random.choice(options_mine)
            self.grid[r][c] = self.players[2]['mi']
            return

        options_st = [(r, c) for r in range(self.size) for c in range(self.size) if self.can_build_station(r, c, 2)]
        if options_st:
            r, c = min(options_st, key=lambda x: (x[0]-4.5)**2 + (x[1]-4.5)**2)
            self.grid[r][c] = self.players[2]['st']
            return

    def play(self):
        while any(cell == '.' for row in self.grid for cell in row):
            self.draw()
            if self.vs_ai and self.turn == 2:
                self.ai_turn()
                self.turn = 1
                continue

            power = self.get_line_power(self.turn)
            print("\nДействия: 1 r c (Станция), 2 r c (Шахта), 3 r c d (Выстрел: 0-Вверх, 1-Вниз, 2-Влево, 3-Вправо)")
            
            try:
                inp = input(">> ").split()
                if not inp: continue
                cmd = int(inp[0])
                r, c = int(inp[1]), int(inp[2])
                
                success = False
                if cmd == 1 and self.can_build_station(r, c, self.turn):
                    self.grid[r][c] = self.players[self.turn]['st']
                    success = True
                elif cmd == 2 and self.can_build_mine(r, c, self.turn):
                    self.grid[r][c] = self.players[self.turn]['mi']
                    success = True
                elif cmd == 3:
                    if power < 2:
                        print("ОШИБКА: Мощность лазера меньше 2! Стрелять нельзя.")
                        input("Нажми Enter...")
                        continue
                    d = int(inp[3])
                    dr, dc = [(-1,0), (1,0), (0,-1), (0,1)][d]
                    if self.shoot(r, c, dr, dc, power, self.turn) > 0:
                        success = True
                    else:
                        print("Промах! Станций врага не обнаружено.")
                        input("Нажми Enter...")
                
                if success: self.turn = 3 - self.turn
            except: continue

        self.draw()
        p1 = sum(row.count('○') for row in self.grid)
        p2 = sum(row.count('△') for row in self.grid)
        print(f"\nИТОГ: Игрок 1: {p1}, Игрок 2: {p2}")
        if p1 > p2: print("ПОБЕДА КОРПОРАЦИИ 'КРУГ'!")
        elif p2 > p1: print("ПОБЕДА КОРПОРАЦИИ 'ТРЕУГОЛЬНИК'!")
        else: print("НИЧЬЯ!")

if __name__ == "__main__":
    mode = input("Играть против ИИ? (y/n): ").lower()
    MarsMiners(vs_ai=(mode == 'y')).play()