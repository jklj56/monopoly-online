import random

class Tile:
    def __init__(self, name, group, price, rent, tile_type, color):
        self.name = name
        self.group = group
        self.price = price
        self.rent = rent
        self.tile_type = tile_type
        self.color = color
        self.owner = None
        self.houses = 0
        self.has_hotel = False

    def get_rent(self):
        if self.tile_type == "city":
            base = self.rent
            if self.houses > 0:
                base = self.rent * (1 + self.houses * 0.5)
            if self.has_hotel:
                base = self.rent * 5
            return int(base)
        elif self.tile_type == "service":
            return self.rent
        return 0

    def to_dict(self):
        return {
            "name": self.name,
            "group": self.group,
            "price": self.price,
            "rent": self.rent,
            "tile_type": self.tile_type,
            "color": self.color,
            "owner": self.owner,
            "houses": self.houses,
            "has_hotel": self.has_hotel
        }


class Player:
    def __init__(self, id, name, color):
        self.id = id
        self.name = name
        self.color = color
        self.money = 1500
        self.position = 0
        self.properties = []
        self.in_jail = False
        self.jail_turns = 0
        self.bankrupt = False
        self.get_out_of_jail_cards = 0

    def can_afford(self, amount):
        return self.money >= amount

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "color": self.color,
            "money": self.money,
            "position": self.position,
            "properties": self.properties,
            "in_jail": self.in_jail,
            "jail_turns": self.jail_turns,
            "bankrupt": self.bankrupt,
            "get_out_of_jail_cards": self.get_out_of_jail_cards
        }


city_colors = {
    "Iran": "#B43232",
    "Asia": "#C8B432",
    "Usa": "#3278C8",
    "Arab": "#329632",
    "Europe": "#963296"
}
service_color = "#64B4DC"

CHANCE_CARDS = [
    ("Advance to START. Collect $200.", "goto", 0),
    ("Bank pays you $100.", "money", 100),
    ("Pay $50 for repairs.", "money", -50),
    ("Go to Jail. Do not pass START.", "goto_jail", None),
    ("Advance to Tehran.", "goto", 1),
    ("Advance to NYC.", "goto", 8),
    ("You inherit $200.", "money", 200),
    ("Pay poor tax of $15.", "money", -15),
    ("Advance to START.", "goto", 0),
    ("Building loan matures. Collect $150.", "money", 150),
    ("You won a crossword competition. Collect $100.", "money", 100),
    ("Pay each player $50.", "pay_each", 50),
    ("Go back 3 spaces.", "go_back", 3),
    ("Advance to Airport.", "goto", 29),
    ("Take a Get Out of Jail card.", "jail_card", None),
]

PLAYER_COLORS = ["#3278C8", "#DC3232", "#32B432", "#C8C832"]

TILES_DATA = [
    ("START", None, 0, 0, "start", "#006400"),
    ("Tehran", "Iran", 200, 60, "city", city_colors["Iran"]),
    ("Isfahan", "Iran", 180, 50, "city", city_colors["Iran"]),
    ("Mashad", "Iran", 180, 50, "city", city_colors["Iran"]),
    ("Telecom", None, 300, 100, "service", service_color),
    ("Tokyo", "Asia", 300, 90, "city", city_colors["Asia"]),
    ("Beijing", "Asia", 300, 90, "city", city_colors["Asia"]),
    ("CHANCE", None, 0, 0, "chance", "#FFFF78"),
    ("NYC", "Usa", 450, 120, "city", city_colors["Usa"]),
    ("Jail", None, 0, 0, "jail", "#9B9B9B"),
    ("Chicago", "Usa", 400, 100, "city", city_colors["Usa"]),
    ("Miami", "Usa", 400, 100, "city", city_colors["Usa"]),
    ("Texas", "Usa", 400, 100, "city", city_colors["Usa"]),
    ("Metro", None, 350, 150, "service", service_color),
    ("Taxi", None, 320, 100, "service", service_color),
    ("Dubai", "Arab", 300, 90, "city", city_colors["Arab"]),
    ("Mecca", "Arab", 300, 90, "city", city_colors["Arab"]),
    ("CHANCE", None, 0, 0, "chance", "#FFFF78"),
    ("TRADE", None, 0, 0, "trade", "#78C8FF"),
    ("Rome", "Europe", 400, 100, "city", city_colors["Europe"]),
    ("Berlin", "Europe", 350, 80, "city", city_colors["Europe"]),
    ("Internet", None, 300, 100, "service", service_color),
    ("Bus", None, 320, 90, "service", service_color),
    ("Tabriz", "Iran", 360, 108, "city", city_colors["Iran"]),
    ("Shiraz", "Iran", 250, 60, "city", city_colors["Iran"]),
    ("Jakarta", "Asia", 380, 120, "city", city_colors["Asia"]),
    ("Bangkok", "Asia", 360, 100, "city", city_colors["Asia"]),
    ("CHANCE", None, 0, 0, "chance", "#FFFF78"),
    ("Airport", None, 350, 100, "service", service_color),
    ("Paris", "Europe", 300, 90, "city", city_colors["Europe"]),
    ("London", "Europe", 320, 100, "city", city_colors["Europe"]),
    ("CHANCE", None, 0, 0, "chance", "#FFFF78"),
    ("Athens", "Europe", 350, 100, "city", city_colors["Europe"]),
    ("Madrid", "Europe", 350, 100, "city", city_colors["Europe"]),
    ("Bagdad", "Arab", 200, 50, "city", city_colors["Arab"]),
    ("Riyadh", "Arab", 300, 100, "city", city_colors["Arab"]),
]


