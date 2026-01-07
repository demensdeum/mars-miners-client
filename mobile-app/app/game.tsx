import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Dimensions, FlatList, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MarsMinersGame, PlayerId, PlayerRole } from '../src/logic/MarsMinersGame';
import { t } from '../src/logic/locales';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function GameScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();

    // Force update helper
    const [tick, setTick] = useState(0);
    const forceUpdate = () => setTick(t => t + 1);

    const gameRef = useRef<MarsMinersGame | null>(null);

    // Initialize Game
    if (!gameRef.current) {
        try {
            const roles = JSON.parse(params.roles as string);
            const size = parseInt(params.grid_size as string);
            const weaponReq = parseInt(params.weapon_req as string);
            const allowSkip = params.allow_skip === '1';
            const aiWait = parseInt(params.ai_wait as string);
            const lang = params.lang as 'en' | 'ru';

            gameRef.current = new MarsMinersGame(roles, size, weaponReq, allowSkip, aiWait, lang);
        } catch (e) {
            console.error("Failed to parsing params", e);
            router.replace('/');
            return <View><ActivityIndicator /></View>;
        }
    }

    const game = gameRef.current;
    // Capture state for Effect dependencies and Render
    const currentTurn = game.turn;
    const isGameOver = game.game_over;
    const turnRole = game.roles[currentTurn];
    const isHumanTurn = !isGameOver && turnRole === 'human';

    const [buildMode, setBuildMode] = useState<'st' | 'mi'>('st');
    const [highlight, setHighlight] = useState(game.highlight_weapon);

    // AI Loop
    useEffect(() => {
        if (!isGameOver && turnRole === 'ai') {
            const timer = setTimeout(() => {
                game.aiMove();
                game.nextTurn();
                forceUpdate();
            }, Math.max(50, game.ai_wait));
            return () => clearTimeout(timer);
        }
    }, [currentTurn, isGameOver, tick]); // Tick ensures we check again if something weird happens, but mostly turn.

    // Cell Interaction
    const handleCellPress = (r: number, c: number) => {
        if (!isHumanTurn) return;

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

        if (enemyId) {
            const power = game.getLinePower(currentTurn);
            if (power >= game.weapon_req) {
                if (game.shootLaser(r, c, power)) {
                    game.nextTurn();
                    forceUpdate();
                }
            } else {
                // Feedback? Maybe vibrate or toast
            }
        } else if (cell === '.') {
            if (game.canBuild(r, c, currentTurn)) {
                game.grid[r][c] = game.players[currentTurn][buildMode];
                game.nextTurn();
                forceUpdate();
            }
        }
    };

    // Quit/Back
    const handleBack = () => {
        router.replace('/');
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
    const cellSize = availableSize > 0 ? (Math.floor(availableSize / game.size) - 2) : 0; // -2 for margin/border safety

    const renderCell = ({ item, index }: { item: string, index: number }) => {
        if (cellSize <= 0) return null;

        // FlatList data will be flattened grid? Or we render rows?
        // Let's flatten grid for FlatList.
        // Actually FlatList with numColumns is easier.
        // item is cell content. index gives us r, c.
        const r = Math.floor(index / game.size);
        const c = index % game.size;

        const isWeaponPart = weaponCells.has(`${r},${c}`);

        // ... (rest of logic same) ...

        let bgColor = '#1e1e1e';
        if (isWeaponPart) bgColor = '#504614';

        if (item === '.' && isHumanTurn && game.canBuild(r, c, currentTurn)) {
            bgColor = '#1e3a5f';
        }

        // Determine text color
        let color = '#fff';
        if (item === '█') color = '#646464';
        else if (item === 'X') color = 'red';
        else {
            for (let pidStr in game.players) {
                const p = game.players[parseInt(pidStr) as PlayerId];
                if (item === p.st || item === p.mi) {
                    color = p.color;
                    break;
                }
            }
        }

        return (
            <TouchableOpacity
                style={[styles.cell, { width: cellSize, height: cellSize, backgroundColor: bgColor }]}
                onPress={() => handleCellPress(r, c)}
                activeOpacity={0.7}
            >
                <Text style={{ color, fontSize: cellSize * 0.7, fontWeight: 'bold' }}>{item !== '.' ? item : ''}</Text>
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
        const power = game.getLinePower(currentTurn);
        const req = game.weapon_req;
        const msg = power >= req
            ? t('ready', game.lang, { n: power })
            : t('charging', game.lang, { n: power, req });
        statusText = `${t('turn', game.lang, { name: pName })}\n${msg}`;
    }

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn}><Text style={styles.btnText}>←</Text></TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={styles.headerTitle} numberOfLines={2}>{statusText}</Text>
                    {/* Compact Scores in Header */}
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
                </View>
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

            {/* Same bottom bar */}
            <View style={styles.bottomBar}>
                <TouchableOpacity
                    style={[styles.bottomBtn, buildMode === 'st' ? styles.activeBtn : {}]}
                    onPress={() => setBuildMode('st')}
                    disabled={!isHumanTurn}
                >
                    <Text style={styles.btnLabel}>{t('station_btn', game.lang)}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.bottomBtn, buildMode === 'mi' ? styles.activeBtn : {}]}
                    onPress={() => setBuildMode('mi')}
                    disabled={!isHumanTurn}
                >
                    <Text style={styles.btnLabel}>{t('mine_btn', game.lang)}</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
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
    btnLabel: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
