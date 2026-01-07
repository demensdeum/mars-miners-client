import wx
import random
import time
import json

# Game Constants (Defaults)
SYMBOL_FONT_SIZE = 32
CELL_TOP_OFFSET = 12
SIDEBAR_WIDTH = 220

# Localization Dictionary
LOCALE = {
    'en': {
        'title': "Mars Miners: GUI Edition",
        'setup_title': "Mars Expedition Setup",
        'assign_roles': "Assign Roles for Players:",
        'player': "Player",
        'human': "Human",
        'ai': "AI",
        'none': "None",
        'map_size': "Map Size:",
        'weapon_req': "Weapon Req (Line Length):",
        'stations': "Stations",
        'ai_wait': "AI Turn Wait Time:",
        'asap': "ASAP (0ms)",
        'fast': "Fast (500ms)",
        'med': "Medium (1000ms)",
        'slow': "Slow (2000ms)",
        'allow_skip': "Allow manual Turn Skip",
        'start_btn': "Start Mission",
        'expedition_log': "--- EXPEDITION LOG ---",
        'initializing': "Initializing...",
        'skip_turn': "Skip Turn",
        'active': "ACTIVE",
        'lost': "LOST",
        'mines': "Mines",
        'storage': "--- STORAGE ---",
        'save': "Save Mission",
        'load': "Load Mission",
        'new_game': "New Game",
        'controls': "L-Click: Station\nShift+L: Mine",
        'attack_help': "Attack Enemy:\nL-Click enemy station",
        'requires': "Requires {n}+ Stations",
        'failed': "MISSION FAILED\nALL ELIMINATED",
        'winner': "MISSION COMPLETE!\nWINNER: {name}",
        'turn': "TURN: {name}",
        'ready': "READY ({n})",
        'charging': "CHARGING ({n}/{req})",
        'abandon_msg': "Are you sure you want to abandon the current mission and start over?",
        'abandon_title': "Abandon Mission",
        'lang_label': "Interface Language / Язык интерфейса:",
    },
    'ru': {
        'title': "Марсианские Шахтеры",
        'setup_title': "Настройка экспедиции",
        'assign_roles': "Назначьте роли игрокам:",
        'player': "Игрок",
        'human': "Человек",
        'ai': "ИИ",
        'none': "Нет",
        'map_size': "Размер карты:",
        'weapon_req': "Длина орудия:",
        'stations': "Станций",
        'ai_wait': "Задержка хода ИИ:",
        'asap': "Сразу (0мс)",
        'fast': "Быстро (500мс)",
        'med': "Средне (1000мс)",
        'slow': "Медленно (2000мс)",
        'allow_skip': "Разрешить пропуск хода",
        'start_btn': "Начать миссию",
        'expedition_log': "--- ЖУРНАЛ ЭКСПЕДИЦИИ ---",
        'initializing': "Инициализация...",
        'skip_turn': "Пропустить ход",
        'active': "АКТИВЕН",
        'lost': "ВЫБЫЛ",
        'mines': "Шахт",
        'storage': "--- ХРАНИЛИЩЕ ---",
        'save': "Сохранить",
        'load': "Загрузить",
        'new_game': "Новая игра",
        'controls': "ЛКМ: Станция\nShift+ЛКМ: Шахта",
        'attack_help': "Атака врага:\nЛКМ по вражеской станции",
        'requires': "Нужно {n}+ станций",
        'failed': "МИССИЯ ПРОВАЛЕНА\nВСЕ ПОГИБЛИ",
        'winner': "МИССИЯ ВЫПОЛНЕНА!\nПОБЕДИТЕЛЬ: {name}",
        'turn': "ХОД: {name}",
        'ready': "ГОТОВО ({n})",
        'charging': "ЗАРЯДКА ({n}/{req})",
        'abandon_msg': "Вы уверены, что хотите прервать текущую миссию и начать заново?",
        'abandon_title': "Прервать миссию",
        'lang_label': "Язык интерфейса / Interface Language:",
    }
}

