


// Flagship models (2026) - Prioritizing Gemini 3 family
const MODELS = [
    "gemini-3-flash-preview",    // Best combination of speed/multimodal (OCR)
    "gemini-3.1-pro-preview",
    "gemini-2.5-flash",          // Shutdown scheduled June 2026
    "gemini-2.5-flash-lite",
];

// Dedicated OCR models for high-quality vision extraction
const OCR_MODELS = [
    "gemini-3-flash-preview",    // Flagship vision model
    "gemini-2.5-flash",
    "gemini-3-pro-preview",
];

// Complex reasoning/logic models for scheduling
const ROUTINE_MODELS = [
    "gemini-3-pro-preview",
    "gemini-3.1-pro-preview",
    "gemini-3-flash-preview",
    "gemini-2.5-pro",
];

// Get current model index from localStorage or default to 0
// Using consistent key: aischool360_ai_model_index
let currentModelIndex = parseInt(localStorage.getItem('aischool360_ai_model_index') || '0');
if (currentModelIndex >= MODELS.length) {
    currentModelIndex = 0;
    localStorage.setItem('aischool360_ai_model_index', '0');
}

export const transcribeAudioWithGemini = async (base64Audio: string, apiKey: string) => {
    let attempts = 0;
    const maxAttempts = MODELS.length;

    while (attempts < maxAttempts) {
        const modelName = MODELS[currentModelIndex];
        console.log(`[AI] Attempting transcription with model: ${modelName} (Attempt ${attempts + 1}/${maxAttempts})`);

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
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
                const isQuotaError = data.error.message?.toLowerCase().includes('quota') ||
                    data.error.message?.toLowerCase().includes('limit') ||
                    data.error.code === 429;

                const isNotFoundError = data.error.code === 404 ||
                    data.error.message?.toLowerCase().includes('not found');

                if (isQuotaError || isNotFoundError) {
                    console.warn(`[AI] Model ${modelName} failed (${isQuotaError ? 'Quota' : 'Not Found'}). Rotating for transcription...`);

                    // Rotate to next model immediately
                    currentModelIndex = (currentModelIndex + 1) % MODELS.length;
                    localStorage.setItem('aischool360_ai_model_index', currentModelIndex.toString());

                    attempts++;
                    continue; // Retry with next model
                }

                throw new Error(data.error.message || "Transcription failed");
            }

            const transcribedText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (!transcribedText) {
                throw new Error("No transcription returned from Gemini");
            }

            console.log('[AI] Transcription successful:', transcribedText);
            return transcribedText;

        } catch (error: any) {
            console.error(`[AI] Error with model ${modelName} during transcription:`, error);

            // If it's a fetch error or something unexpected, try next model just in case
            currentModelIndex = (currentModelIndex + 1) % MODELS.length;
            localStorage.setItem('aischool360_ai_model_index', currentModelIndex.toString());
            attempts++;
        }
    }

    throw new Error("All available AI models have exhausted their quotas for transcription. Please try again later.");
};

export const analyzeDataWithGemini = async (prompt: string, contextData: any, apiKey: string, schoolName?: string) => {
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
                            text: `You are an Intelligent AI School Administrator for '${schoolName || 'Millat ERP'}'.
                            Your role is to analyze school data (Students, Notices, Attendance, Finances).
                            
                            You have access to:
                            1. Student List (Academic & Personal)
                            2. Financials (Actual Fee Collections & General Transactions/Expenses)
                            3. Notices/Events
                            4. Class Attendance Stats
                            5. Employee/Staff List (Teachers)
                            
                            PHASE 1: Analyze Input
                            - Process the user's voice input: "${prompt}"
                            - NOTE: This input comes from a Voice-to-Text system and may contain phonetic errors.
                            - Use context to "fuzzy match" the user's intent.
                            - If the user asks for "Income-Expense statement" or "Financial Summary", use 'fee_collections' for income and 'transactions' for expenses/other.
                            - Handle Hindi/Hinglish by translating the core intent to English internally.
                            
                            PHASE 2: Data Synthesis
                            - Use the provided context data to generate a concise, professional report.
                            - Context Data: ${typeof contextData === 'string' ? contextData : JSON.stringify(contextData, null, 1)}
                            
                            Rules for Output:
                            1. Output ONLY the final report. Do not show your thinking process.
                            2. Do not show intermediate calculations. Just show the final result.
                            3. For financial statements, include a summary (Total Income, Total Expense, Net Balance).
                            4. When generating lists of student dues or pending balances, ONLY include students whose dues are greater than 0.
                            5. Use professional, bold headers and clean Markdown tables for lists.
                            6. Ensure tables have leading and trailing pipes (|).
                            7. The response must be elegant and ready for professional printing.`
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
                    localStorage.setItem('aischool360_ai_model_index', currentModelIndex.toString());

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
            localStorage.setItem('aischool360_ai_model_index', currentModelIndex.toString());
            attempts++;
        }
    }

    throw new Error("All available AI models have exhausted their quotas. Please try again later.");
};

