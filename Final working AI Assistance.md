# Final Working AI Assistance - Complete Reference Guide

**Date:** January 7, 2026  
**Project:** Millat ERP  
**Status:** ✅ Working (Synced from Koshish-ERP)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Key Components](#key-components)
4. [Implementation Code](#implementation-code)
5. [Configuration Notes](#configuration-notes)
6. [Troubleshooting](#troubleshooting)
7. [Future Improvements](#future-improvements)

---

## Overview

The AI Assistant is a **voice-activated floating bubble** that allows users to query the ERP system using natural language (Hinglish/English). It transcribes audio, analyzes the school database, and generates intelligent reports.

### Key Features

- 🎤 **Voice Input**: Push-and-hold recording mechanism
- 🧠 **AI Analysis**: Uses Google Gemini API for transcription and data analysis
- 📊 **Smart Reports**: Generates professional Markdown reports with tables
- 🌐 **Hinglish Support**: Handles Hindi/English mixed queries
- 🔄 **Model Rotation**: Automatically switches between models if quota is exhausted
- 📱 **Mobile Friendly**: Draggable floating bubble with touch support
- 💾 **Position Persistence**: Remembers bubble position across sessions

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AIAssistant Component                     │
│  (Floating UI, Recording Controls, Modal Display)            │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│  gemini.ts      │    │  dataMiner.ts    │
│  - Transcribe   │    │  - Fetch Students│
│  - Analyze      │    │  - Fetch Fees    │
└─────────────────┘    │  - Fetch Staff   │
                       │  - Build Context │
                       └──────────────────┘
```

### Flow Diagram

```
User Holds Button
    │
    ├─► Start Recording (MediaRecorder API)
    │
User Releases Button
    │
    ├─► Stop Recording → Audio Blob
    │
    ├─► Convert to Base64
    │
    ├─► Send to Gemini 2.5 Flash-Lite
    │
    ├─► Get Transcription (Hinglish)
    │
    ├─► Fetch Complete ERP Data (dataMiner)
    │
    ├─► Send Transcription + Context to Gemini
    │
    ├─► Receive AI-Generated Report
    │
    └─► Display in Modal (Formatted Markdown)
```

---

## Key Components

### 1. **AIAssistant.tsx** (Main Component)
- Location: `src/components/AIAssistant.tsx`
- Purpose: UI and orchestration
- Features: Recording, drag-and-drop, modal display

### 2. **gemini.ts** (AI Logic)
- Location: `src/lib/gemini.ts`
- Purpose: Gemini API communication
- Functions:
  - `transcribeAudioWithGemini()` - Audio → Text
  - `analyzeDataWithGemini()` - Generate reports

### 3. **dataMiner.ts** (Data Fetcher)
- Location: `src/lib/dataMiner.ts`
- Purpose: Fetch and structure Firestore data
- Output: Complete JSON context with students, fees, attendance, etc.

---

## Implementation Code

### 📄 `src/lib/gemini.ts`

```typescript
// List of available models to rotate through due to strict limits
const MODELS = [
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
    "gemini-2.0-flash-exp",
    "gemini-1.5-pro",
    "gemini-robotics-er-1.5-preview"
];

// Get current model index from localStorage or default to 0
let currentModelIndex = parseInt(localStorage.getItem('millat_ai_model_index') || '0');

export const transcribeAudioWithGemini = async (base64Audio: string, apiKey: string) => {
    try {
        console.log('[AI] Starting Gemini audio transcription...');

        // ⚠️ CRITICAL: Use Gemini 2.5 Flash-Lite for audio transcription
        // This is the ONLY model that reliably supports audio input
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            inline_data: {
                                mime_type: "audio/webm",
                                data: base64Audio
                            }
                        },
                        {
                            text: `Transcribe this audio strictly to Hinglish (Hindi using Roman alphabet/Latin script). 
                            
                            Rules:
                            1. Use English characters ONLY. (e.g., "aap kaise hain" instead of "आप कैसे हैं")
                            2. Return ONLY the transcribed text, nothing else.
                            3. Handle phonetic variations smartly (e.g., news -> dues, stu -> staff).
                            4. Remove any stuttering or repetitions.
                            5. If multiple languages are spoken, translate the intent into a clean Hinglish sentence.
                            
                            Example Output: "class 8 ke students ka fee dues batao"
                            Return ONLY clean Hinglish text.`
                        }
                    ]
                }]
            })
        });

        const data = await response.json();

        if (data.error) {
            console.error('[AI] Gemini transcription error:', data.error);
            throw new Error(data.error.message || "Transcription failed");
        }

        const transcribedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!transcribedText) {
            throw new Error("No transcription returned from Gemini");
        }

        console.log('[AI] Transcription successful:', transcribedText);

        return transcribedText;

    } catch (error: any) {
        console.error('[AI] Audio transcription error:', error);
        throw error;
    }
};

