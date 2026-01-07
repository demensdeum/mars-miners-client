import wx
import random
import time

# Game Constants
GRID_SIZE = 10
CELL_SIZE = 50
WINDOW_WIDTH = 750
WINDOW_HEIGHT = 550

class MarsMinersGame:
    """Core Game Logic adapted for GUI"""
    def __init__(self, roles):
        self.size = GRID_SIZE
        self.grid = [['.' for _ in range(self.size)] for _ in range(self.size)]
        self.roles = roles
        self.players = {
            1: {'st': '↑', 'mi': '○', 'name': 'P1', 'pos': (0,0), 'color': wx.Colour(255, 100, 100)},
            2: {'st': '↓', 'mi': '△', 'name': 'P2', 'pos': (9,9), 'color': wx.Colour(100, 255, 100)},
            3: {'st': '←', 'mi': '□', 'name': 'P3', 'pos': (0,9), 'color': wx.Colour(100, 100, 255)},
            4: {'st': '→', 'mi': '◇', 'name': 'P4', 'pos': (9,0), 'color': wx.Colour(255, 200, 50)}
        }

        # Initialize starting positions
        for p_id, role in self.roles.items():
            r, c = self.players[p_id]['pos']
            if role != 'none':
                self.grid[r][c] = self.players[p_id]['st']
            else:
                self.grid[r][c] = 'X'

        # Find the first active player
        self.turn = 1
        while self.roles.get(self.turn) == 'none' and self.turn < 4:
            self.turn += 1

        self.game_over = False

    def get_scores(self):
        return {p: sum(row.count(self.players[p]['mi']) for row in self.grid)
                for p in self.players if self.roles.get(p) != 'none'}

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

    def destroy_line(self, r, c, vertical=False):
        """Logic to destroy a line of enemy stations"""
        target_st = self.grid[r][c]
        # Check if it's an enemy station
        is_enemy_st = any(target_st == p['st'] for pid, p in self.players.items() if pid != self.turn)
        if not is_enemy_st:
            return False

        to_destroy = [(r, c)]
        if vertical:
            # Check up
            curr_r = r - 1
            while curr_r >= 0 and self.grid[curr_r][c] == target_st:
                to_destroy.append((curr_r, c))
                curr_r -= 1
            # Check down
            curr_r = r + 1
            while curr_r < self.size and self.grid[curr_r][c] == target_st:
                to_destroy.append((curr_r, c))
                curr_r += 1
        else:
            # Check left
            curr_c = c - 1
            while curr_c >= 0 and self.grid[r][curr_c] == target_st:
                to_destroy.append((r, curr_c))
                curr_c -= 1
            # Check right
            curr_c = c + 1
            while curr_c < self.size and self.grid[r][curr_c] == target_st:
                to_destroy.append((r, curr_c))
                curr_c += 1

        if len(to_destroy) > 1:
            for dr, dc in to_destroy:
                self.grid[dr][dc] = '█'
            return True
        return False

    def next_turn(self):
        if not any('.' in row for row in self.grid):
            self.game_over = True
            return

        start_turn = self.turn
        self.turn = self.turn % 4 + 1
        while self.roles[self.turn] == 'none':
            self.turn = self.turn % 4 + 1
            if self.turn == start_turn: # All players none
                self.game_over = True
                break

class RoleDialog(wx.Dialog):
    """Dialog to select player roles at the start"""
    def __init__(self, parent):
        super().__init__(parent, title="Mars Expedition Setup", size=(300, 400))
        self.roles = {}

        main_sizer = wx.BoxSizer(wx.VERTICAL)
        main_sizer.Add(wx.StaticText(self, label="Assign Roles for Players:"), 0, wx.ALL | wx.CENTER, 10)

        self.choices = []
        role_options = ["Human", "AI", "None"]

        for i in range(1, 5):
            hbox = wx.BoxSizer(wx.HORIZONTAL)
            hbox.Add(wx.StaticText(self, label=f"Player {i}: "), 0, wx.ALIGN_CENTER_VERTICAL | wx.ALL, 5)
            choice = wx.Choice(self, choices=role_options)
            choice.SetSelection(0 if i == 1 else 1) # P1 Human, others AI by default
            hbox.Add(choice, 1, wx.EXPAND | wx.ALL, 5)
            self.choices.append(choice)
            main_sizer.Add(hbox, 0, wx.EXPAND | wx.LEFT | wx.RIGHT, 10)

        btn_sizer = wx.StdDialogButtonSizer()
        start_btn = wx.Button(self, wx.ID_OK, label="Start Mission")
        btn_sizer.AddButton(start_btn)
        btn_sizer.Realize()

        main_sizer.AddStretchSpacer()
        main_sizer.Add(btn_sizer, 0, wx.ALL | wx.CENTER, 15)
        self.SetSizer(main_sizer)

    def GetRoles(self):
        mapping = {0: 'human', 1: 'ai', 2: 'none'}
        return {i+1: mapping[self.choices[i].GetSelection()] for i in range(4)}