class MonopolyGame:
    def __init__(self, room_id):
        self.room_id = room_id
        self.tiles = [Tile(*t) for t in TILES_DATA]
        self.players = {}
        self.current_player_id = None
        self.phase = "WAITING"  # WAITING, ROLLING, MOVING, ACTION, ENDED
        self.dice = (1, 1)
        self.doubles_count = 0
        self.message = ""
        self.player_order = []
        self.turn_index = 0
        self.chance_card = None

    def add_player(self, player_id, name):
        if len(self.players) >= 4:
            return False
        color = PLAYER_COLORS[len(self.players)]
        self.players[player_id] = Player(player_id, name, color)
        self.player_order.append(player_id)
        if len(self.players) >= 2 and self.phase == "WAITING":
            self.start_game()
        return True

    def remove_player(self, player_id):
        if player_id in self.players:
            player = self.players[player_id]
            player.bankrupt = True
            # Transfer properties
            for prop_idx in player.properties[:]:
                self.tiles[prop_idx].owner = None
                self.tiles[prop_idx].houses = 0
                self.tiles[prop_idx].has_hotel = False
            player.properties.clear()
            del self.players[player_id]
            if player_id in self.player_order:
                self.player_order.remove(player_id)
            if self.current_player_id == player_id:
                self.next_turn()

    def start_game(self):
        self.phase = "ROLLING"
        self.turn_index = 0
        self.current_player_id = self.player_order[0]

    def get_current_player(self):
        if self.current_player_id and self.current_player_id in self.players:
            return self.players[self.current_player_id]
        return None

    def roll_dice(self):
        if self.phase != "ROLLING":
            return None

        player = self.get_current_player()
        if not player or player.bankrupt:
            self.next_turn()
            return None

        d1 = random.randint(1, 6)
        d2 = random.randint(1, 6)
        self.dice = (d1, d2)
        is_doubles = d1 == d2

        if is_doubles and not player.in_jail:
            self.doubles_count += 1
            if self.doubles_count >= 3:
                player.position = 9
                player.in_jail = True
                self.message = f"{player.name} rolled 3 doubles! Go to JAIL!"
                self.doubles_count = 0
                self.phase = "ACTION"
                return {"dice": self.dice, "doubles": True, "jail": True}

        self.doubles_count = 0 if not is_doubles else self.doubles_count
        steps = d1 + d2
        self.phase = "MOVING"

        return {"dice": self.dice, "steps": steps, "doubles": is_doubles}

    def move_player(self):
        player = self.get_current_player()
        if not player:
            return

        old_pos = player.position
        steps = sum(self.dice)
        player.position = (player.position + steps) % len(self.tiles)

        passed_start = player.position < old_pos and not player.in_jail
        if passed_start:
            player.money += 200
            self.message = f"{player.name} passed START! +$200"

        self.phase = "ACTION"
        return self.handle_tile()

    def handle_tile(self):
        player = self.get_current_player()
        if not player:
            return {"action": "none"}

        tile = self.tiles[player.position]

        if tile.tile_type == "start":
            player.money += 200
            self.message = f"{player.name} collects $200!"
            return {"action": "message", "message": self.message}

        elif tile.tile_type == "jail":
            self.message = f"{player.name} is visiting Jail"
            return {"action": "none"}

        elif tile.tile_type == "chance":
            return {"action": "chance"}

        elif tile.tile_type == "trade":
            return {"action": "trade"}

        elif tile.tile_type in ("city", "service"):
            if tile.owner is None:
                return {"action": "buy", "tile": tile.to_dict()}
            elif tile.owner != player.id:
                rent = tile.get_rent()
                owner = self.players.get(tile.owner)
                if owner and not owner.bankrupt:
                    if player.can_afford(rent):
                        player.money -= rent
                        owner.money += rent
                        self.message = f"{player.name} pays ${rent} rent to {owner.name}"
                    else:
                        player.bankrupt = True
                        self.message = f"{player.name} is BANKRUPT! Can't pay ${rent} rent"
                        for prop_idx in player.properties:
                            self.tiles[prop_idx].owner = None
                            self.tiles[prop_idx].houses = 0
                            self.tiles[prop_idx].has_hotel = False
                        player.properties.clear()
                        self.check_winner()
                    return {"action": "message", "message": self.message}
            return {"action": "none"}

        return {"action": "none"}

    def buy_property(self):
        player = self.get_current_player()
        if not player:
            return False

        tile = self.tiles[player.position]
        if tile.tile_type not in ("city", "service") or tile.owner is not None:
            return False

        if player.can_afford(tile.price):
            player.money -= tile.price
            tile.owner = player.id
            player.properties.append(player.position)
            self.message = f"{player.name} bought {tile.name}!"
            return True
        return False

    def build_house(self, prop_index):
        player = self.get_current_player()
        if not player:
            return False

        if prop_index not in player.properties:
            return False

        tile = self.tiles[prop_index]
        if tile.tile_type != "city" or tile.has_hotel:
            return False

        if player.can_afford(50):
            player.money -= 50
            if tile.houses < 4:
                tile.houses += 1
            else:
                tile.has_hotel = True
                tile.houses = 0
            self.message = f"Built on {tile.name}!"
            return True
        return False

    def draw_chance(self):
        player = self.get_current_player()
        if not player:
            return None

        card = random.choice(CHANCE_CARDS)
        self.chance_card = card

        if card[1] == "goto":
            player.position = card[2]
            if player.position == 0:
                player.money += 200
        elif card[1] == "money":
            player.money += card[2]
        elif card[1] == "goto_jail":
            player.position = 9
            player.in_jail = True
        elif card[1] == "go_back":
            player.position = (player.position - card[2]) % len(self.tiles)
        elif card[1] == "pay_each":
            for pid, other in self.players.items():
                if pid != player.id and not other.bankrupt:
                    if player.can_afford(card[2]):
                        player.money -= card[2]
                        other.money += card[2]
        elif card[1] == "jail_card":
            player.get_out_of_jail_cards += 1

        return {"text": card[0]}

    def pay_jail(self):
        player = self.get_current_player()
        if not player or not player.in_jail:
            return False
        if player.can_afford(100):
            player.money -= 100
            player.in_jail = False
            player.jail_turns = 0
            self.message = f"{player.name} paid $100 to leave Jail"
            return True
        return False

    def use_jail_card(self):
        player = self.get_current_player()
        if not player or not player.in_jail or player.get_out_of_jail_cards <= 0:
            return False
        player.get_out_of_jail_cards -= 1
        player.in_jail = False
        player.jail_turns = 0
        self.message = f"{player.name} used Get Out of Jail card"
        return True

    def end_turn(self):
        if self.phase == "ENDED":
            return
        self.next_turn()

    def next_turn(self):
        self.turn_index = (self.turn_index + 1) % len(self.player_order)
        attempts = 0
        while attempts < len(self.player_order):
            pid = self.player_order[self.turn_index]
            if pid in self.players and not self.players[pid].bankrupt:
                self.current_player_id = pid
                self.phase = "ROLLING"
                self.doubles_count = 0
                return
            self.turn_index = (self.turn_index + 1) % len(self.player_order)
            attempts += 1
        self.phase = "ENDED"

    def check_winner(self):
        active = [p for p in self.players.values() if not p.bankrupt]
        if len(active) == 1:
            self.phase = "ENDED"
            return active[0].id
        elif len(active) == 0:
            self.phase = "ENDED"
            return "draw"
        return None

    def trade_property(self, from_id, to_id, prop_index, amount):
        if from_id not in self.players or to_id not in self.players:
            return False

        from_player = self.players[from_id]
        to_player = self.players[to_id]

        if prop_index not in to_player.properties:
            return False

        if not from_player.can_afford(amount):
            return False

        tile = self.tiles[prop_index]

        from_player.money -= amount
        to_player.money += amount

        to_player.properties.remove(prop_index)
        from_player.properties.append(prop_index)
        tile.owner = from_id

        self.message = f"{from_player.name} bought {tile.name} from {to_player.name} for ${amount}"
        return True

    def to_dict(self):
        return {
            "room_id": self.room_id,
            "tiles": [t.to_dict() for t in self.tiles],
            "players": {pid: p.to_dict() for pid, p in self.players.items()},
            "current_player": self.current_player_id,
            "phase": self.phase,
            "dice": self.dice,
            "message": self.message,
            "player_order": self.player_order
        }
