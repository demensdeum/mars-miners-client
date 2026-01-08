import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLocales } from 'expo-localization';
import * as Clipboard from 'expo-clipboard';
import { multiplayerService } from '../src/logic/MultiplayerService';
import { t } from '../src/logic/locales';
import { PlayerId, PlayerRole } from '../src/logic/MarsMinersGame';

export default function MultiplayerScreen() {
    const router = useRouter();
    const deviceLang = getLocales()[0]?.languageCode?.startsWith('ru') ? 'ru' : 'en';
    const [lang] = useState<'en' | 'ru'>(deviceLang);

    const [serverUrl, setServerUrl] = useState('');
    const [battleID, setBattleID] = useState('');
    const [sessionID, setSessionID] = useState('');
    const [joinBattleID, setJoinBattleID] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isCreated, setIsCreated] = useState(false);
    const [players, setPlayers] = useState<string[]>([]);

    useEffect(() => {
        let text = serverUrl;
        if (!text) text = multiplayerService.getServerUrl();
        setServerUrl(text);
    }, []);

    // Poll for player updates
    useEffect(() => {
        if (!isCreated || !battleID || !sessionID) return;

        const interval = setInterval(async () => {
            try {
                // We use getBattleSession which essentially calls joinBattle again
                // This returns the latest battle session data including players list
                const session = await multiplayerService.getBattleSession(sessionID, battleID);
                if (session && session.players) {
                    setPlayers(session.players);
                }
            } catch (e) {
                console.log("Polling error", e);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [isCreated, battleID, sessionID]);

    const handleServerUrlChange = async (url: string) => {
        setServerUrl(url);
        await multiplayerService.setServerUrl(url);
    };

    const handleCreateBattle = async () => {
        if (!serverUrl.trim()) {
            Alert.alert('Error', 'Please enter server URL');
            return;
        }

        setIsLoading(true);
        try {
            const mySessionID = await multiplayerService.getOrGenerateSessionID();
            setSessionID(mySessionID);

            const response = await multiplayerService.createAndJoinBattle(mySessionID);
            setBattleID(response.battleID);
            setIsCreated(true);
            setPlayers(response.battleSession.players);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to create battle');
        } finally {
            setIsLoading(false);
        }
    };

    const handleJoinBattle = async () => {
        if (!serverUrl.trim()) {
            Alert.alert('Error', 'Please enter server URL');
            return;
        }

        if (!joinBattleID.trim()) {
            Alert.alert('Error', t('enter_battle_id', lang));
            return;
        }

        setIsLoading(true);
        try {
            const mySessionID = await multiplayerService.getOrGenerateSessionID();
            setSessionID(mySessionID);

            // First create a session for this player
            await multiplayerService.createBattle(mySessionID);

            // Then join the specified battle
            const response = await multiplayerService.joinBattle(mySessionID, joinBattleID);
            setBattleID(joinBattleID);
            setIsCreated(true);
            setPlayers(response.battleSession.players);
        } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to join battle');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopyBattleID = async () => {
        await Clipboard.setStringAsync(battleID);
        Alert.alert('Success', 'Battle ID copied to clipboard!');
    };

    const handleStartBattle = () => {
        // Determine player roles based on player count
        const count = players.length;
        // For multiplayer, we'll use human for joined players and none for others
        const roles: Record<PlayerId, PlayerRole> = {
            1: 'human',
            2: count >= 2 ? 'human' : 'none',
            3: count >= 3 ? 'human' : 'none',
            4: count >= 4 ? 'human' : 'none'
        };

        const myIndex = players.indexOf(sessionID);
        const myPlayerId = (myIndex !== -1 ? myIndex + 1 : 1);

        router.push({
            pathname: '/game',
            params: {
                roles: JSON.stringify(roles),
                grid_size: 10,
                weapon_req: 4,
                allow_skip: '0',
                ai_wait: 0,
                lang: lang,
                isMultiplayer: '1',
                sessionID: sessionID,
                battleID: battleID,
                myPlayerId: myPlayerId.toString()
            }
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Text style={styles.backText}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.title}>{t('multiplayer_title', lang)}</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.section}>
                    <Text style={styles.label}>{t('server_url', lang)}</Text>
                    <TextInput
                        style={styles.input}
                        value={serverUrl}
                        onChangeText={handleServerUrlChange}
                        placeholder="http://localhost:3000"
                        placeholderTextColor="#666"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!isCreated}
                    />
                </View>

                {!isCreated ? (
                    <>
                        <TouchableOpacity
                            style={[styles.button, styles.primaryButton]}
                            onPress={handleCreateBattle}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>{t('create_battle', lang)}</Text>
                            )}
                        </TouchableOpacity>

                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>OR</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <View style={styles.section}>
                            <Text style={styles.label}>{t('enter_battle_id', lang)}</Text>
                            <TextInput
                                style={styles.input}
                                value={joinBattleID}
                                onChangeText={setJoinBattleID}
                                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                placeholderTextColor="#666"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.button, styles.secondaryButton]}
                            onPress={handleJoinBattle}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.buttonText}>{t('join_battle', lang)}</Text>
                            )}
                        </TouchableOpacity>
                    </>
                ) : (
                    <>
                        <View style={styles.successBox}>
                            <Text style={styles.successTitle}>{t('battle_created', lang)}</Text>
                            <Text style={styles.successSubtitle}>{t('share_id', lang)}</Text>

                            <View style={styles.battleIDContainer}>
                                <Text style={styles.battleIDText}>{battleID}</Text>
                                <TouchableOpacity
                                    style={styles.copyButton}
                                    onPress={handleCopyBattleID}
                                >
                                    <Text style={styles.copyButtonText}>{t('copy_battle_id', lang)}</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.playerCountText}>
                                {t('players_joined', lang, { count: players.length })}
                            </Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.button, styles.startButton, players.length < 2 && styles.disabledButton]}
                            onPress={handleStartBattle}
                            disabled={players.length < 2}
                        >
                            <Text style={styles.buttonText}>{t('start_battle', lang)}</Text>
                        </TouchableOpacity>

                        {players.length < 2 && (
                            <Text style={styles.waitingText}>{t('waiting_for_players', lang)}</Text>
                        )}
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1e1e1e'
    },
    scrollView: {
        flex: 1
    },
    content: {
        padding: 20,
        paddingBottom: 50
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 30
    },
    backBtn: {
        padding: 10
    },
    backText: {
        color: '#fff',
        fontSize: 24
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center'
    },
    section: {
        marginBottom: 20
    },
    label: {
        color: '#aaa',
        fontSize: 14,
        marginBottom: 8
    },
    input: {
        backgroundColor: '#333',
        color: '#fff',
        padding: 15,
        borderRadius: 8,
        fontSize: 16
    },
    button: {
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginVertical: 10
    },
    primaryButton: {
        backgroundColor: '#4a9eff'
    },
    secondaryButton: {
        backgroundColor: '#5a5a5a'
    },
    startButton: {
        backgroundColor: '#4ade80'
    },
    disabledButton: {
        backgroundColor: '#444',
        opacity: 0.5
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold'
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 20
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#444'
    },
    dividerText: {
        color: '#666',
        marginHorizontal: 15,
        fontSize: 14
    },
    successBox: {
        backgroundColor: '#2a4a2a',
        padding: 20,
        borderRadius: 10,
        marginVertical: 20,
        borderWidth: 2,
        borderColor: '#4ade80'
    },
    successTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#4ade80',
        textAlign: 'center',
        marginBottom: 10
    },
    successSubtitle: {
        fontSize: 14,
        color: '#aaa',
        textAlign: 'center',
        marginBottom: 15
    },
    battleIDContainer: {
        backgroundColor: '#1e1e1e',
        padding: 15,
        borderRadius: 8,
        marginBottom: 15
    },
    battleIDText: {
        color: '#fff',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 10,
        fontFamily: 'monospace'
    },
    copyButton: {
        backgroundColor: '#4a9eff',
        padding: 10,
        borderRadius: 6,
        alignItems: 'center'
    },
    copyButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold'
    },
    playerCountText: {
        color: '#4ade80',
        fontSize: 16,
        textAlign: 'center',
        fontWeight: 'bold'
    },
    waitingText: {
        color: '#aaa',
        fontSize: 14,
        textAlign: 'center',
        fontStyle: 'italic',
        marginTop: 10
    }
});
