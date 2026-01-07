import wx
import random
import time

# Game Constants (Defaults)
SYMBOL_FONT_SIZE = 32
CELL_TOP_OFFSET = 12
SIDEBAR_WIDTH = 220

class MarsMinersGame:
    """Core Game Logic adapted for GUI"""
    def __init__(self, roles, grid_size=10, weapon_req=4, allow_skip=True, ai_wait=0):
        self.size = grid_size
        self.grid = [['.' for _ in range(self.size)] for _ in range(self.size)]
        self.roles = roles
        self.weapon_req = weapon_req
        self.allow_skip = allow_skip
        self.ai_wait = ai_wait
        self.player_lost = {1: False, 2: False, 3: False, 4: False}

        # Dynamic starting positions based on grid size
        self.players = {
            1: {'st': '↑', 'mi': '○', 'name': 'P1', 'pos': (0, 0), 'color': wx.Colour(255, 100, 100)},
            2: {'st': '↓', 'mi': '△', 'name': 'P2', 'pos': (self.size - 1, self.size - 1), 'color': wx.Colour(100, 255, 100)},
            3: {'st': '←', 'mi': '□', 'name': 'P3', 'pos': (0, self.size - 1), 'color': wx.Colour(100, 100, 255)},
            4: {'st': '→', 'mi': '◇', 'name': 'P4', 'pos': (self.size - 1, 0), 'color': wx.Colour(255, 200, 50)}
        }

        # Initialize starting positions
        for p_id, role in self.roles.items():
            r, c = self.players[p_id]['pos']
            if role != 'none':
                self.grid[r][c] = self.players[p_id]['st']
            else:
                self.grid[r][c] = 'X'
                self.player_lost[p_id] = True

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

    def can_player_move(self, p):
        if self.player_lost[p]:
            return False

        for r in range(self.size):
            for c in range(self.size):
                if self.can_build(r, c, p):
                    return True

        if self.get_line_power(p) >= self.weapon_req:
            for r in range(self.size):
                for c in range(self.size):
                    cell = self.grid[r][c]
                    if cell != '.' and cell != '█':
                        return True
        return False

    def can_build(self, r, c, p):
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
        if self.grid[r][c] != '.' and self.grid[r][c] != '█':
            self.grid[r][c] = '█'
            return True
        return False

    def next_turn(self):
        players_able_to_move = 0
        for p_id in range(1, 5):
            if self.roles[p_id] != 'none' and not self.player_lost[p_id]:
                if not self.can_player_move(p_id):
                    self.player_lost[p_id] = True
                else:
                    players_able_to_move += 1

        if players_able_to_move == 0:
            self.game_over = True
            return

        start_turn = self.turn
        self.turn = self.turn % 4 + 1
        while self.roles[self.turn] == 'none' or self.player_lost[self.turn]:
            self.turn = self.turn % 4 + 1
            if self.turn == start_turn:
                self.game_over = True
                break

class RoleDialog(wx.Dialog):
    """Dialog to select player roles, map size, and game rules"""
    def __init__(self, parent):
        super().__init__(parent, title="Mars Expedition Setup", size=(350, 650))
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

        # Map Size Selection
        main_sizer.Add(wx.StaticText(self, label="Map Size:"), 0, wx.LEFT, 15)
        self.map_size_choice = wx.Choice(self, choices=["10 x 10", "15 x 15", "20 x 20"])
        self.map_size_choice.SetSelection(0)
        main_sizer.Add(self.map_size_choice, 0, wx.EXPAND | wx.ALL, 15)

        # Weapon requirement selection
        main_sizer.Add(wx.StaticText(self, label="Weapon Requirement (Line Length):"), 0, wx.LEFT, 15)
        req_options = [f"{i} Stations" for i in range(3, 11)]
        self.weapon_req_choice = wx.Choice(self, choices=req_options)
        self.weapon_req_choice.SetSelection(1)
        main_sizer.Add(self.weapon_req_choice, 0, wx.EXPAND | wx.ALL, 15)

        # AI Wait Time Selection
        main_sizer.Add(wx.StaticText(self, label="AI Turn Wait Time:"), 0, wx.LEFT, 15)
        self.ai_wait_choice = wx.Choice(self, choices=["ASAP (0ms)", "Fast (500ms)", "Medium (1000ms)", "Slow (2000ms)"])
        self.ai_wait_choice.SetSelection(0)
        main_sizer.Add(self.ai_wait_choice, 0, wx.EXPAND | wx.ALL, 15)

        # Skip option toggle
        self.skip_checkbox = wx.CheckBox(self, label="Allow manual Turn Skip")
        self.skip_checkbox.SetValue(True)
        main_sizer.Add(self.skip_checkbox, 0, wx.EXPAND | wx.ALL, 15)

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

    def GetMapSize(self):
        sizes = [10, 15, 20]
        return sizes[self.map_size_choice.GetSelection()]

    def GetWeaponReq(self):
        return self.weapon_req_choice.GetSelection() + 3

    def GetAiWait(self):
        times = [0, 500, 1000, 2000]
        return times[self.ai_wait_choice.GetSelection()]

    def GetAllowSkip(self):
        return self.skip_checkbox.GetValue()

