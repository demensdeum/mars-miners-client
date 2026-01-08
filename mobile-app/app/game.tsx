import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MarsMinersGame, PlayerId } from '../src/logic/MarsMinersGame';
import { t } from '../src/logic/locales';

interface GameViewProps {
    game: MarsMinersGame;
    onBack: () => void;
}

function GameView({ game, onBack }: GameViewProps) {
    const router = useRouter();

    // Force update helper
    const [tick, setTick] = useState(0);
    const forceUpdate = () => setTick(t => t + 1);

    // Capture state for Effect dependencies and Render
    const currentTurn = game.turn;
    const isGameOver = game.game_over;
    const turnRole = game.roles[currentTurn];
    const isHumanTurn = !isGameOver && turnRole === 'human';

    const [buildMode, setBuildMode] = useState<'st' | 'mi'>('st');
    const [highlight, setHighlight] = useState(game.highlight_weapon);
    const [pendingSacrifice, setPendingSacrifice] = useState<[number, number] | null>(null);
    const [showGameOverModal, setShowGameOverModal] = useState(false);

    // AI Loop
    useEffect(() => {
        if (!isGameOver && turnRole === 'ai') {
            const timer = setTimeout(() => {
                setPendingSacrifice(null);
                game.aiMove();
                game.nextTurn();
                forceUpdate();
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [currentTurn, isGameOver, tick]);

    useEffect(() => {
        if (isGameOver) {
            setShowGameOverModal(true);
        }
    }, [isGameOver]);

    const handleSave = async () => {
        try {
            const fileName = `mars-miners-battle-log.txt`;
            const logText = game.battleLog.join('\n');

            if (Platform.OS === 'web') {
                const blob = new Blob([logText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = fileName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            } else {
                const fileUri = (FileSystem as any).cacheDirectory + fileName;
                await FileSystem.writeAsStringAsync(fileUri, logText);

                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(fileUri);
                } else {
                    Alert.alert("Error", "Sharing is not available on this platform");
                }
            }
        } catch (e) {
            console.error("Failed to save log", e);
            Alert.alert("Error", "Failed to export battle log");
        }
    };

    // Cell Interaction
    const handleCellPress = (r: number, c: number) => {
        if (!isHumanTurn) return;

        const cell = game.grid[r][c];
        const weaponCells = game.getWeaponCells();
        const isWeaponPart = weaponCells.has(`${r},${c}`);

        // Try selecting sacrifice
        if (cell === game.players[currentTurn].st && isWeaponPart) {
            if (pendingSacrifice && pendingSacrifice[0] === r && pendingSacrifice[1] === c) {
                setPendingSacrifice(null);
            } else {
                setPendingSacrifice([r, c]);
            }
            forceUpdate();
            return;
        }

        // Enemy check
        let enemyId: PlayerId | null = null;
        for (let pidStr in game.players) {
            const pid = parseInt(pidStr) as PlayerId;
            if (pid !== currentTurn && cell === game.players[pid].st) {
                enemyId = pid;
                break;
            }
        }

        if (enemyId) {
            if (pendingSacrifice) {
                if (game.shootLaser(r, c, pendingSacrifice)) {
                    setPendingSacrifice(null);
                    game.nextTurn();
                    forceUpdate();
                }
            }
        } else if (cell === '.') {
            if (game.canBuild(r, c, currentTurn)) {
                game.grid[r][c] = game.players[currentTurn][buildMode];
                game.addLog(buildMode === 'st' ? 'S' : 'M', r, c);
                setPendingSacrifice(null);
                game.nextTurn();
                forceUpdate();
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
    const cellSize = availableSize > 0 ? (Math.floor(availableSize / Math.max(game.width, game.height)) - 2) : 0;

    const renderCell = ({ item, index }: { item: string, index: number }) => {
        if (cellSize <= 0) return null;
        const r = Math.floor(index / game.width);
        const c = index % game.width;

        const isWeaponPart = weaponCells.has(`${r},${c}`);
        const isSelectedForSacrifice = pendingSacrifice && pendingSacrifice[0] === r && pendingSacrifice[1] === c;

        let bgColor = '#1e1e1e';
        if (isWeaponPart) bgColor = '#504614';
        if (isSelectedForSacrifice) bgColor = '#ff3b30'; // Distinct Red for sacrifice

        // Dead cells (destroyed stations) show as grey)
        if (item === '█') bgColor = '#646464';

        if (item === '.' && isHumanTurn && game.canBuild(r, c, currentTurn)) {
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
            const namesList = winners.map(w => game.players[parseInt(w) as PlayerId].name).join(', ');
            statusText = t('draw', 'en', { names: namesList, m: maxScore });
        } else {
            const w = parseInt(winners[0]) as PlayerId;
            statusText = t('winner', 'en', { name: game.players[w].name, m: maxScore });
        }
    } else {
        const pName = game.players[currentTurn].name;
        const power = game.getLinePower(currentTurn);
        const req = game.weapon_req;
        const msg = power >= req
            ? t('ready', 'en', { n: power })
            : t('charging', 'en', { n: power, req });
        statusText = `${t('turn', 'en', { name: pName })}\n${msg}`;
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onBack} style={styles.backBtn}><Text style={styles.btnText}>←</Text></TouchableOpacity>
                <div dir="auto" style={styles.headerInfo as any}>
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
                    <View style={{ width: cellSize * game.width, height: cellSize * game.height }}>
                        <FlatList
                            data={flatGrid}
                            renderItem={renderCell}
                            keyExtractor={(_, i) => i.toString()}
                            numColumns={game.width}
                            key={game.width}
                            scrollEnabled={false}
                        />
                    </View>
                )}
            </View>

            <View style={styles.logContainer}>
                <ScrollView
                    ref={(ref) => ref?.scrollToEnd({ animated: true })}
                    style={styles.logScrollView}
                    contentContainerStyle={styles.logContent}
                >
                    {game.battleLog.map((log, i) => (
                        <Text key={i} style={styles.logText}>
                            {`Turn ${i + 1}: ${log}`}
                        </Text>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.bottomBtn, buildMode === 'st' ? styles.activeBtn : {}]}
                    onPress={() => setBuildMode('st')}
                    disabled={!isHumanTurn}
                >
                    <Text style={styles.btnLabel}>{t('station_btn', 'en')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.bottomBtn, buildMode === 'mi' ? styles.activeBtn : {}]}
                    onPress={() => setBuildMode('mi')}
                    disabled={!isHumanTurn}
                >
                    <Text style={styles.btnLabel}>{t('mine_btn', 'en')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.bottomBtn, styles.saveButtonUI]}
                    onPress={handleSave}
                >
                    <Text style={styles.btnLabel}>{t('save', 'en')}</Text>
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
                        <Text style={styles.modalTitle}>{t('game_over', 'en')}</Text>
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
                const width = parseInt(params.grid_width as string) || 10;
                const height = parseInt(params.grid_height as string) || 10;
                const weaponReq = parseInt(params.weapon_req as string) || 4;

                gameRef.current = new MarsMinersGame(roles, weaponReq);

                if (params.restore_state) {
                    try {
                        const parsed = JSON.parse(params.restore_state as string);
                        if (parsed.battleLog) {
                            gameRef.current.replayLog(parsed.battleLog);
                        } else {
                            // Fallback to old dict format
                            gameRef.current.fromDict(parsed);
                        }
                    } catch (e) {
                        // Raw text log
                        const lines = (params.restore_state as string).split('\n').filter(l => l.trim().length > 0);
                        gameRef.current.replayLog(lines);
                    }
                }

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

    return <GameView game={gameRef.current} onBack={handleBack} />;
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
    bottomBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#333', margin: 5, borderRadius: 8 },
    activeBtn: { backgroundColor: '#007AFF' },
    saveButtonUI: { backgroundColor: '#34c759' },
    btnLabel: { color: '#fff', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },

    logContainer: {
        height: 100,
        backgroundColor: '#1a1a1a',
        borderTopWidth: 1,
        borderTopColor: '#333',
        marginHorizontal: 10,
        borderRadius: 8,
        padding: 5
    },
    logScrollView: { flex: 1 },
    logContent: { paddingVertical: 5 },
    logText: { color: '#aaa', fontSize: 12, fontFamily: 'monospace', marginBottom: 2 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center' },
    modalContent: { backgroundColor: '#2a2a2a', padding: 30, borderRadius: 15, alignItems: 'center', minWidth: 300 },
    modalTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 15 },
    modalMessage: { fontSize: 16, color: '#ccc', textAlign: 'center', marginBottom: 25 },
    modalButton: { backgroundColor: '#007AFF', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 },
    modalButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