class MarsMinersGame:
    """Core Game Logic adapted for GUI"""
    def __init__(self, roles, grid_size=10, weapon_req=4, allow_skip=True, ai_wait=0, lang='en'):
        self.size = grid_size
        self.grid = [['.' for _ in range(self.size)] for _ in range(self.size)]
        self.roles = roles
        self.weapon_req = weapon_req
        self.allow_skip = allow_skip
        self.ai_wait = ai_wait
        self.lang = lang
        self.player_lost = {1: False, 2: False, 3: False, 4: False}

        self.players = {
            1: {'st': '↑', 'mi': '○', 'name': 'P1', 'pos': (0, 0), 'color': wx.Colour(255, 100, 100)},
            2: {'st': '↓', 'mi': '△', 'name': 'P2', 'pos': (self.size - 1, self.size - 1), 'color': wx.Colour(100, 255, 100)},
            3: {'st': '←', 'mi': '□', 'name': 'P3', 'pos': (0, self.size - 1), 'color': wx.Colour(100, 100, 255)},
            4: {'st': '→', 'mi': '◇', 'name': 'P4', 'pos': (self.size - 1, 0), 'color': wx.Colour(255, 200, 50)}
        }

        for p_id, role in self.roles.items():
            r, c = self.players[p_id]['pos']
            if role != 'none':
                self.grid[r][c] = self.players[p_id]['st']
            else:
                self.grid[r][c] = 'X'
                self.player_lost[p_id] = True

        self.turn = 1
        while self.roles.get(self.turn) == 'none' and self.turn < 4:
            self.turn += 1

        self.game_over = False

    def t(self, key, **kwargs):
        """Helper to get translated text"""
        text = LOCALE.get(self.lang, LOCALE['en']).get(key, key)
        return text.format(**kwargs)

    def to_dict(self):
        return {
            "size": self.size,
            "grid": self.grid,
            "roles": {str(k): v for k, v in self.roles.items()},
            "weapon_req": self.weapon_req,
            "allow_skip": self.allow_skip,
            "ai_wait": self.ai_wait,
            "lang": self.lang,
            "turn": self.turn,
            "player_lost": {str(k): v for k, v in self.player_lost.items()},
            "game_over": self.game_over
        }

    def from_dict(self, data):
        self.size = data["size"]
        self.grid = data["grid"]
        self.roles = {int(k): v for k, v in data["roles"].items()}
        self.weapon_req = data["weapon_req"]
        self.allow_skip = data["allow_skip"]
        self.ai_wait = data["ai_wait"]
        self.lang = data.get("lang", "en")
        self.turn = data["turn"]
        self.player_lost = {int(k): v for k, v in data["player_lost"].items()}
        self.game_over = data["game_over"]
        self.players = {
            1: {'st': '↑', 'mi': '○', 'name': 'P1', 'pos': (0, 0), 'color': wx.Colour(255, 100, 100)},
            2: {'st': '↓', 'mi': '△', 'name': 'P2', 'pos': (self.size - 1, self.size - 1), 'color': wx.Colour(100, 255, 100)},
            3: {'st': '←', 'mi': '□', 'name': 'P3', 'pos': (0, self.size - 1), 'color': wx.Colour(100, 100, 255)},
            4: {'st': '→', 'mi': '◇', 'name': 'P4', 'pos': (self.size - 1, 0), 'color': wx.Colour(255, 200, 50)}
        }

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
        if self.player_lost[p]: return False
        for r in range(self.size):
            for c in range(self.size):
                if self.can_build(r, c, p): return True
        if self.get_line_power(p) >= self.weapon_req:
            for r in range(self.size):
                for c in range(self.size):
                    cell = self.grid[r][c]
                    if cell != '.' and cell != '█': return True
        return False

    def can_build(self, r, c, p):
        if not (0 <= r < self.size and 0 <= c < self.size) or self.grid[r][c] != '.':
            return False
        adj = [(-1,0), (1,0), (0,-1), (0,1)]
        target_station = self.players[p]['st']
        for dr, dc in adj:
            nr, nc = r + dr, c + dc
            if 0 <= nr < self.size and 0 <= nc < self.size:
                if self.grid[nr][nc] == target_station: return True
        return False

    def shoot_laser(self, r, c, power):
        if self.grid[r][c] != '.' and self.grid[r][c] != '█':
            self.grid[r][c] = '█'
            return True
        return False

    def next_turn(self):
        active = 0
        for p_id in range(1, 5):
            if self.roles[p_id] != 'none' and not self.player_lost[p_id]:
                if not self.can_player_move(p_id):
                    self.player_lost[p_id] = True
                else: active += 1
        if active == 0:
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
    def __init__(self, parent, current_lang='en'):
        self.lang = current_lang
        # Persistence for language switching
        self.cached_roles = None
        self.cached_size_idx = 0
        self.cached_weapon_idx = 1
        self.cached_wait_idx = 0
        self.cached_skip = True

        super().__init__(parent, title=self.t('setup_title'), size=(400, 720))
        self.Bind(wx.EVT_CLOSE, self.OnClose)
        self.init_ui()

    def t(self, key):
        return LOCALE[self.lang].get(key, key)

    def init_ui(self):
        if self.GetSizer():
            self.GetSizer().Clear(True)

        main_sizer = wx.BoxSizer(wx.VERTICAL)

        # Language Selector
        lang_panel = wx.Panel(self)
        lang_panel.SetBackgroundColour(wx.Colour(50, 50, 50))
        lang_inner_sizer = wx.BoxSizer(wx.HORIZONTAL)

        lang_label = wx.StaticText(lang_panel, label=self.t('lang_label'))
        lang_label.SetForegroundColour(wx.WHITE)
        lang_inner_sizer.Add(lang_label, 0, wx.ALL | wx.CENTER, 10)

        self.lang_choice = wx.Choice(lang_panel, choices=["English", "Русский"])
        self.lang_choice.SetSelection(0 if self.lang == 'en' else 1)
        self.lang_choice.Bind(wx.EVT_CHOICE, self.OnLangChange)
        lang_inner_sizer.Add(self.lang_choice, 1, wx.ALL | wx.CENTER, 10)

        lang_panel.SetSizer(lang_inner_sizer)
        main_sizer.Add(lang_panel, 0, wx.EXPAND | wx.BOTTOM, 10)

        # Assign Roles
        main_sizer.Add(wx.StaticText(self, label=self.t('assign_roles')), 0, wx.ALL | wx.CENTER, 5)

        self.role_choices = []
        role_opts = [self.t('human'), self.t('ai'), self.t('none')]

        for i in range(1, 5):
            hbox = wx.BoxSizer(wx.HORIZONTAL)
            hbox.Add(wx.StaticText(self, label=f"{self.t('player')} {i}: "), 0, wx.ALIGN_CENTER_VERTICAL | wx.ALL, 5)
            choice = wx.Choice(self, choices=role_opts)

            if self.cached_roles:
                role_val = self.cached_roles[i]
                mapping = {'human': 0, 'ai': 1, 'none': 2}
                choice.SetSelection(mapping.get(role_val, 0))
            else:
                choice.SetSelection(0 if i == 1 else 1)

            hbox.Add(choice, 1, wx.EXPAND | wx.ALL, 5)
            self.role_choices.append(choice)
            main_sizer.Add(hbox, 0, wx.EXPAND | wx.LEFT | wx.RIGHT, 10)

        main_sizer.Add(wx.StaticLine(self), 0, wx.EXPAND | wx.ALL, 10)

        # Parameters
        main_sizer.Add(wx.StaticText(self, label=self.t('map_size')), 0, wx.LEFT, 15)
        self.map_size_choice = wx.Choice(self, choices=["10 x 10", "15 x 15", "20 x 20"])
        self.map_size_choice.SetSelection(self.cached_size_idx)
        main_sizer.Add(self.map_size_choice, 0, wx.EXPAND | wx.ALL, 15)

        main_sizer.Add(wx.StaticText(self, label=self.t('weapon_req')), 0, wx.LEFT, 15)
        req_options = [f"{i} {self.t('stations')}" for i in range(3, 11)]
        self.weapon_req_choice = wx.Choice(self, choices=req_options)
        self.weapon_req_choice.SetSelection(self.cached_weapon_idx)
        main_sizer.Add(self.weapon_req_choice, 0, wx.EXPAND | wx.ALL, 15)

        main_sizer.Add(wx.StaticText(self, label=self.t('ai_wait')), 0, wx.LEFT, 15)
        self.ai_wait_choice = wx.Choice(self, choices=[self.t('asap'), self.t('fast'), self.t('med'), self.t('slow')])
        self.ai_wait_choice.SetSelection(self.cached_wait_idx)
        main_sizer.Add(self.ai_wait_choice, 0, wx.EXPAND | wx.ALL, 15)

        self.skip_checkbox = wx.CheckBox(self, label=self.t('allow_skip'))
        self.skip_checkbox.SetValue(self.cached_skip)
        main_sizer.Add(self.skip_checkbox, 0, wx.EXPAND | wx.ALL, 15)

        # Start Button
        btn_sizer = wx.StdDialogButtonSizer()
        self.start_btn = wx.Button(self, wx.ID_OK, label=self.t('start_btn'))
        btn_sizer.AddButton(self.start_btn)
        btn_sizer.Realize()

        main_sizer.AddStretchSpacer()
        main_sizer.Add(btn_sizer, 0, wx.ALL | wx.CENTER, 15)

        self.SetSizer(main_sizer)
        self.Layout()

    def OnLangChange(self, event):
        self.cached_roles = self.GetRoles()
        self.cached_size_idx = self.map_size_choice.GetSelection()
        self.cached_weapon_idx = self.weapon_req_choice.GetSelection()
        self.cached_wait_idx = self.ai_wait_choice.GetSelection()
        self.cached_skip = self.skip_checkbox.GetValue()
        self.lang = 'en' if self.lang_choice.GetSelection() == 0 else 'ru'
        self.SetTitle(self.t('setup_title'))
        self.init_ui()

    def OnClose(self, event):
        # Ensure app closes if dialog is closed via X
        self.EndModal(wx.ID_CANCEL)
        wx.GetApp().ExitMainLoop()

    def GetRoles(self):
        mapping = {0: 'human', 1: 'ai', 2: 'none'}
        return {i+1: mapping[self.role_choices[i].GetSelection()] for i in range(4)}

    def GetMapSize(self): return [10, 15, 20][self.map_size_choice.GetSelection()]
    def GetWeaponReq(self): return self.weapon_req_choice.GetSelection() + 3
    def GetAiWait(self): return [0, 500, 1000, 2000][self.ai_wait_choice.GetSelection()]
    def GetAllowSkip(self): return self.skip_checkbox.GetValue()

