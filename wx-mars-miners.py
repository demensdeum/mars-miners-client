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
    def __init__(self, roles, weapon_req=4):
        self.size = GRID_SIZE
        self.grid = [['.' for _ in range(self.size)] for _ in range(self.size)]
        self.roles = roles
        self.weapon_req = weapon_req  # New dynamic requirement
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

    def can_build(self, r, c, p):
        """Building (Station or Mine) MUST be near a Station of the same player"""
        if not (0 <= r < self.size and 0 <= c < self.size) or self.grid[r][c] != '.':
            return False

        adj = [(-1,0), (1,0), (0,-1), (0,1)]
        target_station = self.players[p]['st']

        for dr, dc in adj:
            nr, nc = r + dr, c + dc
            if 0 <= nr < self.size and 0 <= nc < self.size:
                if self.grid[nr][nc] == target_station:
                    return True
        return False

    def shoot_laser(self, r, c, power):
        """Fires a precision laser. Destroys the single targeted cell if power is sufficient."""
        if self.grid[r][c] != '.' and self.grid[r][c] != '█':
            self.grid[r][c] = '█'
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
            if self.turn == start_turn:
                self.game_over = True
                break

class RoleDialog(wx.Dialog):
    """Dialog to select player roles and game rules at the start"""
    def __init__(self, parent):
        super().__init__(parent, title="Mars Expedition Setup", size=(320, 480))
        self.roles = {}

        main_sizer = wx.BoxSizer(wx.VERTICAL)
        main_sizer.Add(wx.StaticText(self, label="Assign Roles for Players:"), 0, wx.ALL | wx.CENTER, 10)

        self.choices = []
        role_options = ["Human", "AI", "None"]

        for i in range(1, 5):
            hbox = wx.BoxSizer(wx.HORIZONTAL)
            hbox.Add(wx.StaticText(self, label=f"Player {i}: "), 0, wx.ALIGN_CENTER_VERTICAL | wx.ALL, 5)
            choice = wx.Choice(self, choices=role_options)
            choice.SetSelection(0 if i == 1 else 1)
            hbox.Add(choice, 1, wx.EXPAND | wx.ALL, 5)
            self.choices.append(choice)
            main_sizer.Add(hbox, 0, wx.EXPAND | wx.LEFT | wx.RIGHT, 10)

        main_sizer.Add(wx.StaticLine(self), 0, wx.EXPAND | wx.ALL, 10)

        # Weapon requirement selection
        main_sizer.Add(wx.StaticText(self, label="Weapon Requirement (Line Length):"), 0, wx.LEFT, 15)
        self.weapon_req_choice = wx.Choice(self, choices=["3 Stations", "4 Stations"])
        self.weapon_req_choice.SetSelection(1) # Default to 4
        main_sizer.Add(self.weapon_req_choice, 0, wx.EXPAND | wx.ALL, 15)

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

    def GetWeaponReq(self):
        return 3 if self.weapon_req_choice.GetSelection() == 0 else 4

class GamePanel(wx.Panel):
    def __init__(self, parent, game):
        super().__init__(parent)
        self.game = game
        self.SetBackgroundStyle(wx.BG_STYLE_PAINT)
        self.Bind(wx.EVT_PAINT, self.OnPaint)
        self.Bind(wx.EVT_LEFT_DOWN, self.OnMouseClick)

        self.timer = wx.Timer(self)
        self.Bind(wx.EVT_TIMER, self.OnTimer, self.timer)
        self.timer.Start(500)

    def OnPaint(self, event):
        dc = wx.AutoBufferedPaintDC(self)
        dc.Clear()

        dc.SetPen(wx.Pen(wx.Colour(50, 50, 50), 1))
        for r in range(GRID_SIZE):
            for c in range(GRID_SIZE):
                x, y = c * CELL_SIZE, r * CELL_SIZE
                dc.SetBrush(wx.Brush(wx.Colour(30, 30, 30)))
                dc.DrawRectangle(x, y, CELL_SIZE, CELL_SIZE)

                cell = self.game.grid[r][c]
                if cell != '.':
                    self.draw_cell_content(dc, r, c, cell)

    def draw_cell_content(self, dc, r, c, cell):
        x, y = c * CELL_SIZE, r * CELL_SIZE
        font = wx.Font(16, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD)
        dc.SetFont(font)

        color = wx.WHITE
        for p_id, p_data in self.game.players.items():
            if cell in p_data.values():
                color = p_data['color']
                break

        if cell == '█': color = wx.Colour(100, 100, 100)
        if cell == 'X': color = wx.RED

        dc.SetTextForeground(color)
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

            enemy_id = None
            for pid, p_data in self.game.players.items():
                if cell == p_data['st'] and pid != self.game.turn:
                    enemy_id = pid
                    break

            if enemy_id:
                power = self.game.get_line_power(self.game.turn)
                if power >= self.game.weapon_req:
                    if self.game.shoot_laser(r, c, power=power):
                        self.game.next_turn()

            elif cell == '.':
                if self.game.can_build(r, c, self.game.turn):
                    if is_shift:
                        self.game.grid[r][c] = self.game.players[self.game.turn]['mi']
                    else:
                        self.game.grid[r][c] = self.game.players[self.game.turn]['st']
                    self.game.next_turn()

            self.Refresh()
            top_level = wx.GetTopLevelParent(self)
            if hasattr(top_level, "UpdateStatus"):
                top_level.UpdateStatus()

    def OnTimer(self, event):
        if self.game.game_over: return

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

        if power >= self.game.weapon_req:
            for r in range(GRID_SIZE):
                for c in range(GRID_SIZE):
                    is_enemy_st = any(self.game.grid[r][c] == pd['st'] for pid, pd in self.game.players.items() if pid != p)
                    if is_enemy_st:
                        if self.game.shoot_laser(r, c, power=power):
                            return

        stations = [(r,c) for r in range(GRID_SIZE) for c in range(GRID_SIZE) if self.game.grid[r][c] == self.game.players[p]['st']]
        build_targets = []
        for r_s, c_s in stations:
            for dr, dc in [(-1,0), (1,0), (0,-1), (0,1)]:
                nr, nc = r_s + dr, c_s + dc
                if self.game.can_build(nr, nc, p):
                    build_targets.append((nr, nc))

        if build_targets:
            r, c = random.choice(build_targets)
            if random.random() < 0.3:
                self.game.grid[r][c] = self.game.players[p]['mi']
            else:
                self.game.grid[r][c] = self.game.players[p]['st']