// Specialized function for routine generation using better models
export const analyzeRoutineWithGemini = async (prompt: string, contextData: any, apiKey: string) => {
    let attempts = 0;
    const maxAttempts = ROUTINE_MODELS.length;

    // Separate rotation index for routine generation
    let routineModelIndex = parseInt(localStorage.getItem('millat_routine_model_index') || '0');
    if (routineModelIndex >= ROUTINE_MODELS.length) {
        routineModelIndex = 0;
        localStorage.setItem('millat_routine_model_index', '0');
    }

    while (attempts < maxAttempts) {
        const modelName = ROUTINE_MODELS[routineModelIndex];
        console.log(`[ROUTINE AI] Using model: ${modelName} (Attempt ${attempts + 1}/${maxAttempts})`);

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Context Data:\n${JSON.stringify(contextData, null, 2)}\n\nTask:\n${prompt}`
                        }]
                    }],
                    generationConfig: {
                        temperature: 0,  // More deterministic for scheduling logic
                        topK: 1,
                        topP: 1,
                    }
                })
            });

            const data = await response.json();

            if (data.error) {
                const isQuotaError = data.error.message?.toLowerCase().includes('quota') ||
                    data.error.message?.toLowerCase().includes('limit') ||
                    data.error.code === 429;

                const isNotFoundError = data.error.code === 404 ||
                    data.error.message?.toLowerCase().includes('not found');

                if (isQuotaError || isNotFoundError) {
                    console.warn(`[ROUTINE AI] Model ${modelName} failed (${isQuotaError ? 'Quota' : 'Not Found'}). Trying next model...`);

                    routineModelIndex = (routineModelIndex + 1) % ROUTINE_MODELS.length;
                    localStorage.setItem('millat_routine_model_index', routineModelIndex.toString());

                    attempts++;
                    continue;
                }

                throw new Error(data.error.message || "Routine generation failed");
            }

            console.log(`[ROUTINE AI] ✓ Successfully generated with ${modelName}`);
            return data.candidates[0].content.parts[0].text;

        } catch (error) {
            console.error(`[ROUTINE AI] Error with model ${modelName}:`, error);

            routineModelIndex = (routineModelIndex + 1) % ROUTINE_MODELS.length;
            localStorage.setItem('millat_routine_model_index', routineModelIndex.toString());
            attempts++;
        }
    }

    throw new Error("All routine generation models exhausted. Please try again later.");
};

// Extract questions from an image using Gemini Vision
export const extractQuestionsFromImage = async (
    base64Image: string,
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp',
    apiKey: string,
    context?: { className?: string; subjectName?: string; chapterName?: string }
): Promise<string> => {
    let attempts = 0;
    const maxAttempts = OCR_MODELS.length;

    // Separate OCR model rotation index
    let ocrModelIndex = parseInt(localStorage.getItem('aischool360_ocr_model_index') || '0');
    if (ocrModelIndex >= OCR_MODELS.length) {
        ocrModelIndex = 0;
        localStorage.setItem('aischool360_ocr_model_index', '0');
    }

    while (attempts < maxAttempts) {
        const modelName = OCR_MODELS[ocrModelIndex];
        console.log(`[OCR AI] Attempting image extraction with model: ${modelName} (Attempt ${attempts + 1}/${maxAttempts})`);

        try {
            const contextHint = context
                ? `This image is from ${context.className || ''} ${context.subjectName || ''} - Chapter: ${context.chapterName || ''}.`
                : '';

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{
                            parts: [
                                {
                                    inline_data: {
                                        mime_type: mimeType,
                                        data: base64Image
                                    }
                                },
                                {
                                    text: `${contextHint}
Extract ALL questions from this image accurately. Follow these rules:
1. List EVERY question on a new line, numbered (e.g., Q1., Q2., ...).
2. Preserve sub-questions (a, b, c) exactly as written.
3. Include marks in brackets if shown (e.g., [2 marks]).
4. Keep mathematical symbols and formulas as plain text (e.g., x^2, sqrt(9)).
5. Extract Hindi/Urdu text using Devanagari/Arabic script as-is.
6. Do NOT add any explanations or answers — only extract questions.
7. Do NOT stop early — extract until the LAST question in the image.
8. If no questions are found, return: "No questions found in image."

Output format:
Q1. [question text] [marks if any]
Q2. [question text] [marks if any]
...`
                                }
                            ]
                        }],
                        generationConfig: {
                            maxOutputTokens: 8192,  // Prevent truncation
                            temperature: 0.1
                        }
                    })
                }
            );

            const data = await response.json();

            if (data.error) {
                const isQuotaError = data.error.message?.toLowerCase().includes('quota') ||
                    data.error.message?.toLowerCase().includes('limit') ||
                    data.error.code === 429;
                const isNotFoundError = data.error.code === 404 ||
                    data.error.message?.toLowerCase().includes('not found');

                if (isQuotaError || isNotFoundError) {
                    console.warn(`[OCR AI] Model ${modelName} failed. Rotating...`);
                    ocrModelIndex = (ocrModelIndex + 1) % OCR_MODELS.length;
                    localStorage.setItem('aischool360_ocr_model_index', ocrModelIndex.toString());
                    attempts++;
                    continue;
                }
                throw new Error(data.error.message || 'Image extraction failed');
            }

            // Check for truncated response (finishReason !== STOP means truncated)
            const finishReason = data.candidates?.[0]?.finishReason;
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (!text) throw new Error('No text returned from Gemini');

            if (finishReason && finishReason !== 'STOP') {
                console.warn(`[OCR AI] Response may be truncated (finishReason: ${finishReason}). Trying next model...`);
                ocrModelIndex = (ocrModelIndex + 1) % OCR_MODELS.length;
                localStorage.setItem('aischool360_ocr_model_index', ocrModelIndex.toString());
                attempts++;
                continue;
            }

            console.log('[OCR AI] Extraction successful');
            return text;

        } catch (error: any) {
            console.error(`[OCR AI] Error with model ${modelName}:`, error);
            ocrModelIndex = (ocrModelIndex + 1) % OCR_MODELS.length;
            localStorage.setItem('aischool360_ocr_model_index', ocrModelIndex.toString());
            attempts++;
        }
    }

    throw new Error('All models exhausted for image extraction. Please try again later.');
};