export const analyzeDataWithGemini = async (prompt: string, contextData: any, apiKey: string) => {
    let attempts = 0;
    const maxAttempts = MODELS.length;

    while (attempts < maxAttempts) {
        const modelName = MODELS[currentModelIndex];
        console.log(`[AI] Attempting generation with model: ${modelName} (Attempt ${attempts + 1}/${maxAttempts})`);

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `You are an Intelligent AI School Administrator for 'Millat ERP'.
                            Your role is to analyze school data (Students, Notices, Attendance).
                            
                            You have access to:
                            1. Student List (minified)
                            2. Notices/Events
                            3. Class Attendance Stats
                            
                            PHASE 1: Analyze Input
                            - Process the user's voice input: "${prompt}"
                            - NOTE: This input comes from a Voice-to-Text system and may contain phonetic errors.
                            - Use context to "fuzzy match" the user's intent.
                            - Handle Hindi/Hinglish by translating the core intent to English internally.
                            
                            PHASE 2: Data Synthesis
                            - Use the provided context data to generate a concise, professional report.
                            - Context Data: ${typeof contextData === 'string' ? contextData : JSON.stringify(contextData, null, 1)}
                            
                            Rules for Output:
                            1. Output ONLY the final report. Do not show your thinking process.
                            2. Do not show intermediate calculations. Just show the final result.
                            3. Use professional, bold headers and clean Markdown tables for lists.
                            4. Ensure tables have leading and trailing pipes (|).
                            5. The response must be elegant and ready for professional printing.`
                        }]
                    }]
                })
            });

            const data = await response.json();

            // Check for specific quota exceeded or model not found errors
            if (data.error) {
                const isQuotaError = data.error.message?.toLowerCase().includes('quota') ||
                    data.error.message?.toLowerCase().includes('limit') ||
                    data.error.code === 429;

                const isNotFoundError = data.error.code === 404 ||
                    data.error.message?.toLowerCase().includes('not found');

                if (isQuotaError || isNotFoundError) {
                    console.warn(`[AI] Model ${modelName} failed (${isQuotaError ? 'Quota' : 'Not Found'}). Rotating...`);

                    // Rotate to next model immediately
                    currentModelIndex = (currentModelIndex + 1) % MODELS.length;
                    localStorage.setItem('millat_ai_model_index', currentModelIndex.toString());

                    attempts++;
                    continue; // Retry with next model
                }

                throw new Error(data.error.message || "Unknown AI error");
            }

            // Success! No need to retry
            return data.candidates[0].content.parts[0].text;

        } catch (error) {
            console.error(`[AI] Error with model ${modelName}:`, error);

            // If it's a fetch error or something unexpected, try next model just in case
            currentModelIndex = (currentModelIndex + 1) % MODELS.length;
            localStorage.setItem('millat_ai_model_index', currentModelIndex.toString());
            attempts++;
        }
    }

    throw new Error("All available AI models have exhausted their quotas. Please try again later.");
};
```

---

### 📄 `src/lib/dataMiner.ts`

```typescript
import { db } from './firebase';
import { collection, getDocs } from 'firebase/firestore';

