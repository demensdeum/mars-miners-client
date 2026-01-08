import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MarsMinersGame, PlayerId } from '../src/logic/MarsMinersGame';
import { multiplayerService } from '../src/logic/MultiplayerService';
import { t } from '../src/logic/locales';

interface GameViewProps {
    game: MarsMinersGame;
    onBack: () => void;
    myPlayerId?: PlayerId;
}

function GameView({ game, onBack, myPlayerId }: GameViewProps) {
    const router = useRouter();

    // Force update helper
    const [tick, setTick] = useState(0);
    const forceUpdate = () => setTick(t => t + 1);

    // Capture state for Effect dependencies and Render
    const currentTurn = game.turn;
    const isGameOver = game.game_over;
    const turnRole = game.roles[currentTurn];
    const isHumanTurn = !isGameOver && turnRole === 'human';
    const isMyTurn = !game.isMultiplayer || (myPlayerId === currentTurn);
    const canInteract = isHumanTurn && isMyTurn;

    const [buildMode, setBuildMode] = useState<'st' | 'mi'>('st');
    const [highlight, setHighlight] = useState(game.highlight_weapon);
    const [showGameOverModal, setShowGameOverModal] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connected');



    // AI Loop (disable in multiplayer)
    useEffect(() => {
        if (!game.isMultiplayer && !isGameOver && turnRole === 'ai') {
            const timer = setTimeout(() => {
                game.aiMove();
                game.nextTurn();
                forceUpdate();
            }, Math.max(50, game.ai_wait));
            return () => clearTimeout(timer);
        }
    }, [currentTurn, isGameOver, tick, game.isMultiplayer]);

    // Multiplayer Polling Loop
    useEffect(() => {
        if (!game.isMultiplayer || isGameOver || !game.battleID) return;

        const interval = setInterval(async () => {
            try {
                const response = await multiplayerService.readBattleLog(game.battleID);
                setConnectionStatus('connected');

                // Sync game state with server log
                if (response.battleLog !== game.commandLog) {
                    game.syncFromBattleLog(response.battleLog);
                    forceUpdate();
                }
            } catch (error) {
                console.error("Polling error:", error);
                setConnectionStatus('disconnected');
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [game, game.isMultiplayer, isGameOver, game.battleID]);

    // Show game over modal
    useEffect(() => {
        if (isGameOver) {
            setShowGameOverModal(true);
        }
    }, [isGameOver]);

    // Cell Interaction
    const handleCellPress = async (r: number, c: number) => {
        if (!canInteract) return;

        // Enemy check
        const cell = game.grid[r][c];
        let enemyId: PlayerId | null = null;
        for (let pidStr in game.players) {
            const pid = parseInt(pidStr) as PlayerId;
            if (pid !== currentTurn && cell === game.players[pid].st) {
                enemyId = pid;
                break;
            }
        }

        let commandToSend: string | null = null;

        if (enemyId) {
            const power = game.getLinePower(currentTurn);
            if (power >= game.weapon_req) {
                if (game.shootLaser(r, c, power)) {
                    if (game.isMultiplayer) {
                        commandToSend = game.encodeCommand('L', r, c);
                    } else {
                        game.nextTurn();
                        forceUpdate();
                    }
                }
            }
        } else if (cell === '.') {
            if (game.canBuild(r, c, currentTurn)) {
                if (game.isMultiplayer) {
                    commandToSend = game.encodeCommand(buildMode === 'st' ? 'S' : 'M', r, c);
                } else {
                    game.grid[r][c] = game.players[currentTurn][buildMode];
                    game.nextTurn();
                    forceUpdate();
                }
            }
        }

        // Send command if multiplayer
        if (commandToSend && game.isMultiplayer && game.sessionID) {
            try {
                setConnectionStatus('connecting');
                // Optimistically apply local change (already done above for building/shooting logic?)
                // Actually above logic modifies grid. For multiplayer we should maybe wait or optimistic update?
                // The current code already modifies grid in non-multiplayer block in else.
                // For multiplayer block, we only set commandToSend. We need to modify grid locally too?
                // MarsMinersGame.decodeAndExecuteCommand does the modification.

                // Let's modify local state immediately using the command logic
                if (game.decodeAndExecuteCommand(commandToSend)) {
                    game.nextTurn();
                    forceUpdate();

                    // Send to server
                    await multiplayerService.sendCommand(game.sessionID, game.battleID, commandToSend);
                    setConnectionStatus('connected');
                }
            } catch (error) {
                console.error("Failed to send command", error);
                setConnectionStatus('disconnected');
                // Revert? Complex. For now just let polling fix it eventually.
            }
        }
    };

    // Handle modal OK button
    const handleModalOk = () => {
        setShowGameOverModal(false);
        onBack();
    };

    const [layout, setLayout] = useState({ width: 0, height: 0 });

    const onLayout = (event: any) => {
        const { width, height } = event.nativeEvent.layout;
        setLayout({ width, height });
    };

    // Rendering Helpers
    const weaponCells = highlight ? game.getWeaponCells() : new Set();

    // Calculate cell size to fit container
    const availableSize = Math.min(layout.width, layout.height);
    const cellSize = availableSize > 0 ? (Math.floor(availableSize / game.size) - 2) : 0;

    const renderCell = ({ item, index }: { item: string, index: number }) => {
        if (cellSize <= 0) return null;
        const r = Math.floor(index / game.size);
        const c = index % game.size;

        const isWeaponPart = weaponCells.has(`${r},${c}`);

        let bgColor = '#1e1e1e';
        if (isWeaponPart) bgColor = '#504614';

        // Dead cells (destroyed stations) show as grey)
        if (item === '█') bgColor = '#646464';

        if (item === '.' && canInteract && game.canBuild(r, c, currentTurn)) {
            bgColor = '#1e3a5f';
        }

        // Determine text color
        let color = '#fff';
        if (item === 'X') color = 'red';
        else {
            for (let pidStr in game.players) {
                const p = game.players[parseInt(pidStr) as PlayerId];
                if (item === p.st || item === p.mi) {
                    color = p.color;
                    break;
                }
            }
        }

        // Don't show symbol for dead cells or empty cells
        const displayText = (item === '.' || item === '█') ? '' : item;

        return (
            <TouchableOpacity
                style={[styles.cell, { width: cellSize, height: cellSize, backgroundColor: bgColor }]}
                onPress={() => handleCellPress(r, c)}
                activeOpacity={0.7}
            >
                <Text style={{ color, fontSize: cellSize * 0.7, fontWeight: 'bold' }}>{displayText}</Text>
            </TouchableOpacity>
        );
    };

    const flatGrid = game.grid.flat();

    // Status Text
    let statusText = "";
    if (isGameOver) {
        const scores = game.getScores();
        const maxScore = Math.max(...Object.values(scores).map(Number));
        const winners = Object.keys(scores).filter(k => scores[parseInt(k) as PlayerId] === maxScore);
        if (winners.length > 1) {
            const names = winners.map(w => game.players[parseInt(w) as PlayerId].name).join(', ');
            statusText = t('draw', game.lang, { names, m: maxScore });
        } else {
            const w = parseInt(winners[0]) as PlayerId;
            statusText = t('winner', game.lang, { name: game.players[w].name, m: maxScore });
        }
    } else {
        const pName = game.players[currentTurn].name;

        let subText = "";

        if (game.isMultiplayer && !isMyTurn) {
            subText = t('waiting_for_opponent', game.lang);
        } else {
            const power = game.getLinePower(currentTurn);
            const req = game.weapon_req;
            const msg = power >= req
                ? t('ready', game.lang, { n: power })
                : t('charging', game.lang, { n: power, req });
            subText = msg;
        }

        statusText = `${t('turn', game.lang, { name: pName })}\n${subText}`;
    }

    // Multiplayer Status Header
    let mpStatus = null;
    if (game.isMultiplayer) {
        mpStatus = (
            <Text style={{ color: connectionStatus === 'connected' ? '#4ade80' : 'red', fontSize: 10, textAlign: 'center' }}>
                {t('connection_status', game.lang, { status: t(connectionStatus, game.lang) })}
            </Text>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}><Text style={styles.btnText}>←</Text></TouchableOpacity>
                <div dir="auto" style={styles.headerInfo as any}>
                    {mpStatus}
                    <Text style={styles.headerTitle} numberOfLines={2}>{statusText}</Text>
                    <View style={styles.headerScores}>
                        {[1, 2, 3, 4].map(pid => {
                            const id = pid as PlayerId;
                            if (game.roles[id] === 'none') return null;
                            const score = game.getScores()[id] || 0;
                            const isLost = game.player_lost[id];
                            return (
                                <Text key={id} style={{ color: isLost ? '#666' : game.players[id].color, fontSize: 10, marginHorizontal: 4 }}>
                                    {game.players[id].name}:{score}
                                </Text>
                            );
                        })}
                    </View>
                </div>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.gridContainer} onLayout={onLayout}>
                {cellSize > 0 && (
                    <View style={{ width: cellSize * game.size, height: cellSize * game.size }}>
                        <FlatList
                            data={flatGrid}
                            renderItem={renderCell}
                            keyExtractor={(_, i) => i.toString()}
                            numColumns={game.size}
                            key={game.size}
                            scrollEnabled={false}
                        />
                    </View>
                )}
            </View>

            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.bottomBtn, buildMode === 'st' ? styles.activeBtn : {}]}
                    onPress={() => setBuildMode('st')}
                    disabled={!canInteract}
                >
                    <Text style={styles.btnLabel}>{t('station_btn', game.lang)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.bottomBtn, buildMode === 'mi' ? styles.activeBtn : {}]}
                    onPress={() => setBuildMode('mi')}
                    disabled={!canInteract}
                >
                    <Text style={styles.btnLabel}>{t('mine_btn', game.lang)}</Text>
                </TouchableOpacity>
            </View>

            <Modal
                visible={showGameOverModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => { }}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{t('game_over', game.lang)}</Text>
                        <Text style={styles.modalMessage}>{statusText}</Text>
                        <TouchableOpacity style={styles.modalButton} onPress={handleModalOk}>
                            <Text style={styles.modalButtonText}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

export default function GameScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const gameRef = useRef<MarsMinersGame | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    useEffect(() => {
        if (!gameRef.current && params.roles) {
            try {
                const roles = JSON.parse(params.roles as string);
                const size = parseInt(params.grid_size as string);
                const weaponReq = parseInt(params.weapon_req as string);
                const allowSkip = params.allow_skip === '1';
                const aiWait = parseInt(params.ai_wait as string);
                const lang = params.lang as 'en' | 'ru';

                const isMultiplayer = params.isMultiplayer === '1';
                const sessionID = params.sessionID as string || '';
                const battleID = params.battleID as string || '';

                gameRef.current = new MarsMinersGame(roles, size, weaponReq, allowSkip, aiWait, lang, isMultiplayer, sessionID, battleID);
                setIsInitialized(true);
            } catch (e) {
                console.error("Failed to parsing params", e);
                router.replace('/');
            }
        }
    }, [params.roles]);

    const handleBack = () => {
        router.back();
    };

    if (!isInitialized || !gameRef.current) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.gridContainer}>
                    <ActivityIndicator size="large" color="#007AFF" />
                </View>
            </SafeAreaView>
        );
    }

    const myPlayerId = params.myPlayerId ? parseInt(params.myPlayerId as string) as PlayerId : undefined;

    return <GameView game={gameRef.current} onBack={handleBack} myPlayerId={myPlayerId} />;
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' },
    header: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: 10, height: 70, borderBottomWidth: 1, borderBottomColor: '#333' },
    backBtn: { padding: 10 },
    btnText: { color: '#fff', fontSize: 24 },
    headerInfo: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: '#fff', textAlign: 'center', fontSize: 14, marginBottom: 2 },
    headerScores: { flexDirection: 'row', justifyContent: 'center', width: '100%' },

    gridContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    cell: { borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },

    bottomBar: { flexDirection: 'row', height: 80 },
    bottomBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#333', margin: 10, borderRadius: 8 },
    activeBtn: { backgroundColor: '#007AFF' },
    btnLabel: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#2a2a2a', padding: 30, borderRadius: 15, alignItems: 'center', minWidth: 300 },
    modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 15 },
    modalMessage: { fontSize: 16, color: '#ccc', textAlign: 'center', marginBottom: 25 },
    modalButton: { backgroundColor: '#007AFF', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
    modalButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