class MainFrame(wx.Frame):
    def __init__(self, roles, weapon_req):
        super().__init__(None, title="Mars Miners: GUI Edition", size=(WINDOW_WIDTH, WINDOW_HEIGHT))
        self.start_new_game(roles, weapon_req)

    def start_new_game(self, roles, weapon_req):
        self.game = MarsMinersGame(roles, weapon_req)
        self.DestroyChildren()

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

        btn_new_game = wx.Button(panel, label="New Game")
        btn_new_game.Bind(wx.EVT_BUTTON, self.OnNewGameRequest)
        sidebar.Add(btn_new_game, 0, wx.ALL | wx.EXPAND, 10)

        sidebar.Add(wx.StaticLine(panel), 0, wx.EXPAND | wx.ALL, 5)
        sidebar.Add(wx.StaticText(panel, label="L-Click: Station"), 0, wx.ALL, 2)
        sidebar.Add(wx.StaticText(panel, label="Shift+L: Mine"), 0, wx.ALL, 2)
        sidebar.Add(wx.StaticLine(panel), 0, wx.EXPAND | wx.ALL, 5)
        sidebar.Add(wx.StaticText(panel, label="Attack Enemy:"), 0, wx.ALL, 2)
        sidebar.Add(wx.StaticText(panel, label="L-Click enemy station"), 0, wx.ALL, 2)
        self.req_help_label = wx.StaticText(panel, label=f"(Requires {weapon_req}+ Stations)")
        sidebar.Add(self.req_help_label, 0, wx.ALL, 2)

        main_sizer.Add(self.game_panel, 1, wx.EXPAND | wx.ALL, 10)
        main_sizer.Add(sidebar, 0, wx.EXPAND | wx.ALL, 10)

        panel.SetSizer(main_sizer)
        self.UpdateStatus()
        self.Layout()
        self.Centre()
        self.Show()

    def OnNewGameRequest(self, event):
        msg = "Are you sure you want to abandon the current mission and start over?"
        dlg = wx.MessageDialog(self, msg, "Abandon Mission", wx.YES_NO | wx.NO_DEFAULT | wx.ICON_QUESTION)

        if dlg.ShowModal() == wx.ID_YES:
            role_dlg = RoleDialog(self)
            if role_dlg.ShowModal() == wx.ID_OK:
                new_roles = role_dlg.GetRoles()
                new_req = role_dlg.GetWeaponReq()
                role_dlg.Destroy()
                self.start_new_game(new_roles, new_req)
            else:
                role_dlg.Destroy()
        dlg.Destroy()

    def UpdateStatus(self):
        if self.game.game_over:
            self.status_label.SetLabel("MISSION COMPLETE!")
        else:
            p_data = self.game.players.get(self.game.turn)
            if p_data:
                power = self.game.get_line_power(self.game.turn)
                req = self.game.weapon_req
                charge = f"READY ({power})" if power >= req else f"CHARGING ({power}/{req})"
                self.status_label.SetLabel(f"TURN: {p_data['name']}\nLASER: {charge}")

        scores = self.game.get_scores()
        for p_id, lbl in self.score_labels:
            lbl.SetLabel(f"{self.game.players[p_id]['name']}: {scores.get(p_id, 0)} (Mines)")

if __name__ == "__main__":
    app = wx.App()
    dlg = RoleDialog(None)
    if dlg.ShowModal() == wx.ID_OK:
        roles = dlg.GetRoles()
        req = dlg.GetWeaponReq()
        dlg.Destroy()
        MainFrame(roles, req)
        app.MainLoop()
    else:
        dlg.Destroy()
