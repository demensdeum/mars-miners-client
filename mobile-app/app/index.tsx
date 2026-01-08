import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { useRouter } from 'expo-router';
import { MarsMinersGame, PlayerRole, PlayerId } from '../src/logic/MarsMinersGame';
import { t, LOCALE } from '../src/logic/locales';
import { getLocales } from 'expo-localization';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SetupScreen() {
    const router = useRouter();
    const deviceLang = getLocales()[0]?.languageCode?.startsWith('ru') ? 'ru' : 'en';
    const [lang] = useState<'en' | 'ru'>(deviceLang);
    const [roles, setRoles] = useState<Record<PlayerId, PlayerRole>>({
        1: 'human', 2: 'ai', 3: 'none', 4: 'none'
    });
    const [weaponReq, setWeaponReq] = useState(4);
    const [allowSkip, setAllowSkip] = useState(true);


    const cycleRole = (pid: PlayerId) => {
        const opts: PlayerRole[] = ['human', 'ai', 'none'];
        setRoles(prev => ({
            ...prev,
            [pid]: opts[(opts.indexOf(prev[pid]) + 1) % opts.length]
        }));
    };

    const cycleWeaponReq = () => {
        const reqs = [3, 4, 5];
        setWeaponReq(r => reqs[(reqs.indexOf(r) + 1) % reqs.length]);
    };

    const [loaded, setLoaded] = useState(false);

    // Load defaults
    useEffect(() => {
        (async () => {
            try {
                const saved = await AsyncStorage.getItem('mm_setup_config');
                if (saved) {
                    const config = JSON.parse(saved);
                    // Do not load lang, strictly use device locale
                    if (config.roles) setRoles(config.roles);
                    if (config.weaponReq) setWeaponReq(config.weaponReq);
                    if (config.allowSkip !== undefined) setAllowSkip(config.allowSkip);
                }
            } catch (e) {
                console.log('Failed to load settings', e);
            } finally {
                setLoaded(true);
            }
        })();
    }, []);

    // Auto-save on change
    useEffect(() => {
        if (!loaded) return;
        const config = { roles, weaponReq, allowSkip };
        AsyncStorage.setItem('mm_setup_config', JSON.stringify(config)).catch(e => {
            console.log('Failed to save settings', e);
        });
    }, [loaded, roles, weaponReq, allowSkip]);

    const startGame = () => {
        // Pass config to game screen.
        router.push({
            pathname: '/game',
            params: {
                roles: JSON.stringify(roles),
                grid_size: 10,
                weapon_req: weaponReq,
                allow_skip: allowSkip ? '1' : '0',
                ai_wait: 500, // Fixed 1000ms
                lang: lang
            }
        });
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
            <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
                <Text style={styles.title}>{t('setup_title', lang)}</Text>

                <Text style={styles.sectionHeader}>{t('assign_roles', lang)}</Text>
                {[1, 2, 3, 4].map(i => {
                    const pid = i as PlayerId;
                    const role = roles[pid];
                    let roleLabel = t(role, lang);

                    return (
                        <View key={pid} style={styles.row}>
                            <Text style={styles.label}>{t('player', lang)} {pid}:</Text>
                            <TouchableOpacity onPress={() => cycleRole(pid)} style={[styles.button, styles.roleButton]}>
                                <Text style={styles.buttonText}>{roleLabel}</Text>
                            </TouchableOpacity>
                        </View>
                    );
                })}

                <View style={styles.divider} />

                <View style={styles.row}>
                    <Text style={styles.label}>{t('weapon_req', lang)}</Text>
                    <TouchableOpacity onPress={cycleWeaponReq} style={styles.button}>
                        <Text style={styles.buttonText}>{weaponReq} {t('stations', lang)}</Text>
                    </TouchableOpacity>
                </View>


                <View style={styles.spacer} />

                <TouchableOpacity onPress={() => router.push('/multiplayer')} style={styles.multiplayerButton}>
                    <Text style={styles.multiplayerButtonText}>{t('multiplayer_btn', lang)}</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={startGame} style={styles.startButton}>
                    <Text style={styles.startButtonText}>{t('local_game_btn', lang)}</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1e1e1e' },
    scrollView: { flex: 1 },
    content: { padding: 20, paddingBottom: 50 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 20, textAlign: 'center', marginTop: 20 },
    sectionHeader: { fontSize: 18, color: '#aaa', marginTop: 15, marginBottom: 10 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    label: { color: '#fff', fontSize: 16 },
    button: { backgroundColor: '#333', padding: 10, borderRadius: 8, minWidth: 100, alignItems: 'center' },
    roleButton: { minWidth: 120 },
    buttonText: { color: '#fff', fontSize: 16 },
    divider: { height: 1, backgroundColor: '#444', marginVertical: 15 },
    spacer: { height: 30 },
    multiplayerButton: { backgroundColor: '#9333ea', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
    multiplayerButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    startButton: { backgroundColor: '#4a9eff', padding: 15, borderRadius: 10, alignItems: 'center' },
    startButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' }
});
