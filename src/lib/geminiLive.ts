/**
 * Gemini Live API — Using Official @google/genai SDK
 * Real-time voice-to-voice conversation using Gemini's native audio model.
 */

import { GoogleGenAI, Modality } from '@google/genai';

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';

export interface LiveSessionCallbacks {
    onConnected: () => void;
    onDisconnected: () => void;
    onError: (error: string) => void;
    onAudioChunk: (pcmBase64: string) => void;
    onInterrupted: () => void;
}

export interface LiveSession {
    sendAudio: (pcmBase64: string) => void;
    sendText: (text: string) => void;
    close: () => void;
    isConnected: () => boolean;
}

export async function connectLiveSession(
    apiKey: string,
    systemInstruction: string,
    callbacks: LiveSessionCallbacks
): Promise<LiveSession> {
    let connected = false;
    let session: any = null;

    try {
        const ai = new GoogleGenAI({ apiKey });

        console.log('[GeminiLive] Connecting with SDK...');

        session = await ai.live.connect({
            model: LIVE_MODEL,
            config: {
                responseModalities: [Modality.AUDIO],
                systemInstruction: systemInstruction,
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: 'Aoede'
                        }
                    }
                }
            },
            callbacks: {
                onopen: () => {
                    console.log('[GeminiLive] ✅ Session opened');
                    connected = true;
                    callbacks.onConnected();
                },
                onmessage: (message: any) => {
                    // Handle interruption
                    if (message.serverContent?.interrupted) {
                        console.log('[GeminiLive] Interrupted');
                        callbacks.onInterrupted();
                        return;
                    }

                    // Handle audio chunks
                    if (message.serverContent?.modelTurn?.parts) {
                        for (const part of message.serverContent.modelTurn.parts) {
                            if (part.inlineData?.data) {
                                callbacks.onAudioChunk(part.inlineData.data);
                            }
                        }
                    }
                },
                onerror: (e: any) => {
                    console.error('[GeminiLive] Error:', e.message || e);
                    callbacks.onError(e.message || 'Connection error');
                },
                onclose: (e: any) => {
                    console.log('[GeminiLive] Closed:', e.reason || 'unknown');
                    connected = false;
                    callbacks.onDisconnected();
                }
            }
        });

        console.log('[GeminiLive] Session object created');

    } catch (err: any) {
        console.error('[GeminiLive] Connection failed:', err);
        callbacks.onError(err.message || 'Failed to connect');
        return {
            sendAudio: () => { },
            sendText: () => { },
            close: () => { },
            isConnected: () => false
        };
    }

    return {
        sendAudio: (pcmBase64: string) => {
            if (!session || !connected) return;
            try {
                session.sendRealtimeInput({
                    audio: {
                        data: pcmBase64,
                        mimeType: 'audio/pcm;rate=16000'
                    }
                });
            } catch (err) {
                console.error('[GeminiLive] sendAudio error:', err);
            }
        },

        sendText: (text: string) => {
            if (!session || !connected) return;
            try {
                session.send({ text });
                console.log('[GeminiLive] Text sent:', text.length, 'chars');
            } catch (err) {
                console.error('[GeminiLive] sendText error:', err);
            }
        },

        close: () => {
            connected = false;
            if (session) {
                try { session.close(); } catch (e) { }
                session = null;
            }
        },

        isConnected: () => connected
    };
}

/**
 * Mic capture → PCM 16kHz mono 16-bit
 */
export class MicCapture {
    private audioContext: AudioContext | null = null;
    private stream: MediaStream | null = null;
    private source: MediaStreamAudioSourceNode | null = null;
    private processor: ScriptProcessorNode | null = null;
    public onPcmChunk: ((base64: string) => void) | null = null;

    async start(): Promise<void> {
        this.stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        this.audioContext = new AudioContext({ sampleRate: 16000 });
        this.source = this.audioContext.createMediaStreamSource(this.stream);

        // Use ScriptProcessorNode (widely supported)
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        this.processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);

            // Convert Float32 → Int16 PCM
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }

            // Convert to base64
            const bytes = new Uint8Array(pcm16.buffer);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = btoa(binary);

            if (this.onPcmChunk) {
                this.onPcmChunk(base64);
            }
        };

        this.source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);
    }

    stop(): void {
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        if (this.source) {
            this.source.disconnect();
            this.source = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
        }
    }
}

/**
 * Audio playback from PCM chunks (24kHz)
 */
export class AudioPlayer {
    private audioContext: AudioContext | null = null;
    private queue: Float32Array[] = [];
    private nextStartTime = 0;

    constructor() {
        this.audioContext = new AudioContext({ sampleRate: 24000 });
    }

    addChunk(pcmBase64: string): void {
        if (!this.audioContext) return;

        // Decode base64 → Int16 PCM → Float32
        const binaryStr = atob(pcmBase64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }
        const int16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i++) {
            float32[i] = int16[i] / 0x8000;
        }

        this.queue.push(float32);
        this.playNext();
    }

    private playNext(): void {
        if (!this.audioContext || this.queue.length === 0) return;

        const chunk = this.queue.shift()!;
        const buffer = this.audioContext.createBuffer(1, chunk.length, 24000);
        buffer.getChannelData(0).set(chunk);

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioContext.destination);

        const currentTime = this.audioContext.currentTime;
        const startTime = Math.max(currentTime, this.nextStartTime);
        source.start(startTime);
        this.nextStartTime = startTime + buffer.duration;

        source.onended = () => {
            if (this.queue.length > 0) {
                this.playNext();
            }
        };
    }

    clearQueue(): void {
        this.queue = [];
        this.nextStartTime = 0;
    }

    destroy(): void {
        this.clearQueue();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}