class GamePanel(wx.Panel):
    def __init__(self, parent, game):
        super().__init__(parent)
        self.game = game
        self.update_ui_params()
        self.SetBackgroundStyle(wx.BG_STYLE_PAINT)
        self.Bind(wx.EVT_PAINT, self.OnPaint)
        self.Bind(wx.EVT_LEFT_DOWN, self.OnMouseClick)
        self.timer = wx.Timer(self)
        self.Bind(wx.EVT_TIMER, self.OnTimer, self.timer)
        self.timer.Start(self.game.ai_wait if self.game.ai_wait > 0 else 50)

    def update_ui_params(self):
        self.cell_size = 50 if self.game.size == 10 else (40 if self.game.size == 15 else 30)

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
                if cell != '.': self.draw_cell_content(dc, r, c, cell)

    def draw_cell_content(self, dc, r, c, cell):
        x, y = c * self.cell_size, r * self.cell_size
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
        dc.DrawText(cell, int(x + (self.cell_size - tw)/2), int(y + (self.cell_size - th)/2))

    def OnMouseClick(self, event):
        if self.game.roles.get(self.game.turn) != 'human' or self.game.game_over: return
        x, y = event.GetPosition()
        c, r = x // self.cell_size, y // self.cell_size
        if 0 <= r < self.game.size and 0 <= c < self.game.size:
            is_shift = wx.GetKeyState(wx.WXK_SHIFT)
            cell = self.game.grid[r][c]
            enemy_id = None
            for pid, p_data in self.game.players.items():
                if cell == p_data['st'] and pid != self.game.turn:
                    enemy_id = pid; break
            if enemy_id:
                power = self.game.get_line_power(self.game.turn)
                if power >= self.game.weapon_req:
                    if self.game.shoot_laser(r, c, power=power): self.game.next_turn()
            elif cell == '.':
                if self.game.can_build(r, c, self.game.turn):
                    self.game.grid[r][c] = self.game.players[self.game.turn]['mi' if is_shift else 'st']
                    self.game.next_turn()
            self.Refresh()
            wx.GetTopLevelParent(self).UpdateStatus()

    def OnTimer(self, event):
        if not self.game.game_over and self.game.roles.get(self.game.turn) == 'ai':
            self.ai_move()
            self.game.next_turn()
            self.Refresh()
            wx.GetTopLevelParent(self).UpdateStatus()

    def ai_move(self):
        p = self.game.turn
        power = self.game.get_line_power(p)
        if power >= self.game.weapon_req:
            for r in range(self.game.size):
                for c in range(self.game.size):
                    if any(self.game.grid[r][c] == pd['st'] for pid, pd in self.game.players.items() if pid != p):
                        if self.game.shoot_laser(r, c, power=power): return
        build_targets = []
        for r in range(self.game.size):
            for c in range(self.game.size):
                if self.game.can_build(r, c, p): build_targets.append((r, c))
        if build_targets:
            scored = []
            for tr, tc in build_targets:
                open_n = sum(1 for dr, dc in [(-1,0),(1,0),(0,-1),(0,1)]
                            if 0 <= tr+dr < self.game.size and 0 <= tc+dc < self.game.size and self.game.grid[tr+dr][tc+dc] == '.')
                scored.append(((tr, tc), open_n))
            scored.sort(key=lambda x: x[1], reverse=True)
            r, c = random.choice([t for t, v in scored if v == scored[0][1]])
            self.game.grid[r][c] = self.game.players[p]['mi' if scored[0][1] > 1 and random.random() < 0.4 else 'st']

