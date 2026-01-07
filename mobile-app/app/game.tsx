import React, { useRef, useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Alert, Dimensions, FlatList, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MarsMinersGame, PlayerId, PlayerRole } from '../src/logic/MarsMinersGame';
import { t } from '../src/logic/locales';

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



    // Rendering Helpers
    const weaponCells = highlight ? game.getWeaponCells() : new Set();
    const cellSize = game.size === 10 ? 34 : (game.size === 15 ? 22 : 16); // Adjusted for mobile screen width roughly

    const renderCell = ({ item, index }: { item: string, index: number }) => {
        // FlatList data will be flattened grid? Or we render rows?
        // Let's flatten grid for FlatList.
        // Actually FlatList with numColumns is easier.
        // item is cell content. index gives us r, c.
        const r = Math.floor(index / game.size);
        const c = index % game.size;

        const isWeaponPart = weaponCells.has(`${r},${c}`);

        let bgColor = '#1e1e1e';
        if (isWeaponPart) bgColor = '#504614';

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
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBack} style={styles.backBtn}><Text style={styles.btnText}>←</Text></TouchableOpacity>
                <Text style={styles.headerTitle} numberOfLines={2}>{statusText}</Text>
                <View style={{ width: 40 }} />
            </View>

            <View style={styles.contentRow}>
                <View style={styles.gridContainer}>
                    <FlatList
                        data={flatGrid}
                        renderItem={renderCell}
                        keyExtractor={(_, i) => i.toString()}
                        numColumns={game.size}
                        key={game.size}
                        scrollEnabled={false}
                    />
                </View>

                <View style={styles.sidePanel}>
                    <Text style={styles.panelTitle}>{t('build_mode', game.lang)}</Text>

                    <TouchableOpacity
                        style={[styles.cBtn, buildMode === 'st' ? styles.activeBtn : {}]}
                        onPress={() => setBuildMode('st')}
                        disabled={!isHumanTurn}
                    >
                        <Text style={styles.cBtnText}>{t('station_btn', game.lang)}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.cBtn, buildMode === 'mi' ? styles.activeBtn : {}]}
                        onPress={() => setBuildMode('mi')}
                        disabled={!isHumanTurn}
                    >
                        <Text style={styles.cBtnText}>{t('mine_btn', game.lang)}</Text>
                    </TouchableOpacity>


                    <View style={styles.divider} />

                    {/* Scores */}
                    <View style={styles.scores}>
                        {[1, 2, 3, 4].map(pid => {
                            const id = pid as PlayerId;
                            if (game.roles[id] === 'none') return null;
                            const score = game.getScores()[id] || 0;
                            const isLost = game.player_lost[id];
                            return (
                                <Text key={id} style={{ color: isLost ? '#666' : game.players[id].color, fontSize: 12, marginBottom: 4 }}>
                                    {game.players[id].name}: {score}
                                </Text>
                            );
                        })}
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212', paddingTop: 40 },
    header: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: 10, marginBottom: 10, height: 60, borderBottomWidth: 1, borderBottomColor: '#333' },
    backBtn: { padding: 10 },
    btnText: { color: '#fff', fontSize: 24 },
    headerTitle: { flex: 1, color: '#fff', textAlign: 'center', fontSize: 14 },

    contentRow: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },

    gridContainer: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingTop: 20 },
    cell: { borderWidth: 1, borderColor: '#333', alignItems: 'center', justifyContent: 'center' },

    sidePanel: { flex: 1, backgroundColor: '#1a1a1a', height: '100%', padding: 15, borderLeftWidth: 1, borderLeftColor: '#333', alignItems: 'center' },
    panelTitle: { color: '#aaa', fontSize: 12, marginBottom: 10, alignSelf: 'flex-start' },

    cBtn: { backgroundColor: '#333', padding: 12, borderRadius: 5, width: '100%', alignItems: 'center', marginBottom: 10 },
    activeBtn: { backgroundColor: '#007AFF' },
    cBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

    skipBtn: { backgroundColor: '#444', padding: 10, borderRadius: 5, alignItems: 'center', width: '100%' },

    divider: { width: '100%', height: 1, backgroundColor: '#333', marginVertical: 20 },
    scores: { width: '100%' }
});
