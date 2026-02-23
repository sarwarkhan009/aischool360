import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader2, Phone } from 'lucide-react';
import { connectLiveSession, MicCapture, AudioPlayer } from '../lib/geminiLive';
import type { LiveSession } from '../lib/geminiLive';
import { getMinifiedERPData, buildVoiceSummary } from '../lib/dataMiner';
import { usePersistence } from '../hooks/usePersistence';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useSchool } from '../context/SchoolContext';
import { APP_CONFIG } from '../constants/app';

type SessionState = 'idle' | 'connecting' | 'active';

const VoiceLiveAssistant: React.FC = () => {
    const { currentSchool } = useSchool();
    const [state, setState] = useState<SessionState>('idle');
    const [localApiKey] = usePersistence<string>('aischool360_gemini_api_key', '');
    const [apiKey, setApiKey] = useState<string>(localApiKey);
    const [elapsed, setElapsed] = useState(0);

    const sessionRef = useRef<LiveSession | null>(null);
    const micRef = useRef<MicCapture | null>(null);
    const playerRef = useRef<AudioPlayer | null>(null);
    const timerRef = useRef<any>(null);

    // Fetch API key from Firestore if not in localStorage
    useEffect(() => {
        const fetchKey = async () => {
            if (!localApiKey && currentSchool?.id) {
                try {
                    const docRef = doc(db, 'settings', `gemini_${currentSchool.id}`);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setApiKey(docSnap.data().apiKey);
                    }
                } catch (err) {
                    console.error('[VoiceLive] Error fetching API key:', err);
                }
            } else {
                setApiKey(localApiKey);
            }
        };
        fetchKey();
    }, [localApiKey, currentSchool?.id]);

    const startSession = useCallback(async () => {
        if (!apiKey) {
            alert('Please configure Gemini API Key in Settings first.');
            return;
        }

        setState('connecting');
        setElapsed(0);

        // Connection timeout — if not connected in 15 sec, abort
        const connectTimeout = setTimeout(() => {
            console.warn('[VoiceLive] Connection timeout (15s)');
            if (sessionRef.current) sessionRef.current.close();
            cleanupSession();
            alert('Voice connection timed out. Please try again.');
        }, 15000);

        try {
            // 1. Build compact school data summary
            let dataSummary = 'No school data available.';
            try {
                const raw = await getMinifiedERPData(currentSchool?.id);
                // getMinifiedERPData returns a JSON string, parse it
                const context = typeof raw === 'string' ? JSON.parse(raw) : raw;
                dataSummary = buildVoiceSummary(context);
                console.log(`[VoiceLive] Data summary: ${dataSummary.length} chars`);
                console.log(`[VoiceLive] Data preview:`, dataSummary.substring(0, 300));
            } catch (err) {
                console.warn('[VoiceLive] Failed to fetch ERP data:', err);
            }

            // 2. System instruction WITH data summary embedded
            const systemPrompt = `You are a voice AI Assistant for "${currentSchool?.name || APP_CONFIG.fullName}".
You talk to school administrators and teachers. Respond in Hinglish (Hindi+English mix).
Give CONCISE verbal answers (1-3 sentences max). Do NOT read out lists — summarize verbally.
Be warm, helpful and professional. If data is not available, say so.
Answer ONLY based on the school data below. Do NOT make up numbers.

SCHOOL DATA:
${dataSummary}`;

            console.log(`[VoiceLive] System prompt: ${systemPrompt.length} chars`);

            // 3. Create audio player
            playerRef.current = new AudioPlayer();

            // 4. Connect to Gemini Live API
            const session = await connectLiveSession(apiKey, systemPrompt, {
                onConnected: () => {
                    clearTimeout(connectTimeout);
                    console.log('[VoiceLive] ✅ Connected!');
                    setState('active');

                    // Start elapsed timer
                    timerRef.current = setInterval(() => {
                        setElapsed(prev => prev + 1);
                    }, 1000);

                    // Start mic capture
                    const mic = new MicCapture();
                    mic.onPcmChunk = (base64) => {
                        sessionRef.current?.sendAudio(base64);
                    };
                    mic.start().catch(err => {
                        console.error('[VoiceLive] Mic error:', err);
                        alert('Microphone access denied');
                        stopSession();
                    });
                    micRef.current = mic;
                },
                onDisconnected: () => {
                    clearTimeout(connectTimeout);
                    console.log('[VoiceLive] Disconnected');
                    cleanupSession();
                },
                onError: (error) => {
                    clearTimeout(connectTimeout);
                    console.error('[VoiceLive] Error:', error);
                    cleanupSession();
                },
                onAudioChunk: (pcmBase64) => {
                    playerRef.current?.addChunk(pcmBase64);
                },
                onInterrupted: () => {
                    playerRef.current?.clearQueue();
                }
            });

            sessionRef.current = session;

        } catch (err: any) {
            clearTimeout(connectTimeout);
            console.error('[VoiceLive] Start error:', err);
            alert('Failed to start voice session: ' + err.message);
            cleanupSession();
        }
    }, [apiKey, currentSchool]);

    const cleanupSession = useCallback(() => {
        setState('idle');
        setElapsed(0);

        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        if (micRef.current) {
            micRef.current.stop();
            micRef.current = null;
        }
        if (playerRef.current) {
            playerRef.current.destroy();
            playerRef.current = null;
        }
        sessionRef.current = null;
    }, []);

    const stopSession = useCallback(() => {
        if (sessionRef.current) {
            sessionRef.current.close();
        }
        cleanupSession();
    }, [cleanupSession]);

    const toggleSession = useCallback(() => {
        if (state === 'idle') {
            startSession();
        } else {
            stopSession();
        }
    }, [state, startSession, stopSession]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (sessionRef.current) sessionRef.current.close();
            cleanupSession();
        };
    }, []);

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <>
            <style>{`
                @keyframes voice-pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.5); }
                    50% { box-shadow: 0 0 0 12px rgba(34, 197, 94, 0); }
                }
                @keyframes voice-ring {
                    0% { transform: scale(1); opacity: 0.6; }
                    100% { transform: scale(1.8); opacity: 0; }
                }
                .voice-btn-active {
                    animation: voice-pulse 1.5s infinite;
                }
                .voice-ring-animate::after {
                    content: '';
                    position: absolute;
                    inset: -4px;
                    border-radius: 50%;
                    border: 2px solid rgba(34, 197, 94, 0.6);
                    animation: voice-ring 2s infinite;
                }
                @media (max-width: 768px) {
                    .voice-live-btn {
                        width: 40px !important;
                        height: 40px !important;
                    }
                }
            `}</style>

            <div className="no-print" style={{
                position: 'fixed',
                bottom: '40px',
                right: '120px',
                zIndex: 1001,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem'
            }}>
                {/* Status label */}
                {state !== 'idle' && (
                    <div style={{
                        background: state === 'active' ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        color: 'white',
                        padding: '0.25rem 0.75rem',
                        borderRadius: '1rem',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none'
                    }}>
                        {state === 'connecting' && <Loader2 size={12} className="animate-spin" />}
                        {state === 'active' && <Phone size={10} />}
                        {state === 'connecting' ? 'Connecting...' : `LIVE ${formatTime(elapsed)}`}
                    </div>
                )}

                {/* Mic Button */}
                <button
                    className={`voice-live-btn ${state === 'active' ? 'voice-btn-active voice-ring-animate' : ''}`}
                    onClick={toggleSession}
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        border: 'none',
                        cursor: state === 'connecting' ? 'wait' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        background: state === 'active'
                            ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                            : state === 'connecting'
                                ? 'linear-gradient(135deg, #6366f1, #4f46e5)'
                                : 'linear-gradient(135deg, #1e293b, #334155)',
                        color: 'white',
                        boxShadow: state === 'active'
                            ? '0 0 20px rgba(34, 197, 94, 0.5), 0 8px 25px rgba(0,0,0,0.3)'
                            : '0 8px 25px rgba(0,0,0,0.3)',
                        transform: state === 'active' ? 'scale(1.05)' : 'scale(1)'
                    }}
                    disabled={state === 'connecting'}
                    title={state === 'idle' ? 'Start Voice Chat' : 'Stop Voice Chat'}
                >
                    {state === 'connecting' ? (
                        <Loader2 size={22} className="animate-spin" />
                    ) : state === 'active' ? (
                        <MicOff size={22} />
                    ) : (
                        <Mic size={22} />
                    )}
                </button>
            </div>
        </>
    );
};

export default VoiceLiveAssistant;