class GamePanel(wx.Panel):
    def __init__(self, parent, game):
        super().__init__(parent)
        self.game = game
        self.cell_size = 50 if self.game.size == 10 else (40 if self.game.size == 15 else 30)
        self.SetBackgroundStyle(wx.BG_STYLE_PAINT)
        self.Bind(wx.EVT_PAINT, self.OnPaint)
        self.Bind(wx.EVT_LEFT_DOWN, self.OnMouseClick)

        self.timer = wx.Timer(self)
        self.Bind(wx.EVT_TIMER, self.OnTimer, self.timer)
        self.timer.Start(self.game.ai_wait if self.game.ai_wait > 0 else 50)

    def OnPaint(self, event):
        dc = wx.AutoBufferedPaintDC(self)
        dc.Clear()

        dc.SetPen(wx.Pen(wx.Colour(50, 50, 50), 1))
        for r in range(self.game.size):
            for c in range(self.game.size):
                x, y = c * self.cell_size, r * self.cell_size
                dc.SetBrush(wx.Brush(wx.Colour(30, 30, 30)))
                dc.DrawRectangle(x, y, self.cell_size, self.cell_size)

                cell = self.game.grid[r][c]
                if cell != '.':
                    self.draw_cell_content(dc, r, c, cell)

    def draw_cell_content(self, dc, r, c, cell):
        x, y = c * self.cell_size, r * self.cell_size
        # Adjust font size for larger grids
        f_size = SYMBOL_FONT_SIZE if self.game.size == 10 else (24 if self.game.size == 15 else 18)
        font = wx.Font(f_size, wx.FONTFAMILY_DEFAULT, wx.FONTSTYLE_NORMAL, wx.FONTWEIGHT_BOLD)
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
        cx = x + (self.cell_size - tw) / 2
        cy = y + (self.cell_size - th) / 2 # Center vertically as well for variable cell sizes
        dc.DrawText(cell, int(cx), int(cy))

    def OnMouseClick(self, event):
        if self.game.roles.get(self.game.turn) != 'human' or self.game.game_over:
            return

        x, y = event.GetPosition()
        c, r = x // self.cell_size, y // self.cell_size

        if 0 <= r < self.game.size and 0 <= c < self.game.size:
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
            for r in range(self.game.size):
                for c in range(self.game.size):
                    is_enemy_st = any(self.game.grid[r][c] == pd['st'] for pid, pd in self.game.players.items() if pid != p)
                    if is_enemy_st:
                        if self.game.shoot_laser(r, c, power=power):
                            return

        stations = [(r,c) for r in range(self.game.size) for c in range(self.game.size) if self.game.grid[r][c] == self.game.players[p]['st']]
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
    def __init__(self, roles, grid_size, weapon_req, allow_skip, ai_wait):
        super().__init__(None, title="Mars Miners: GUI Edition")
        self.start_new_game(roles, grid_size, weapon_req, allow_skip, ai_wait)

    def start_new_game(self, roles, grid_size, weapon_req, allow_skip, ai_wait):
        self.game = MarsMinersGame(roles, grid_size, weapon_req, allow_skip, ai_wait)
        self.DestroyChildren()

        panel = wx.Panel(self)
        main_sizer = wx.BoxSizer(wx.HORIZONTAL)

        self.game_panel = GamePanel(panel, self.game)
        grid_pixel_size = self.game.size * self.game_panel.cell_size
        self.game_panel.SetMinSize((grid_pixel_size, grid_pixel_size))

        sidebar = wx.BoxSizer(wx.VERTICAL)
        sidebar.SetMinSize((SIDEBAR_WIDTH, -1))

        self.status_label = wx.StaticText(panel, label="Initializing...")
        self.score_labels = []

        sidebar.Add(wx.StaticText(panel, label="--- EXPEDITION LOG ---"), 0, wx.ALL, 10)
        sidebar.Add(self.status_label, 0, wx.ALL, 10)

        self.btn_skip = wx.Button(panel, label="Skip Turn")
        self.btn_skip.Bind(wx.EVT_BUTTON, self.OnSkipTurn)
        sidebar.Add(self.btn_skip, 0, wx.ALL | wx.EXPAND, 10)

        if not allow_skip:
            self.btn_skip.Hide()

        sidebar.Add(wx.StaticLine(panel), 0, wx.EXPAND | wx.ALL, 5)

        for i in range(1, 5):
            if roles[i] != 'none':
                lbl = wx.StaticText(panel, label=f"P{i}: ACTIVE")
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

        # Adjust frame size to fit grid + sidebar
        self.SetClientSize((grid_pixel_size + SIDEBAR_WIDTH + 40, grid_pixel_size + 20))
        self.Layout()
        self.Centre()
        self.Show()

    def OnSkipTurn(self, event):
        if self.game.game_over:
            return
        if self.game.roles.get(self.game.turn) == 'human':
            self.game.next_turn()
            self.game_panel.Refresh()
            self.UpdateStatus()

    def OnNewGameRequest(self, event):
        msg = "Are you sure you want to abandon the current mission and start over?"
        dlg = wx.MessageDialog(self, msg, "Abandon Mission", wx.YES_NO | wx.NO_DEFAULT | wx.ICON_QUESTION)

        if dlg.ShowModal() == wx.ID_YES:
            role_dlg = RoleDialog(self)
            if role_dlg.ShowModal() == wx.ID_OK:
                new_roles = role_dlg.GetRoles()
                new_size = role_dlg.GetMapSize()
                new_req = role_dlg.GetWeaponReq()
                new_wait = role_dlg.GetAiWait()
                new_skip = role_dlg.GetAllowSkip()
                role_dlg.Destroy()
                self.start_new_game(new_roles, new_size, new_req, new_skip, new_wait)
            else:
                role_dlg.Destroy()
        dlg.Destroy()

    def UpdateStatus(self):
        if self.game.game_over:
            scores = self.game.get_scores()
            if not scores:
                self.status_label.SetLabel("MISSION FAILED\nALL ELIMINATED")
            else:
                winner_id = max(scores, key=scores.get)
                self.status_label.SetLabel(f"MISSION COMPLETE!\nWINNER: {self.game.players[winner_id]['name']}")
            self.btn_skip.Disable()
        else:
            p_data = self.game.players.get(self.game.turn)
            if p_data:
                power = self.game.get_line_power(self.game.turn)
                req = self.game.weapon_req
                charge = f"READY ({power})" if power >= req else f"CHARGING ({power}/{req})"
                self.status_label.SetLabel(f"TURN: {p_data['name']}\nLASER: {charge}")

            if self.game.roles.get(self.game.turn) == 'human':
                self.btn_skip.Enable()
            else:
                self.btn_skip.Disable()

        scores = self.game.get_scores()
        for p_id, lbl in self.score_labels:
            if self.game.player_lost[p_id]:
                lbl.SetLabel(f"{self.game.players[p_id]['name']}: LOST (Mines: {scores.get(p_id, 0)})")
                lbl.SetForegroundColour(wx.Colour(150, 150, 150))
            else:
                lbl.SetLabel(f"{self.game.players[p_id]['name']}: {scores.get(p_id, 0)} Mines")

if __name__ == "__main__":
    app = wx.App()
    dlg = RoleDialog(None)
    if dlg.ShowModal() == wx.ID_OK:
        roles = dlg.GetRoles()
        size = dlg.GetMapSize()
        req = dlg.GetWeaponReq()
        wait = dlg.GetAiWait()
        skip = dlg.GetAllowSkip()
        dlg.Destroy()
        MainFrame(roles, size, req, skip, wait)
        app.MainLoop()
    else:
        dlg.Destroy()