class MainFrame(wx.Frame):
    def __init__(self, roles, grid_size, weapon_req, allow_skip, ai_wait, lang):
        super().__init__(None, title=LOCALE[lang]['title'])
        self.game = MarsMinersGame(roles, grid_size, weapon_req, allow_skip, ai_wait, lang)
        self.Bind(wx.EVT_CLOSE, self.OnClose)
        self.init_ui()

    def init_ui(self):
        self.DestroyChildren()
        self.SetTitle(self.game.t('title'))
        panel = wx.Panel(self)
        main_sizer = wx.BoxSizer(wx.HORIZONTAL)
        self.game_panel = GamePanel(panel, self.game)
        gp_size = self.game.size * self.game_panel.cell_size
        self.game_panel.SetMinSize((gp_size, gp_size))

        sidebar = wx.BoxSizer(wx.VERTICAL)
        sidebar.SetMinSize((SIDEBAR_WIDTH, -1))
        sidebar.Add(wx.StaticText(panel, label=self.game.t('expedition_log')), 0, wx.ALL, 10)
        self.status_label = wx.StaticText(panel, label=self.game.t('initializing'))
        sidebar.Add(self.status_label, 0, wx.ALL, 10)
        self.btn_skip = wx.Button(panel, label=self.game.t('skip_turn'))
        self.btn_skip.Bind(wx.EVT_BUTTON, self.OnSkipTurn)
        sidebar.Add(self.btn_skip, 0, wx.ALL | wx.EXPAND, 10)
        if not self.game.allow_skip: self.btn_skip.Hide()

        sidebar.Add(wx.StaticLine(panel), 0, wx.EXPAND | wx.ALL, 5)
        self.score_labels = []
        for i in range(1, 5):
            if self.game.roles[i] != 'none':
                lbl = wx.StaticText(panel, label="")
                lbl.SetForegroundColour(self.game.players[i]['color'])
                self.score_labels.append((i, lbl))
                sidebar.Add(lbl, 0, wx.LEFT | wx.RIGHT | wx.TOP, 5)

        sidebar.AddStretchSpacer()
        sidebar.Add(wx.StaticText(panel, label=self.game.t('storage')), 0, wx.ALL, 5)
        btn_save = wx.Button(panel, label=self.game.t('save'))
        btn_save.Bind(wx.EVT_BUTTON, self.OnSaveGame)
        sidebar.Add(btn_save, 0, wx.ALL | wx.EXPAND, 5)
        btn_load = wx.Button(panel, label=self.game.t('load'))
        btn_load.Bind(wx.EVT_BUTTON, self.OnLoadGame)
        sidebar.Add(btn_load, 0, wx.ALL | wx.EXPAND, 5)

        sidebar.Add(wx.StaticLine(panel), 0, wx.EXPAND | wx.ALL, 5)
        btn_new_game = wx.Button(panel, label=self.game.t('new_game'))
        btn_new_game.Bind(wx.EVT_BUTTON, self.OnNewGameRequest)
        sidebar.Add(btn_new_game, 0, wx.ALL | wx.EXPAND, 10)

        sidebar.Add(wx.StaticLine(panel), 0, wx.EXPAND | wx.ALL, 5)
        sidebar.Add(wx.StaticText(panel, label=self.game.t('controls')), 0, wx.ALL, 2)
        sidebar.Add(wx.StaticLine(panel), 0, wx.EXPAND | wx.ALL, 5)
        sidebar.Add(wx.StaticText(panel, label=self.game.t('attack_help')), 0, wx.ALL, 2)
        self.req_help_label = wx.StaticText(panel, label=self.game.t('requires', n=self.game.weapon_req))
        sidebar.Add(self.req_help_label, 0, wx.ALL, 2)

        main_sizer.Add(self.game_panel, 1, wx.EXPAND | wx.ALL, 10)
        main_sizer.Add(sidebar, 0, wx.EXPAND | wx.ALL, 10)
        panel.SetSizer(main_sizer)
        self.UpdateStatus()
        self.SetClientSize((gp_size + SIDEBAR_WIDTH + 40, gp_size + 20))
        self.Layout(); self.Centre(); self.Show()

    def OnSaveGame(self, e):
        with wx.FileDialog(self, self.game.t('save'), wildcard="JSON (*.json)|*.json", style=wx.FD_SAVE|wx.FD_OVERWRITE_PROMPT) as fd:
            if fd.ShowModal() != wx.ID_CANCEL:
                with open(fd.GetPath(), 'w') as f: json.dump(self.game.to_dict(), f)

    def OnLoadGame(self, e):
        with wx.FileDialog(self, self.game.t('load'), wildcard="JSON (*.json)|*.json", style=wx.FD_OPEN|wx.FD_FILE_MUST_EXIST) as fd:
            if fd.ShowModal() != wx.ID_CANCEL:
                with open(fd.GetPath(), 'r') as f:
                    self.game.from_dict(json.load(f))
                    self.init_ui()

    def OnSkipTurn(self, e):
        if not self.game.game_over and self.game.roles.get(self.game.turn) == 'human':
            self.game.next_turn(); self.game_panel.Refresh(); self.UpdateStatus()

    def OnNewGameRequest(self, e):
        if wx.MessageDialog(self, self.game.t('abandon_msg'), self.game.t('abandon_title'), wx.YES_NO).ShowModal() == wx.ID_YES:
            dlg = RoleDialog(self, self.game.lang)
            if dlg.ShowModal() == wx.ID_OK:
                self.game = MarsMinersGame(dlg.GetRoles(), dlg.GetMapSize(), dlg.GetWeaponReq(), dlg.GetAllowSkip(), dlg.GetAiWait(), dlg.lang)
                self.init_ui()

    def OnClose(self, event):
        self.Destroy()
        wx.GetApp().ExitMainLoop()

    def UpdateStatus(self):
        if self.game.game_over:
            scores = self.game.get_scores()
            if not scores: self.status_label.SetLabel(self.game.t('failed'))
            else: self.status_label.SetLabel(self.game.t('winner', name=self.game.players[max(scores, key=scores.get)]['name']))
            self.btn_skip.Disable()
        else:
            p_name = self.game.players[self.game.turn]['name']
            power, req = self.game.get_line_power(self.game.turn), self.game.weapon_req
            charge = self.game.t('ready', n=power) if power >= req else self.game.t('charging', n=power, req=req)
            self.status_label.SetLabel(self.game.t('turn', name=p_name) + "\n" + charge)
            self.btn_skip.Enable(self.game.roles.get(self.game.turn) == 'human')

        scores = self.game.get_scores()
        for p_id, lbl in self.score_labels:
            status = self.game.t('lost') if self.game.player_lost[p_id] else self.game.t('active')
            lbl.SetLabel(f"{self.game.players[p_id]['name']}: {status} ({scores.get(p_id, 0)} {self.game.t('mines')})")
            lbl.SetForegroundColour(wx.Colour(150,150,150) if self.game.player_lost[p_id] else self.game.players[p_id]['color'])

if __name__ == "__main__":
    app = wx.App()
    dlg = RoleDialog(None)
    if dlg.ShowModal() == wx.ID_OK:
        MainFrame(dlg.GetRoles(), dlg.GetMapSize(), dlg.GetWeaponReq(), dlg.GetAllowSkip(), dlg.GetAiWait(), dlg.lang)
        app.MainLoop()
