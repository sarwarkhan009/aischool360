import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, FileText, BrainCircuit } from 'lucide-react';
import { APP_CONFIG } from '../constants/app';

import { transcribeAudioWithGemini, analyzeDataWithGemini } from '../lib/gemini';
import { getMinifiedERPData, buildDetailedSummary } from '../lib/dataMiner';
import { usePersistence } from '../hooks/usePersistence';

import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useSchool } from '../context/SchoolContext';

const AIAssistant: React.FC = () => {
    const { currentSchool } = useSchool();
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [report, setReport] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [localApiKey, setLocalApiKey] = usePersistence<string>('aischool360_gemini_api_key', '');
    const [apiKey, setApiKey] = useState<string>(localApiKey);

    useEffect(() => {
        const fetchKey = async () => {
            if (!localApiKey && currentSchool?.id) {
                try {
                    const docRef = doc(db, 'settings', `gemini_${currentSchool.id}`);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const key = docSnap.data().apiKey;
                        setApiKey(key);
                        setLocalApiKey(key);
                    }
                } catch (err) {
                    console.error("Error fetching Gemini API Key:", err);
                }
            } else {
                setApiKey(localApiKey);
            }
        };
        fetchKey();
    }, [localApiKey]);


    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        const setupRecorder = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const recorder = new MediaRecorder(stream);

                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) chunksRef.current.push(e.data);
                };

                recorder.onstop = async () => {
                    const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
                    chunksRef.current = [];

                    if (audioBlob.size > 0) {
                        setIsProcessing(true); // User Feedback: Thinking...
                        await processAudio(audioBlob);
                    } else {
                        setIsRecording(false);
                    }
                };

                mediaRecorderRef.current = recorder;
            } catch (err) {
                console.error("[AI] Microphone access denied:", err);
            }
        };

        if (!mediaRecorderRef.current) setupRecorder();

        return () => {
            if (mediaRecorderRef.current?.stream) {
                mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
            }
        };
    }, []);

    const startRecording = async () => {
        if (!apiKey) {
            alert("Please configure Gemini API Key in Settings first.");
            return;
        }
        if (!mediaRecorderRef.current) return;

        try {
            if (mediaRecorderRef.current.state === 'recording') {
                mediaRecorderRef.current.stop();
                setTimeout(() => {
                    if (mediaRecorderRef.current?.state === 'inactive') {
                        chunksRef.current = [];
                        mediaRecorderRef.current.start(100);
                        setIsRecording(true);
                    }
                }, 50);
            } else {
                chunksRef.current = [];
                mediaRecorderRef.current.start(100);
                setIsRecording(true);
            }
        } catch (err) {
            console.error("Record Start Error:", err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            setIsRecording(false);
            mediaRecorderRef.current.stop();
        }
    };

    const processAudio = async (blob: Blob) => {
        if (!apiKey) return;

        try {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                try {
                    const base64Audio = (reader.result as string).split(',')[1];

                    // 1. Transcribe (Hidden)
                    const transcription = await transcribeAudioWithGemini(base64Audio, apiKey);

                    // 2. Fetch Complete Database Context & build detailed summary
                    const raw = await getMinifiedERPData(currentSchool?.id);
                    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    const context = buildDetailedSummary(parsed);

                    // 3. Analyze with AI
                    const aiReport = await analyzeDataWithGemini(transcription, context, apiKey, currentSchool?.name || APP_CONFIG.fullName);

                    setReport(aiReport);
                    setShowModal(true);
                } catch (err: any) {
                    console.error("AI Logic Error:", err);
                    setStatusMessage(`Error: ${err.message}`);
                    setTimeout(() => setStatusMessage(null), 3000);
                } finally {
                    setIsProcessing(false);
                }
            };
        } catch (error) {
            console.error("Audio Read Error:", error);
            setIsProcessing(false);
        }
    };

    const formatMarkdown = (markdown: string | null) => {
        if (!markdown) return '';
        const lines = markdown.split(/\r?\n/);
        let htmlChunks: string[] = [];
        let inTable = false;
        let tableData: { headers: string[], rows: string[][] } = { headers: [], rows: [] };
        let inList = false;

        const processInline = (text: string) => text
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text-main); font-weight:800;">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em style="color:var(--text-muted); font-style:italic;">$1</em>');

        const renderTable = (data: typeof tableData) => {
            let html = '<div style="margin: 2rem 0; overflow-x: auto; border-radius: 1rem; border: 1px solid var(--border); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);"><table style="width: 100%; border-collapse: collapse; text-align: left;">';
            html += '<thead><tr style="background: var(--bg-main); border-bottom: 2px solid var(--border);">';
            data.headers.forEach(h => html += `<th style="padding: 1rem; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); border-right: 1px solid var(--border);">${processInline(h)}</th>`);
            html += '</tr></thead><tbody style="background: white;">';
            data.rows.forEach((row, idx) => {
                const bgStyle = idx % 2 === 0 ? 'background: #fafafa;' : 'background: white;';
                html += `<tr style="${bgStyle}">`;
                for (let j = 0; j < data.headers.length; j++) html += `<td style="padding: 0.75rem 1rem; font-size: 0.875rem; color: var(--text-main); border-right: 1px solid var(--border); border-top: 1px solid var(--border);">${processInline(row[j] || '')}</td>`;
                html += '</tr>';
            });
            html += '</tbody></table></div>';
            return html;
        };

        const flushTable = () => {
            if (inTable) {
                if (tableData.headers.length > 0) htmlChunks.push(renderTable(tableData));
                inTable = false;
                tableData = { headers: [], rows: [] };
            }
        };

        const flushList = () => {
            if (inList) { htmlChunks.push('</ul>'); inList = false; }
        };

        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let trimmed = line.trim();

            if (trimmed.includes('|')) {
                const cells = trimmed.split('|').map(c => c.trim()).filter((c, idx, arr) => {
                    if (idx === 0 && trimmed.startsWith('|') && c === '') return false;
                    if (idx === arr.length - 1 && trimmed.endsWith('|') && c === '') return false;
                    return true;
                });
                if (trimmed.includes('---')) { inTable = true; continue; }
                if (inTable) { tableData.rows.push(cells); continue; }
                else if (i < lines.length - 1 && lines[i + 1].includes('---')) { flushList(); inTable = true; tableData.headers = cells; continue; }
            }
            flushTable();

            if (trimmed.startsWith('#')) {
                flushList();
                const level = (trimmed.match(/^#+/) || ['#'])[0].length;
                const text = trimmed.replace(/^#+\s*/, '');
                const style = level === 1 ? 'font-size: 1.5rem; font-weight: 800; margin-top: 2rem; margin-bottom: 1rem; color: var(--text-main); border-bottom: 2px solid var(--border); padding-bottom: 0.5rem;' :
                    level === 2 ? 'font-size: 1.25rem; font-weight: 700; margin-top: 1.5rem; margin-bottom: 0.75rem; color: var(--text-main);' :
                        'font-size: 1.125rem; font-weight: 600; margin-top: 1rem; margin-bottom: 0.5rem; color: var(--text-main);';
                htmlChunks.push(`<h${level} style="${style}">${processInline(text)}</h${level}>`);
                continue;
            }
            if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
                if (!inList) { inList = true; htmlChunks.push('<ul style="list-style-type: disc; padding-left: 1.5rem; margin: 1rem 0; color: var(--text-muted);">'); }
                htmlChunks.push(`<li style="margin-bottom: 0.5rem;">${processInline(trimmed.substring(2))}</li>`);
                continue;
            } else { flushList(); }
            if (trimmed === '') { htmlChunks.push('<div style="height: 1rem;"></div>'); continue; }
            htmlChunks.push(`<p style="margin-bottom: 0.75rem; line-height: 1.6; color: var(--text-muted);">${processInline(line)}</p>`);
        }
        flushTable(); flushList();
        return htmlChunks.join('\n');
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow || !report) return;
        const formattedHtml = formatMarkdown(report);
        printWindow.document.write(`
             <html>
                 <head>
                      <title>{APP_CONFIG.name} Intelligence Report</title>
                     <style>
                         body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; color: #1e293b; line-height: 1.6; }
                         .container { max-width: 800px; margin: 0 auto; }
                         h1 { text-align: center; color: #0f172a; border-bottom: 3px solid #0f172a; padding-bottom: 10px; margin-bottom: 30px; text-transform: uppercase; font-weight: 900; letter-spacing: -0.05em; }
                         table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; }
                         th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
                         th { background-color: #f8fafc; font-weight: 700; color: #475569; text-transform: uppercase; font-size: 12px; }
                         tr:nth-child(even) { background-color: #f8fafc; }
                         .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #94a3b8; text-align: center; }
                     </style>
                 </head>
                 <body>
                     <div class="container">
                         <div style="text-align: center; margin-bottom: 20px;">
                            <img src="${APP_CONFIG.logo}" style="width: 100px; height: 100px; object-fit: contain;" />
                         </div>
                         <h1>${APP_CONFIG.fullName.toUpperCase()} REPORT</h1>
                         <div class="content">${formattedHtml}</div>
                         <div class="footer"><p>© ${new Date().getFullYear()} ${APP_CONFIG.name} - Automated Intelligence Report</p></div>
                     </div>
                 </body>
             </html>
         `);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    };

    const [position, setPosition] = useState(() => {
        const saved = localStorage.getItem('aischool360_ai_bubble_pos');
        try {
            return saved ? JSON.parse(saved) : { bottom: 32, right: 32 };
        } catch (e) {
            return { bottom: 32, right: 32 };
        }
    });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartPos = useRef<{ x: number, y: number, startBottom: number, startRight: number } | null>(null);
    const holdTimeout = useRef<any>(null);

    // Sync position with window size changes
    useEffect(() => {
        const handleResize = () => {
            setPosition((prev: any) => ({
                right: Math.max(10, Math.min(prev.right, window.innerWidth - 90)),
                bottom: Math.max(10, Math.min(prev.bottom, window.innerHeight - 90))
            }));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const startDrag = (clientX: number, clientY: number) => {
        dragStartPos.current = { x: clientX, y: clientY, startBottom: position.bottom, startRight: position.right };
    };

    const doDrag = (clientX: number, clientY: number) => {
        if (!dragStartPos.current) return;
        const deltaX = dragStartPos.current.x - clientX;
        const deltaY = dragStartPos.current.y - clientY;

        if (!isDragging && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
            setIsDragging(true);
            if (isRecording) stopRecording();
            clearTimeout(holdTimeout.current);
        }

        if (isDragging) {
            setPosition({
                right: Math.max(0, Math.min(window.innerWidth - 80, dragStartPos.current.startRight + deltaX)),
                bottom: Math.max(0, Math.min(window.innerHeight - 80, dragStartPos.current.startBottom + deltaY))
            });
        }
    };

    const endDrag = () => {
        if (isDragging) {
            localStorage.setItem('aischool360_ai_bubble_pos', JSON.stringify(position));
        }
        setIsDragging(false);
        dragStartPos.current = null;
    };

    return (
        <>
            <style>{`
                .hover-bounce:hover { animation: mini-bounce 1s ease-in-out infinite; }
                @keyframes mini-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                .pulse-animation::after { content: ''; position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(239, 68, 68, 0.4); animation: pulse 1.5s infinite; z-index: -1; }
                @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                @keyframes sphere-rotate {
                    0% { transform: rotate(0deg) scale(1); filter: hue-rotate(0deg); }
                    50% { transform: rotate(180deg) scale(1.1); filter: hue-rotate(180deg); }
                    100% { transform: rotate(360deg) scale(1); filter: hue-rotate(360deg); }
                }

                @keyframes earth-shift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }

                .sphere-animate {
                    animation: sphere-rotate 20s linear infinite, earth-shift 10s ease-in-out infinite;
                }
                
                .sphere-paused {
                    animation-play-state: paused;
                }
                
                .multi-color-glow {
                    background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
                    background-size: 400% 400%;
                    filter: blur(15px);
                }
            `}</style>

            <div
                className="no-print"
                style={{
                    position: 'fixed',
                    bottom: `${position.bottom}px`,
                    right: `${position.right}px`,
                    zIndex: 1001,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.75rem',
                    cursor: isDragging ? 'grabbing' : 'pointer',
                    userSelect: 'none',
                    touchAction: 'none'
                }}
            >
                {/* Status Bubble */}
                {(isRecording || isProcessing || statusMessage) && (
                    <div className="glass-card animate-slide-up" style={{
                        position: 'absolute',
                        bottom: '100px',
                        right: '0',
                        padding: '0.75rem 1.25rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)',
                        background: 'rgba(255, 255, 255, 0.9)', border: '1px solid var(--primary-glow)',
                        boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', gap: '0.5rem',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none'
                    }}>
                        {isProcessing && <Loader2 size={16} className="animate-spin" />}
                        {isRecording ? '👂 Listening...' : isProcessing ? '🧠 Thinking...' : statusMessage}
                    </div>
                )}

                {/* Helper Text */}
                {!isDragging && (
                    <span style={{
                        fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(0,0,0,0.3)',
                        pointerEvents: 'none', userSelect: 'none'
                    }}>
                        {isRecording ? 'recording' : 'push & hold'}
                    </span>
                )}

                <div
                    onMouseDown={(e) => {
                        startDrag(e.clientX, e.clientY);
                        const onMouseMove = (me: MouseEvent) => doDrag(me.clientX, me.clientY);
                        const onMouseUp = () => {
                            endDrag();
                            window.removeEventListener('mousemove', onMouseMove);
                            window.removeEventListener('mouseup', onMouseUp);
                        };
                        window.addEventListener('mousemove', onMouseMove);
                        window.addEventListener('mouseup', onMouseUp);

                        clearTimeout(holdTimeout.current);
                        holdTimeout.current = setTimeout(() => {
                            if (!isDragging) startRecording();
                        }, 50);
                    }}
                    onMouseUp={() => {
                        clearTimeout(holdTimeout.current);
                        if (!isDragging) stopRecording();
                    }}
                    onTouchStart={(e) => {
                        const touch = e.touches[0];
                        startDrag(touch.clientX, touch.clientY);
                        holdTimeout.current = setTimeout(() => {
                            if (!isDragging) startRecording();
                        }, 50);
                    }}
                    onTouchMove={(e) => {
                        const touch = e.touches[0];
                        doDrag(touch.clientX, touch.clientY);
                    }}
                    onTouchEnd={() => {
                        clearTimeout(holdTimeout.current);
                        if (!isDragging) stopRecording();
                        endDrag();
                    }}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`ai-sphere-btn ${isRecording ? 'pulse-animation' : ''}`}
                    style={{
                        width: '80px', height: '80px', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        transform: isRecording ? 'scale(1.1)' : 'scale(1)',
                        zIndex: 1001,
                        backgroundColor: '#1e1e1e',
                        border: '2px solid rgba(255,255,255,0.1)',
                        boxShadow: isRecording
                            ? '0 0 30px rgba(255, 0, 0, 0.5), 0 0 60px rgba(255, 0, 0, 0.2)'
                            : '0 15px 35px rgba(0,0,0,0.4)',
                        overflow: 'hidden'
                    }}
                >
                    {/* 1. Dynamic Rotating Core (The "Earth") */}
                    <div className={`sphere-animate ${isRecording || isDragging ? 'sphere-paused' : ''}`}
                        style={{
                            position: 'absolute',
                            top: '-50%',
                            left: '-50%',
                            right: '-50%',
                            bottom: '-50%',
                            pointerEvents: 'none',
                            opacity: isRecording || isDragging ? 0.6 : 1,
                            backgroundImage: isRecording
                                ? 'linear-gradient(-45deg, #ff3366, #ff9933, #ff3366)'
                                : 'linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab)',
                            backgroundSize: '400% 400%',
                            filter: 'blur(5px)'
                        }}
                    ></div>

                    {/* 2. Volume & Shadow Layer (Creates the 3D sphere look) */}
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        pointerEvents: 'none',
                        backgroundImage: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.3) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.8) 100%)',
                    }}
                    ></div>

                    {/* 3. Surface Glares */}
                    <div style={{ position: 'absolute', top: '15%', left: '15%', width: '25%', height: '25%', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: '50%', filter: 'blur(4px)', pointerEvents: 'none' }}></div>
                    <div style={{ position: 'absolute', top: '10%', left: '30%', width: '15%', height: '8%', backgroundColor: 'rgba(255,255,255,0.6)', borderRadius: '50%', filter: 'blur(1px)', transform: 'rotate(-20deg)', pointerEvents: 'none' }}></div>
                </div>
            </div>

            {showModal && (
                <div className="ai-report-modal-overlay">
                    <div className="glass-card animate-scale-in ai-report-modal-container">
                        <div className="ai-report-modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div className="ai-report-icon-box"><BrainCircuit size={18} /></div>
                                <h2 className="ai-report-modal-title">AI Intelligence Report</h2>
                            </div>
                            <button onClick={() => setShowModal(false)} className="btn-icon" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={24} /></button>
                        </div>
                        <div className="ai-report-modal-content">
                            {report ? <div className="markdown-body" dangerouslySetInnerHTML={{ __html: formatMarkdown(report) }} /> : <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 size={40} className="animate-spin" style={{ color: 'var(--primary)', marginBottom: '1rem' }} /><p>Gathering intelligence...</p></div>}
                        </div>
                        <div className="ai-report-modal-footer">
                            <button className="btn" style={{ border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setShowModal(false)}>Dismiss</button>
                            <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={handlePrint}><FileText size={18} /> Print Report</button>
                        </div>
                    </div>
                </div>
            )}
            <style>{`
                .hover-bounce:hover { animation: mini-bounce 1s ease-in-out infinite; }
                @keyframes mini-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                .pulse-animation::after { content: ''; position: absolute; width: 100%; height: 100%; border-radius: 50%; background: rgba(239, 68, 68, 0.4); animation: pulse 1.5s infinite; z-index: -1; }
                @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(1.6); opacity: 0; } }
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                .ai-report-modal-overlay {
                    position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); z-index: 2000;
                    display: flex; align-items: center; justify-content: center; padding: 2rem;
                }
                .ai-report-modal-container {
                    width: 95vw; max-width: 1000px; height: 85vh; display: flex; flex-direction: column;
                    background: white; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
                    border-radius: 1.5rem; border: 1px solid var(--border);
                }
                .ai-report-modal-header {
                    padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border);
                    display: flex; justify-content: space-between; align-items: center; background: white;
                }
                .ai-report-modal-title { font-size: 1.15rem; font-weight: 800; margin: 0; color: var(--text-main); }
                .ai-report-icon-box {
                    width: 36px; height: 36px; border-radius: 10px; background: var(--primary);
                    color: white; display: flex; align-items: center; justify-content: center;
                }
                .ai-report-modal-content { padding: 2rem; overflow-y: auto; flex: 1; background: #fff; }
                .ai-report-modal-footer {
                    padding: 1.25rem 1.5rem; border-top: 1px solid var(--border);
                    display: flex; justify-content: flex-end; gap: 1rem; background: var(--bg-main);
                }

                @media (max-width: 768px) {
                    .ai-report-modal-overlay { padding: 0.5rem; }
                    .ai-report-modal-container { 
                        width: 100%; height: 98vh; border-radius: 1rem;
                        max-width: none;
                    }
                    .ai-report-modal-header { padding: 1rem; }
                    .ai-report-modal-title { font-size: 1rem; }
                    .ai-report-modal-content { padding: 1.25rem 1rem; }
                    .ai-report-modal-footer { padding: 1rem; flex-direction: column-reverse; gap: 0.75rem; }
                    .ai-report-modal-footer button { width: 100%; justify-content: center; height: 48px; }
                }

                @media (max-width: 480px) {
                    .ai-report-modal-overlay { padding: 0; }
                    .ai-report-modal-container { height: 100vh; border-radius: 0; border: none; }
                }

                @media (max-width: 768px) {
                    .ai-sphere-btn {
                        width: 60px !important;
                        height: 60px !important;
                    }
                }
            `}</style>
        </>
    );
};

export default AIAssistant;