class GamePanel(wx.Panel):
    def __init__(self, parent, game):
        super().__init__(parent)
        self.game = game
        self.SetBackgroundStyle(wx.BG_STYLE_PAINT)
        self.Bind(wx.EVT_PAINT, self.OnPaint)
        self.Bind(wx.EVT_LEFT_DOWN, self.OnMouseClick)
        self.Bind(wx.EVT_RIGHT_DOWN, self.OnRightClick)

        # AI Timer
        self.timer = wx.Timer(self)
        self.Bind(wx.EVT_TIMER, self.OnTimer, self.timer)
        self.timer.Start(500)

    def OnPaint(self, event):
        dc = wx.AutoBufferedPaintDC(self)
        dc.Clear()

        # Draw Grid
        dc.SetPen(wx.Pen(wx.Colour(50, 50, 50), 1))
        for r in range(GRID_SIZE):
            for c in range(GRID_SIZE):
                x, y = c * CELL_SIZE, r * CELL_SIZE

                # Background
                dc.SetBrush(wx.Brush(wx.Colour(30, 30, 30)))
                dc.DrawRectangle(x, y, CELL_SIZE, CELL_SIZE)

                # Content
                cell = self.game.grid[r][c]
                if cell != '.':
                    self.draw_cell_content(dc, r, c, cell)

    def draw_cell_content(self, dc, r, c, cell):
        x, y = c * CELL_SIZE, r * CELL_SIZE
        font = wx.Font(16, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD)
        dc.SetFont(font)

        # Determine Color
        color = wx.WHITE
        for p_id, p_data in self.game.players.items():
            if cell in p_data.values():
                color = p_data['color']
                break

        if cell == '█': color = wx.Colour(100, 100, 100)
        if cell == 'X': color = wx.RED

        dc.SetTextForeground(color)

        # Center text in cell
        tw, th = dc.GetTextExtent(cell)
        dc.DrawText(cell, x + (CELL_SIZE - tw)//2, y + (CELL_SIZE - th)//2)

    def OnMouseClick(self, event):
        if self.game.roles.get(self.game.turn) != 'human' or self.game.game_over:
            return

        x, y = event.GetPosition()
        c, r = x // CELL_SIZE, y // CELL_SIZE

        if 0 <= r < GRID_SIZE and 0 <= c < GRID_SIZE:
            is_shift = wx.GetKeyState(wx.WXK_SHIFT)
            cell = self.game.grid[r][c]

            # 1. Logic for attacking enemy stations
            if any(cell == p['st'] for pid, p in self.game.players.items() if pid != self.game.turn):
                if self.game.destroy_line(r, c, vertical=is_shift):
                    self.game.next_turn()

            # 2. Logic for building (only if cell is empty)
            elif cell == '.':
                if is_shift:
                    if self.game.can_build(r, c, self.game.turn, True):
                        self.game.grid[r][c] = self.game.players[self.game.turn]['mi']
                        self.game.next_turn()
                else:
                    if self.game.can_build(r, c, self.game.turn):
                        self.game.grid[r][c] = self.game.players[self.game.turn]['st']
                        self.game.next_turn()

            self.Refresh()
            top_level = wx.GetTopLevelParent(self)
            if hasattr(top_level, "UpdateStatus"):
                top_level.UpdateStatus()

    def OnRightClick(self, event):
        """Right click to fire laser (if charged)"""
        if self.game.roles.get(self.game.turn) != 'human' or self.game.game_over:
            return

        power = self.game.get_line_power(self.game.turn)
        if power < 2: return

        x, y = event.GetPosition()
        c, r = x // CELL_SIZE, y // CELL_SIZE

        # Simplistic laser logic
        for d in range(4):
            if self.game.shoot(r, c, d, power):
                self.game.next_turn()
                break

        self.Refresh()
        top_level = wx.GetTopLevelParent(self)
        if hasattr(top_level, "UpdateStatus"):
            top_level.UpdateStatus()

    def OnTimer(self, event):
        if self.game.game_over:
            return

        if self.game.roles.get(self.game.turn) == 'ai':
            self.ai_move()
            self.game.next_turn()
            self.Refresh()
            top_level = wx.GetTopLevelParent(self)
            if hasattr(top_level, "UpdateStatus"):
                top_level.UpdateStatus()

    def ai_move(self):
        p = self.game.turn
        power = self.game.get_line_power(p)

        if power >= 2:
            for r in range(GRID_SIZE):
                for c in range(GRID_SIZE):
                    for d in range(4):
                        if self.game.shoot(r, c, d, power): return

        mines = [(r,c) for r in range(GRID_SIZE) for c in range(GRID_SIZE) if self.game.can_build(r, c, p, True)]
        if mines:
            r, c = random.choice(mines)
            self.game.grid[r][c] = self.game.players[p]['mi']
            return

        stations = [(r,c) for r in range(GRID_SIZE) for c in range(GRID_SIZE) if self.game.can_build(r, c, p)]
        if stations:
            r, c = min(stations, key=lambda x: (x[0]-4.5)**2 + (x[1]-4.5)**2)
            self.game.grid[r][c] = self.game.players[p]['st']

class MainFrame(wx.Frame):
    def __init__(self, roles):
        super().__init__(None, title="Mars Miners: GUI Edition", size=(WINDOW_WIDTH, WINDOW_HEIGHT))

        self.game = MarsMinersGame(roles)

        panel = wx.Panel(self)
        main_sizer = wx.BoxSizer(wx.HORIZONTAL)

        self.game_panel = GamePanel(panel, self.game)
        self.game_panel.SetMinSize((GRID_SIZE * CELL_SIZE, GRID_SIZE * CELL_SIZE))

        sidebar = wx.BoxSizer(wx.VERTICAL)
        sidebar.SetMinSize((200, -1))

        self.status_label = wx.StaticText(panel, label="Initializing...")
        self.score_labels = []

        sidebar.Add(wx.StaticText(panel, label="--- EXPEDITION LOG ---"), 0, wx.ALL, 10)
        sidebar.Add(self.status_label, 0, wx.ALL, 10)
        sidebar.Add(wx.StaticLine(panel), 0, wx.EXPAND | wx.ALL, 5)

        for i in range(1, 5):
            if roles[i] != 'none':
                lbl = wx.StaticText(panel, label=f"P{i}: 0")
                lbl.SetForegroundColour(self.game.players[i]['color'])
                self.score_labels.append((i, lbl))
                sidebar.Add(lbl, 0, wx.LEFT | wx.RIGHT | wx.TOP, 5)

        sidebar.AddStretchSpacer()
        sidebar.Add(wx.StaticText(panel, label="L-Click: Station"), 0, wx.ALL, 5)
        sidebar.Add(wx.StaticText(panel, label="Shift+L: Mine"), 0, wx.ALL, 5)
        sidebar.Add(wx.StaticText(panel, label="R-Click: Laser"), 0, wx.ALL, 5)

        main_sizer.Add(self.game_panel, 1, wx.EXPAND | wx.ALL, 10)
        main_sizer.Add(sidebar, 0, wx.EXPAND | wx.ALL, 10)

        panel.SetSizer(main_sizer)
        self.UpdateStatus()
        self.Centre()
        self.Show()

    def UpdateStatus(self):
        if self.game.game_over:
            self.status_label.SetLabel("MISSION COMPLETE!")
        else:
            p_data = self.game.players.get(self.game.turn)
            if p_data:
                power = self.game.get_line_power(self.game.turn)
                charge = "READY" if power >= 2 else "CHARGING"
                self.status_label.SetLabel(f"TURN: {p_data['name']}\nLASER: {charge}")

        scores = self.game.get_scores()
        for p_id, lbl in self.score_labels:
            lbl.SetLabel(f"{self.game.players[p_id]['name']}: {scores.get(p_id, 0)} (Mines)")

if __name__ == "__main__":
    app = wx.App()

    # Show Role Selection Dialog before starting main frame
    dlg = RoleDialog(None)
    if dlg.ShowModal() == wx.ID_OK:
        roles = dlg.GetRoles()
        dlg.Destroy()
        MainFrame(roles)
        app.MainLoop()
    else:
        dlg.Destroy()
