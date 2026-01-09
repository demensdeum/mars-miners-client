# Mars Miners

[**Play Online Demo**](https://demensdeum.com/demos/mars-miners/)

Mars Miners is a turn-based strategy game for 4 players (Human or AI). Build stations to expand your territory, mines to gather resources, and lasers to destroy your enemies. Be the last miner standing or gather the most resources to win!

## Features

- **Strategic Gameplay**: Balance expansion (`Stations`), resource gathering (`Mines`), and aggression (`Lasers`).
- **Game Modes**:
  - **Singleplayer**: Play against 3 AI opponents.
  - **Multiplayer**: Real-time battles via WebSocket server. Supports joining via Session ID.
- **Battle Log & Replays**: Every move is recorded. Save your battle logs and replay them later to analyze strategies.
- **Cross-Platform**: Built with React Native / Expo for iOS, Android, and Web.
- **Localization**: Supports English and Russian.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/demensdeum/mars-miners-client.git
    cd mobile-app
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Start the app:
    ```bash
    npx expo start
    ```

## Gameplay Rules

- **Turn-Based**: Players take turns one by one (Red, Green, Blue, Yellow).
- **Territory**: You can only build on empty cells adjacent to your existing stations.
- **Weapons**: To shoot a laser, you must have a line of **4 Stations** (horizontal or vertical).
- **Sacrifice**: Shooting a laser consumes (destroys) one of your weapon-ready stations.
- **Winning**: Eliminate all other players or have the most mines when no moves remain.

## Project Structure

- `app/`: Expo Router screens (`index`, `setup`, `game`, `multiplayer`, `replay`).
- `src/logic/`: Core game logic.
  - `MarsMinersGame.ts`: The authoritative game state machine.
  - `battlelog/`: Handles move recording and networking.
    - `WebsocketsBattlelogWriter.ts`: Manages multiplayer WebSocket connections, reconnection, and command buffering.
  - `locales.ts`: Translation strings.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[MIT](https://choosealicense.com/licenses/mit/)