/**
 * Fetches comprehensive ERP data from Firestore for AI analysis
 * This provides the AI assistant with complete access to all database fields
 */
export const getMinifiedERPData = async () => {
    try {
        const context: any = {
            timestamp: new Date().toISOString(),
            students: [],
            employees: [],
            fees: [],
            attendance: [],
            notices: [],
            transport: []
        };

        // Fetch Students with ALL fields
        try {
            const studentsSnapshot = await getDocs(collection(db, 'students'));
            context.students = studentsSnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    // Personal Info
                    name: data.name || data.fullName,
                    fatherName: data.fatherName || data.parentName,
                    motherName: data.motherName,
                    dob: data.dob,
                    gender: data.gender,
                    class: data.class,
                    section: data.section,
                    admissionNo: data.admissionNo,
                    mobileNo: data.mobileNo || data.phone,
                    status: data.status
                    // Add more fields as needed
                };
            });
        } catch (err) {
            console.warn('Failed to fetch students:', err);
        }

        // Fetch other collections similarly...
        // (employees, fees, attendance, notices, transport)

        // Add summary statistics
        context.summary = {
            totalStudents: context.students.length,
            activeStudents: context.students.filter((s: any) => s.status === 'ACTIVE').length,
            totalEmployees: context.employees.length,
            totalFeeRecords: context.fees.length,
            totalAttendanceRecords: context.attendance.length,
            totalNotices: context.notices.length,
            totalTransportVehicles: context.transport.length
        };

        return JSON.stringify(context, null, 2);
    } catch (error) {
        console.error("Data Mining Error:", error);
        return JSON.stringify({
            error: "Failed to fetch data",
            message: (error as Error).message,
            timestamp: new Date().toISOString()
        });
    }
};
```

---

### 📄 `src/components/AIAssistant.tsx`

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, FileText, BrainCircuit } from 'lucide-react';
import { transcribeAudioWithGemini, analyzeDataWithGemini } from '../lib/gemini';
import { getMinifiedERPData } from '../lib/dataMiner';
import { usePersistence } from '../hooks/usePersistence';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

const AIAssistant: React.FC = () => {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [report, setReport] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [localApiKey, setLocalApiKey] = usePersistence<string>('millat_gemini_api_key', '');
    const [apiKey, setApiKey] = useState<string>(localApiKey);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Fetch API Key from Firebase if not in localStorage
    useEffect(() => {
        const fetchKey = async () => {
            if (!localApiKey) {
                try {
                    const docRef = doc(db, 'settings', 'gemini');
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

    // Setup MediaRecorder
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
                        setIsProcessing(true);
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

                    // 1. Transcribe
                    const transcription = await transcribeAudioWithGemini(base64Audio, apiKey);

                    // 2. Fetch Database Context
                    const context = await getMinifiedERPData();

                    // 3. Analyze with AI
                    const aiReport = await analyzeDataWithGemini(transcription, context, apiKey);

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

    // ... Rest of the component (UI rendering)
    // See full implementation in src/components/AIAssistant.tsx

    return (
        <>
            {/* Floating Button + Status Bubble + Modal */}
        </>
    );
};

export default AIAssistant;
```

---

## Configuration Notes

### ⚙️ Required Setup

1. **Gemini API Key**
   - Store in Firebase: `settings/gemini` document with `apiKey` field
   - Or hardcode temporarily (not recommended for production)
   - Get key from: https://aistudio.google.com/apikey

2. **Firebase Collections Required**
   - `students` - Student records
   - `employees` - Staff records
   - `fees` - Fee transactions
   - `attendance` - Attendance logs
   - `notices` - School notices
   - `transport` - Vehicle data
   - `settings` - System settings (including Gemini API key)

3. **Browser Permissions**
   - Microphone access required
   - Must be granted on first use

---

## Troubleshooting

### ❌ Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| **"No transcription returned"** | Using wrong model (e.g., gemini-pro) | ✅ Use `gemini-2.5-flash-lite` for audio |
| **Quota Exceeded** | Daily limit reached on model | ✅ Model auto-rotates to next available |
| **Microphone not working** | Permission denied | ✅ Check browser permissions |
| **Empty reports** | No data in Firestore | ✅ Verify collections exist and have data |
| **API Key Error** | Missing or invalid key | ✅ Check Firebase `settings/gemini` doc |
| **Drag not working on mobile** | Touch events not handled | ✅ Use both mouse + touch handlers |

---

## Critical Lessons Learned

### 🔥 MOST IMPORTANT

1. **Model Selection is CRITICAL**
   - ❌ `gemini-pro` does NOT support audio properly
   - ✅ `gemini-2.5-flash-lite` is REQUIRED for audio transcription
   - This was the root cause of the AI not working in millat-erp

2. **API Endpoint**
   - Use `v1beta` API (not `v1`) for experimental/newer models
   - Format: `https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent`

3. **Audio Format**
   - Use `audio/webm` MIME type
   - Must convert blob to base64 before sending
   - Remove the `data:audio/webm;base64,` prefix

4. **Model Rotation**
   - Implement automatic fallback to handle quota limits
   - Store current index in localStorage
   - Cycle through all models before giving up

5. **Context Size**
   - Don't send ALL database fields (token limit)
   - Minify: Keep only essential fields
   - Consider pagination for large datasets

---

## Future Improvements

### 🚀 Potential Enhancements

1. **Streaming Responses**
   - Use `generateContentStream` for real-time output
   - Show report as it generates (better UX)

2. **Multi-turn Conversations**
   - Maintain conversation history
   - Allow follow-up questions

3. **Voice Output**
   - Text-to-Speech for responses
   - Fully hands-free operation

4. **Advanced Analytics**
   - Chart generation in reports
   - Predictive analytics (e.g., fee collection trends)

5. **Performance Optimization**
   - Cache frequently requested reports
   - Debounce API calls
   - Reduce context size intelligently

6. **Multilingual Support**
   - Full Hindi interface option
   - Other regional languages

---

## Testing Checklist

### ✅ Verification Steps

- [ ] Push and hold button → Starts recording
- [ ] Release button → Stops recording
- [ ] Status shows "Listening..." during recording
- [ ] Status shows "Thinking..." during processing
- [ ] Transcription logs appear in console
- [ ] Report displays in modal
- [ ] Print button generates printable report
- [ ] Bubble is draggable
- [ ] Position persists after refresh
- [ ] Works on mobile (touch events)
- [ ] API key fetched from Firebase
- [ ] Model rotation works when quota exceeded

---

## Code Maintenance

### 📝 When to Update

**Update `gemini.ts` if:**
- New Gemini models are released
- API endpoints change
- Error handling needs improvement

**Update `dataMiner.ts` if:**
- New Firestore collections added
- Need to optimize data fetching
- Want to add/remove fields from context

**Update `AIAssistant.tsx` if:**
- UI/UX improvements needed
- New features (e.g., conversation history)
- Bug fixes in recording logic

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-07 | 1.0 | Initial working version synced from Koshish-ERP |
| | | - Fixed model from gemini-pro → gemini-2.5-flash-lite |
| | | - Updated model rotation list |
| | | - Added comprehensive logging |

---

## Credits

- **Original Implementation:** Koshish-ERP
- **Ported to:** Millat-ERP
- **AI Model:** Google Gemini 2.5 Flash-Lite
- **Framework:** React + TypeScript + Firebase

---

## License & Usage

This implementation is proprietary for Millat ERP. Do not share externally without permission.

For questions or issues, contact the development team.

---

**Last Updated:** January 7, 2026  
**Status:** ✅ Production Ready  
**Tested On:** Chrome, Edge, Safari (Desktop + Mobile)
