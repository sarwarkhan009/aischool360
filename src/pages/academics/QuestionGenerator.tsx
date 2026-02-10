import React, { useState, useEffect } from 'react';
import {
    FileQuestion,
    GraduationCap,
    BookOpen,
    CheckSquare,
    Download,
    Printer,
    Sparkles,
    Loader2,
    ChevronRight,
    ChevronLeft,
    FileText,
    Edit2
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useFirestore } from '../../hooks/useFirestore';
import { usePersistence } from '../../hooks/usePersistence';
import { useSchool } from '../../context/SchoolContext';
import { sortClasses } from '../../constants/app';

interface QuestionType {
    name: string;
    marks: number;
    count: number;
}

interface ClassData {
    name: string;
    subjects: Subject[];
}

interface Subject {
    name: string;
    chapters: string[];
}

interface DifficultyLevel {
    name: string;
    percentage: number;
    color: string;
}

const DEFAULT_QUESTION_TYPES: QuestionType[] = [
    { name: 'Multiple Choice Questions', marks: 1, count: 0 },
    { name: 'Fill in the Blanks', marks: 1, count: 0 },
    { name: 'True/False', marks: 1, count: 0 },
    { name: 'Matching Columns', marks: 2, count: 0 },
    { name: 'Very Short Answer Questions', marks: 2, count: 0 },
    { name: 'Short Answer Questions', marks: 3, count: 0 },
    { name: 'Long Answer Questions', marks: 5, count: 0 }
];

const DEFAULT_DIFFICULTY_LEVELS: DifficultyLevel[] = [
    { name: 'Easy', percentage: 20, color: '#10b981' },
    { name: 'Moderate', percentage: 50, color: '#3b82f6' },
    { name: 'Difficult', percentage: 20, color: '#f59e0b' },
    { name: 'Extreme Difficult', percentage: 10, color: '#ef4444' }
];

const QuestionGenerator: React.FC = () => {
    const [step, setStep] = useState(1);
    const [selectedClass, setSelectedClass] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
    const [questionTypes, setQuestionTypes] = useState<QuestionType[]>(DEFAULT_QUESTION_TYPES);
    const [difficultyLevels, setDifficultyLevels] = useState<DifficultyLevel[]>(DEFAULT_DIFFICULTY_LEVELS);
    const [generatedPaper, setGeneratedPaper] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [examName, setExamName] = useState('');
    const [examDuration, setExamDuration] = useState('2');
    // For managing master data
    const [classes, setClasses] = useState<ClassData[]>([]);

    // Fetch API Key from localStorage (same as AIAssistant)
    const [geminiApiKey, setGeminiApiKey] = usePersistence<string>('millat_gemini_api_key', '');
    const { currentSchool } = useSchool();
    const { data: settings } = useFirestore<any>('settings');

    useEffect(() => {
        const fetchKey = async () => {
            if (!geminiApiKey && currentSchool?.id) {
                try {
                    const docRef = doc(db, 'settings', `gemini_${currentSchool.id}`);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setGeminiApiKey(docSnap.data().apiKey);
                    }
                } catch (err) {
                    console.error("Error fetching Gemini API Key:", err);
                }
            }
        };
        fetchKey();
    }, [currentSchool?.id, geminiApiKey]);
    const schoolInfo = settings?.find(s => s.type === 'school_info' || s.id === 'school_info');

    // Load data from Firestore
    useEffect(() => {
        if (currentSchool?.id && settings && settings.length > 0) {
            loadQuestionGeneratorData();
        }
    }, [currentSchool?.id, settings]);

    // Load MathJax for LaTeX rendering
    useEffect(() => {
        // Load MathJax script if not already loaded
        if (!(window as any).MathJax && !document.getElementById('mathjax-script')) {
            const script = document.createElement('script');
            script.id = 'mathjax-script';
            script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
            script.async = true;

            (window as any).MathJax = {
                tex: {
                    inlineMath: [['$', '$']],
                    displayMath: [['$$', '$$']]
                },
                startup: {
                    ready: () => {
                        (window as any).MathJax.startup.defaultReady();
                    }
                }
            };

            document.head.appendChild(script);
        }
    }, []);

    // Re-render MathJax when paper is generated - AGGRESSIVE
    useEffect(() => {
        if (generatedPaper && (window as any).MathJax) {
            const renderMath = () => {
                (window as any).MathJax.typesetPromise?.().catch((err: any) => console.error('MathJax error:', err));
            };

            // Multiple attempts at different intervals
            setTimeout(renderMath, 100);
            setTimeout(renderMath, 300);
            setTimeout(renderMath, 600);
            setTimeout(renderMath, 1000);
            setTimeout(renderMath, 2000);
        }
    }, [generatedPaper]);

    const loadQuestionGeneratorData = async () => {
        if (!currentSchool?.id) return;
        try {
            // Load from academic_structure (where AcademicDataManager saves data)
            const docId = `academic_structure_${currentSchool.id}`;
            const docRef = doc(db, 'settings', docId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.subjects) {
                    // Transform subject-based structure to class-based structure
                    // Data structure in Firestore: { subjects: [{ name, chaptersPerClass: {className: chapters[]}, enabledFor: [classNames] }] }
                    // Transform to: { classes: [{ name, subjects: [{ name, chapters }] }] }

                    const classesMap = new Map<string, { name: string; subjects: { name: string; chapters: string[] }[] }>();

                    // Iterate through each subject
                    data.subjects.forEach((subject: { name: string; chaptersPerClass: { [className: string]: string[] }; enabledFor: string[] }) => {
                        // For each class this subject is enabled for
                        subject.enabledFor.forEach((className: string) => {
                            // Get or create class entry
                            if (!classesMap.has(className)) {
                                classesMap.set(className, { name: className, subjects: [] });
                            }

                            // Get chapters specific to this class
                            const classChapters = subject.chaptersPerClass[className] || [];

                            // Add this subject to the class with class-specific chapters
                            classesMap.get(className)!.subjects.push({
                                name: subject.name,
                                chapters: classChapters
                            });
                        });
                    });

                    // Convert map to array and sort
                    const allTransformedClasses = sortClasses(Array.from(classesMap.values()));

                    const transformedClasses = allTransformedClasses.filter(c => {
                        const className = (c.name || '').toString().trim().toLowerCase();
                        const classSetting = settings?.find((s: any) =>
                            s.type === 'class' &&
                            (s.name || '').toString().trim().toLowerCase() === className
                        );

                        // If class setting exists and it's explicitly inactive, hide it
                        if (classSetting && classSetting.active === false) return false;

                        // Otherwise (active or setting missing), show it
                        return true;
                    });

                    console.log('[Question Generator] Loaded and transformed academic data (filtered & sorted):', transformedClasses);
                    setClasses(transformedClasses);
                }
            }
        } catch (error) {
            console.error('Error loading question generator data:', error);
        }
    };

    const toggleChapterSelection = (chapter: string) => {
        if (selectedChapters.includes(chapter)) {
            setSelectedChapters(selectedChapters.filter(c => c !== chapter));
        } else {
            setSelectedChapters([...selectedChapters, chapter]);
        }
    };

    const updateQuestionType = (index: number, field: 'marks' | 'count', value: number) => {
        const updated = [...questionTypes];
        updated[index][field] = Math.max(0, value);
        setQuestionTypes(updated);
    };

    const getTotalMarks = () => {
        return questionTypes.reduce((sum, qt) => sum + (qt.marks * qt.count), 0);
    };

    const getTotalQuestions = () => {
        return questionTypes.reduce((sum, qt) => sum + qt.count, 0);
    };

    const updateDifficultyLevel = (index: number, value: number) => {
        const updated = [...difficultyLevels];
        updated[index].percentage = Math.max(0, Math.min(100, value));
        setDifficultyLevels(updated);
    };

    const getTotalDifficultyPercentage = () => {
        return difficultyLevels.reduce((sum, dl) => sum + dl.percentage, 0);
    };

    const canProceed = () => {
        if (step === 1) return selectedClass !== '';
        if (step === 2) return selectedSubject !== '';
        if (step === 3) return selectedChapters.length > 0;
        if (step === 4) return getTotalQuestions() > 0 && examName.trim() !== '';
        if (step === 5) return getTotalDifficultyPercentage() === 100;
        return false;
    };

    const generateQuestionPaper = async () => {
        setIsGenerating(true);
        try {
            if (!geminiApiKey) {
                alert('Gemini API key not configured. Please set it in Settings > API Keys');
                setIsGenerating(false);
                return;
            }

            // Prepare the prompt for Gemini
            let currentSectionIndex = 0;
            const questionBreakdown = questionTypes
                .filter(qt => qt.count > 0)
                .map(qt => {
                    const sectionLetter = String.fromCharCode(65 + currentSectionIndex);
                    currentSectionIndex++;
                    return `- Section ${sectionLetter}: ${qt.name} (${qt.count} x ${qt.marks} = ${qt.count * qt.marks})`;
                })
                .join('\n');

            const difficultyBreakdown = difficultyLevels
                .map(dl => `- ${dl.name}: ${dl.percentage}%`)
                .join('\n');

            const sName = currentSchool?.fullName || currentSchool?.name || schoolInfo?.fullName || schoolInfo?.name || 'School Name';
            const sAddress = currentSchool?.address || schoolInfo?.address || '';
            const sContact = currentSchool?.phone || currentSchool?.contactNumber || schoolInfo?.phone || schoolInfo?.contact || '';

            const prompt = `You are an expert educational content creator. Generate a professional question paper with the following specifications:

<div style="text-align: center;">
<h1 style="margin: 0; padding: 0; text-align: center; display: block;">${sName}</h1>
${sAddress || sContact ? `<p style="margin: 0; padding: 0; text-align: center; font-size: 14px; display: block;">${sAddress}${sAddress && sContact ? ' | Contact: ' : ''}${sContact}</p>` : ''}
<h2 style="margin: 5px 0 0 0; padding: 5px; text-align: center; background: #f0f0f0; border: 1px solid #333; display: block;">${examName || 'Examination'} - ${selectedClass} - ${selectedSubject}</h2>
<p style="margin: 5px 0; text-align: center; font-weight: bold; display: block;">Maximum Marks: ${getTotalMarks()}   |   Time Allowed: ${examDuration} Hours</p>
</div>
<hr style="margin: 0.5rem 0;">

**Question Pattern:**
${questionBreakdown}

**Difficulty Distribution:**
${difficultyBreakdown}

**Chapters Covered:** ${selectedChapters.join(', ')}

---

**Formatting Instructions:**
1. Start with the institution name as heading 1 (use single #)
2. Class and subject as heading 2 (use ##)
3. Use **bold** for important information like Maximum Marks, Time Allowed
4. Use --- for horizontal dividers
5. Use ## for section headers. Each section header MUST include the marks distribution as shown in the pattern, e.g., "## Section A: Multiple Choice Questions (5 x 1 = 5)" or "## Section D: Very Short Answer Questions (5 x 2 = 10)"
6. **Number all questions sequentially and continuously from 1 onwards across ALL sections** (do NOT restart numbering for each section)
7. For MCQs, provide 4 options labeled a), b), c), d)
8. For Fill in the Blanks: ALWAYS write the complete question text with the blank represented by underscores
9. For Matching Columns: Use simple text format with "Column A:" and "Column B:" labels, list items line by line
10. Use simple markdown formatting - avoid code blocks, tables, and excessive asterisks
11. Keep formatting clean and professional
12. DO NOT wrap the output in markdown code blocks

**Fill in the Blanks Format Example:**
6. The process of mixing two metals together is called _____________.
7. The SI unit of force is _____________.
8. Water boils at _____________ degrees Celsius.

**Matching Columns Format Example:**
**Instructions:** Match the items in Column A with the items in Column B.

**Column A:**
16. Reactant
17. Electrical resistance
18. Corrective lens
19. Temporary magnet
20. Ability to see distant objects

**Column B:**
(a) pH value of neutral solution
(b) Electromagnet
(c) Positive
(d) Ohm ($\\Omega$)
(e) Convex lens

**CRITICAL RULE for Matching Columns - READ CAREFULLY:**
- **DO NOT start Column A numbering at 1**
- **Column A MUST continue the sequential numbering from the previous section**
- Example: If Section C ends with question 15, then Column A items are 16, 17, 18, 19, 20
- Column B always uses letters: (a), (b), (c), (d), (e)
- The section after matching columns continues from where Column A ended
- If Column A goes 16-20, the next section starts at 21

**WRONG Example (DON'T DO THIS):**
Column A:
1. Item ← WRONG! Don't restart at 1
2. Item

**CORRECT Example:**
Section C ends with: 15. Question...
Column A:
16. Item ← CORRECT! Continue from 15
17. Item
Section E continues: 21. Question...

**Content Instructions:**
1. Generate high-quality, curriculum-relevant questions based on the specified chapters
2. Ensure questions are age-appropriate for ${selectedClass}
3. Distribute questions across difficulty levels according to the specified percentages
4. Mix difficulty levels within each question type to maintain the overall distribution
5. Questions should be well-distributed across all specified chapters
6. **IMPORTANT: Use LaTeX formatting for ALL mathematical and chemical formulas**

**LaTeX Formatting Rules:**
- Wrap ALL formulas in dollar signs: $formula$
- Chemical formulas: $H_2O$, $CO_2$, $NaCl$, $CaCO_3$
- Mathematical expressions: $x^2 + y^2 = z^2$, $\\frac{1}{2}$
- Subscripts: Use underscore _ like $H_2SO_4$
- Superscripts: Use caret ^ like $E = mc^2$
- Arrows: Use \\rightarrow like $2H_2 + O_2 \\rightarrow 2H_2O$
- Greek letters: $\\Delta$, $\\alpha$, $\\beta$, $\\pi$
- Units: $^\\circ C$ for degrees Celsius, $\\Omega$ for Ohm

**LaTeX Examples:**
- The formula for water is $H_2O$.
- Newton's second law: $F = ma$
- Chemical reaction: $CaCO_3 \\rightarrow CaO + CO_2$
- Temperature: Water boils at $100^\\circ C$
- Resistance is measured in Ohms ($\\Omega$)

**CRITICAL Formatting Rule - DO NOT DISCLOSE METADATA:**
- DO NOT mention the difficulty level (e.g., "Easy", "Moderate") anywhere in the question paper.
- DO NOT mention the chapter name or number (e.g., "Chapter 1") after any question.
- The questions should look like a final exam paper for students, with NO internal analytical tags or labels.

Generate the complete question paper now:`;


            // Model rotation - try multiple models if quota exceeded
            const MODELS = [
                "gemini-3-flash-preview",
                "gemini-2.5-flash-lite",
                "gemini-2.5-flash",
                "gemini-2.0-flash",
                "gemini-1.5-flash"
            ];

            let lastError: Error | null = null;

            for (let i = 0; i < MODELS.length; i++) {
                const modelName = MODELS[i];
                console.log(`[Question Generator] Trying model: ${modelName} (Attempt ${i + 1}/${MODELS.length})`);

                try {
                    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            contents: [{
                                parts: [{
                                    text: prompt
                                }]
                            }],
                            generationConfig: {
                                temperature: 0.7,
                                topK: 40,
                                topP: 0.95,
                                maxOutputTokens: 8192,
                            }
                        })
                    });

                    const data = await response.json();

                    // Check for quota or not found errors
                    if (data.error) {
                        const isQuotaError = data.error.message?.toLowerCase().includes('quota') ||
                            data.error.message?.toLowerCase().includes('limit') ||
                            data.error.code === 429;

                        const isNotFoundError = data.error.code === 404 ||
                            data.error.message?.toLowerCase().includes('not found');

                        if (isQuotaError || isNotFoundError) {
                            console.warn(`[Question Generator] Model ${modelName} failed (${isQuotaError ? 'Quota' : 'Not Found'}). Trying next model...`);
                            lastError = new Error(data.error.message);
                            continue; // Try next model
                        }

                        throw new Error(data.error.message || 'Failed to generate question paper');
                    }

                    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (!generatedText) {
                        throw new Error('No content generated');
                    }

                    console.log(`[Question Generator] Success with model: ${modelName}`);
                    setGeneratedPaper(generatedText);
                    setStep(6);
                    setIsGenerating(false);
                    return; // Success!

                } catch (error: any) {
                    console.error(`[Question Generator] Error with model ${modelName}:`, error);
                    lastError = error;
                    // Continue to next model
                }
            }

            // If we get here, all models failed
            throw lastError || new Error('All AI models are currently unavailable. Please try again later.');

        } catch (error: any) {
            console.error('Error generating question paper:', error);
            alert('Failed to generate question paper: ' + error.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const htmlContent = convertMarkdownToHTML(generatedPaper);

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Question Paper - ${selectedClass} ${selectedSubject}</title>
                <script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
                <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
                <script>
                    window.MathJax = {
                        tex: {
                            inlineMath: [['$', '$']],
                            displayMath: [['$$', '$$']]
                        },
                        startup: {
                            ready: () => {
                                MathJax.startup.defaultReady();
                                MathJax.startup.promise.then(() => {
                                    // Wait a bit more to ensure everything is rendered
                                    setTimeout(() => {
                                        window.print();
                                    }, 500);
                                });
                            }
                        }
                    };
                </script>
                <style>
                    @media print {
                        @page { margin: 2cm; }
                        body { margin: 0; }
                    }
                    body {
                        font-family: 'Times New Roman', serif;
                        line-height: 1.8;
                        padding: 2rem;
                        max-width: 210mm;
                        margin: 0 auto;
                        color: #000;
                    }
                    h1 {
                        text-align: center;
                        font-size: 26px;
                        font-weight: bold;
                        margin: 0 0 2px 0 !important;
                        padding: 0 !important;
                        text-transform: uppercase;
                        line-height: 1.2;
                    }
                    h2 {
                        font-size: 18px;
                        font-weight: bold;
                        margin: 8px 0 !important;
                        padding: 6px 8px !important;
                        background: #f0f0f0;
                        border: 1px solid #333;
                        text-align: center;
                        line-height: 1.2;
                    }
                    h3 {
                        font-size: 16px;
                        font-weight: bold;
                        margin: 0.75rem 0 0.25rem 0;
                    }
                    p {
                        margin: 4px 0 !important;
                        padding: 0 !important;
                        line-height: 1.5;
                        text-align: left;
                    }
                    ul, ol {
                        margin: 0.5rem 0;
                        padding-left: 2rem;
                    }
                    li {
                        margin: 0.25rem 0;
                    }
                    strong {
                        font-weight: bold;
                    }
                    hr {
                        border: none;
                        border-top: 2px solid #333;
                        margin: 1rem 0;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 2rem;
                    }
                    table.matching-table {
                        border-collapse: collapse;
                        width: 100%;
                        margin: 0 0 1rem 0;
                        border: 2px solid #333;
                    }
                    table.matching-table th,
                    table.matching-table td {
                        border: 1px solid #333;
                        padding: 0.75rem;
                        text-align: left;
                    }
                    table.matching-table th {
                        background: #f0f0f0;
                        font-weight: bold;
                    }
                    .matching-columns {
                        display: flex;
                        gap: 2rem;
                        margin: 1rem 0;
                    }
                    .matching-columns .column-a,
                    .matching-columns .column-b {
                        flex: 1;
                    }
                    .matching-columns strong {
                        display: block;
                        margin-bottom: 0.5rem;
                        font-size: 16px;
                    }
                </style>
            </head>
            <body>
                ${htmlContent}
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleDownload = () => {
        const blob = new Blob([generatedPaper], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `QuestionPaper_${selectedClass}_${selectedSubject}_${new Date().toISOString().split('T')[0]}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const resetForm = () => {
        setStep(1);
        setSelectedClass('');
        setSelectedSubject('');
        setSelectedChapters([]);
        setQuestionTypes(DEFAULT_QUESTION_TYPES);
        setDifficultyLevels(DEFAULT_DIFFICULTY_LEVELS);
        setGeneratedPaper('');
        setExamName('');
        setExamDuration('2');
    };

    const currentClass = classes.find(c => c.name === selectedClass);
    const currentSubject = currentClass?.subjects.find(s => s.name === selectedSubject);
    const availableChapters = currentSubject?.chapters || [];

    // Convert markdown to clean HTML
    const convertMarkdownToHTML = (markdown: string): string => {
        let html = markdown;

        // Remove code block markers
        html = html.replace(/```markdown\n?/g, '');
        html = html.replace(/```\n?/g, '');

        // Detect and wrap Column A and Column B sections FIRST (before converting bold)
        html = html.replace(/\*\*Column A:\*\*([\s\S]*?)\*\*Column B:\*\*([\s\S]*?)(?=\n\n|##|\*\*General|$)/g, (_match, colA, colB) => {
            return `|||COLUMN_START|||${colA}|||COLUMN_MID|||${colB}|||COLUMN_END|||`;
        });

        // Convert markdown tables to HTML tables
        const tableRegex = /(\|.+\|\n)+/g;
        html = html.replace(tableRegex, (tableMatch) => {
            const rows = tableMatch.trim().split('\n');
            if (rows.length < 2) return tableMatch;

            let tableHTML = '\n<table class="matching-table">\n';

            rows.forEach((row, index) => {
                // Skip separator row (|---|---|)
                if (row.match(/^\|[\s\-:]+\|/)) return;

                const cells = row.split('|').filter(cell => cell.trim() !== '');
                const tag = index === 0 ? 'th' : 'td';

                tableHTML += '  <tr>\n';
                cells.forEach(cell => {
                    tableHTML += `    <${tag}>${cell.trim()}</${tag}>\n`;
                });
                tableHTML += '  </tr>\n';
            });

            tableHTML += '</table>\n';
            return tableHTML;
        });

        // Convert headers (### to h3, ## to h2, # to h1)
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

        // Convert bold text **text** to <strong>text</strong>
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Convert horizontal rules --- to <hr>
        html = html.replace(/^---$/gm, '<hr>');

        // Convert bullets (* item) to proper list items
        html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');

        // Wrap consecutive <li> items in <ul>
        html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
            return '<ul>' + match + '</ul>';
        });

        // Convert line breaks (do this after column wrapping)
        html = html.replace(/\n\n+/g, '</p><p>');
        html = html.replace(/\n/g, '<br>');

        // CRITICAL: Remove <br> tags immediately following block elements to prevent double spacing
        html = html.replace(/(<(h1|h2|h3|hr|p|div|table|tr|ul|li)[^>]*>)\s*<br\s*\/?>/gi, '$1');
        html = html.replace(/<br\s*\/?>\s*(<\/(h1|h2|h3|hr|p|div|table|tr|ul|li)>)/gi, '$1');

        // Remove <br> between block elements
        html = html.replace(/(<\/(h1|h2|h3|hr|p|div|table|tr|ul|li)>)\s*<br\s*\/?>\s*(<(h1|h2|h3|hr|p|div|table|tr|ul|li))/gi, '$1$3');

        // Now convert the column markers to HTML (after line breaks are converted)
        html = html.replace(/\|\|\|COLUMN_START\|\|\|([\s\S]*?)\|\|\|COLUMN_MID\|\|\|([\s\S]*?)\|\|\|COLUMN_END\|\|\|/g, (_match, colA, colB) => {
            return `<div class="matching-columns">
                <div class="column-a">
                    <strong>Column A:</strong>${colA}
                </div>
                <div class="column-b">
                    <strong>Column B:</strong>${colB}
                </div>
            </div>`;
        });

        // Clean up excessive line breaks around tables (if any remain)
        html = html.replace(/(<br>\s*){3,}(<table)/g, '<br>$2');
        html = html.replace(/(<\/table>)\s*(<br>\s*){3,}/g, '$1<br>');

        // Wrap in paragraph tags - be careful not to wrap headers or existing block elements
        if (!html.trim().startsWith('<div') && !html.trim().startsWith('<h1') && !html.trim().startsWith('<table')) {
            html = '<p>' + html + '</p>';
        }

        // Clean up empty paragraphs and nested ones
        html = html.replace(/<p><\/p>/g, '');
        html = html.replace(/<p>\s*<\/p>/g, '');
        html = html.replace(/<p>\s*(<div|<h1|<h2|<h3|<table)/gi, '$1');
        html = html.replace(/(<\/div>|<\/h1>|<\/h2>|<\/h3>|<\/table>)\s*<\/p>/gi, '$1');

        // Clean up paragraphs around tables
        html = html.replace(/<p>\s*<table/g, '<table');
        html = html.replace(/<\/table>\s*<\/p>/g, '</table>');

        // Remove excessive br tags around tables
        html = html.replace(/(<br>\s*){2,}<table/g, '<br><table');
        html = html.replace(/<\/table>(<br>\s*){2,}/g, '</table><br>');

        // Final aggressive cleanup - remove ALL br/whitespace before tables
        html = html.replace(/(<br\s*\/?>)+\s*<table/gi, '<table');
        html = html.replace(/>\s+<table/g, '><table');

        return html;
    };

    return (
        <div className="question-generator-container">
            <div className="header-section">
                <div className="header-content">
                    <div className="header-icon">
                        <FileQuestion size={36} />
                    </div>
                    <div>
                        <h1 className="page-title">AI Question Paper Generator</h1>
                        <p className="page-subtitle">Create professional question papers with AI assistance</p>
                    </div>
                </div>

            </div>

            {/* Progress Stepper */}
            <div className="stepper">
                {['Select Class', 'Select Subject', 'Select Chapters', 'Question Pattern', 'Difficulty Level', 'Generate'].map((label, idx) => (
                    <div key={idx} className={`step ${step > idx + 1 ? 'completed' : step === idx + 1 ? 'active' : ''}`}>
                        <div className="step-circle">{step > idx + 1 ? '✓' : idx + 1}</div>
                        <div className="step-label">{label}</div>
                    </div>
                ))}
            </div>

            {/* Step Content */}
            <div className="step-content">
                {step === 1 && (
                    <div className="selection-card">
                        <div className="card-header">
                            <GraduationCap size={24} />
                            <h2>Select Class</h2>
                        </div>
                        <div className="options-grid">
                            {classes.map((cls) => (
                                <button
                                    key={cls.name}
                                    onClick={() => setSelectedClass(cls.name)}
                                    className={`option-card ${selectedClass === cls.name ? 'selected' : ''}`}
                                >
                                    <GraduationCap size={20} />
                                    <span>{cls.name}</span>
                                </button>
                            ))}
                            {classes.length === 0 && (
                                <div className="empty-state">
                                    <p>No classes available. Click "Manage Data" to add classes.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="selection-card">
                        <div className="card-header">
                            <BookOpen size={24} />
                            <h2>Select Subject for {selectedClass}</h2>
                        </div>
                        <div className="options-grid">
                            {currentClass?.subjects.map((subject) => (
                                <button
                                    key={subject.name}
                                    onClick={() => setSelectedSubject(subject.name)}
                                    className={`option-card ${selectedSubject === subject.name ? 'selected' : ''}`}
                                >
                                    <BookOpen size={20} />
                                    <span>{subject.name}</span>
                                </button>
                            ))}
                            {!currentClass?.subjects.length && (
                                <div className="empty-state">
                                    <p>No subjects available for {selectedClass}. Click "Manage Data" to add subjects.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="selection-card">
                        <div className="card-header">
                            <CheckSquare size={24} />
                            <h2>Select Chapters (Multiple)</h2>
                        </div>
                        <p className="helper-text">You can select multiple chapters for the question paper</p>
                        <div className="chapters-list">
                            {availableChapters.map((chapter) => (
                                <label key={chapter} className="chapter-item">
                                    <input
                                        type="checkbox"
                                        checked={selectedChapters.includes(chapter)}
                                        onChange={() => toggleChapterSelection(chapter)}
                                    />
                                    <span>{chapter}</span>
                                </label>
                            ))}
                            {!availableChapters.length && (
                                <div className="empty-state">
                                    <p>No chapters available for {selectedSubject}. Click "Manage Data" to add chapters.</p>
                                </div>
                            )}
                        </div>
                        <div className="selected-summary">
                            <strong>Selected: {selectedChapters.length} chapter(s)</strong>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div className="selection-card">
                        <div className="card-header">
                            <FileText size={24} />
                            <h2>Configure Question Pattern</h2>
                        </div>
                        <p className="helper-text">Set marks and number of questions for each type</p>
                        <div className="question-pattern-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Question Type</th>
                                        <th>Marks per Question</th>
                                        <th>Number of Questions</th>
                                        <th>Total Marks</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {questionTypes.map((qt, idx) => (
                                        <tr key={idx}>
                                            <td>{qt.name}</td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={qt.marks}
                                                    onChange={(e) => updateQuestionType(idx, 'marks', parseInt(e.target.value) || 0)}
                                                    className="input-small"
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={qt.count}
                                                    onChange={(e) => updateQuestionType(idx, 'count', parseInt(e.target.value) || 0)}
                                                    className="input-small"
                                                />
                                            </td>
                                            <td><strong>{qt.marks * qt.count}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="total-row">
                                        <td colSpan={2}><strong>Total</strong></td>
                                        <td><strong>{getTotalQuestions()} Questions</strong></td>
                                        <td><strong>{getTotalMarks()} Marks</strong></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        <div className="exam-details-section" style={{ marginTop: '2rem' }}>
                            <h3 style={{ marginBottom: '1rem', fontSize: '18px', fontWeight: 600 }}>Exam Details</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                        Exam Name <span style={{ color: '#ef4444' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={examName}
                                        onChange={(e) => setExamName(e.target.value)}
                                        placeholder="e.g., First Terminal Exam, Mid-Term Exam"
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            fontSize: '14px'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                                        Duration (Hours)
                                    </label>
                                    <input
                                        type="number"
                                        min="0.5"
                                        step="0.5"
                                        value={examDuration}
                                        onChange={(e) => setExamDuration(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '0.75rem',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '8px',
                                            fontSize: '14px'
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {step === 5 && (
                    <div className="selection-card">
                        <div className="card-header">
                            <Sparkles size={24} />
                            <h2>Configure Difficulty Level</h2>
                        </div>
                        <p className="helper-text">Adjust the percentage distribution across difficulty levels (must total 100%)</p>

                        <div className="difficulty-config">
                            {difficultyLevels.map((dl, idx) => (
                                <div key={idx} className="difficulty-item">
                                    <div className="difficulty-header">
                                        <div className="difficulty-name" style={{ color: dl.color }}>
                                            <div
                                                className="difficulty-dot"
                                                style={{ background: dl.color }}
                                            ></div>
                                            {dl.name}
                                        </div>
                                        <div className="difficulty-value">{dl.percentage}%</div>
                                    </div>
                                    <div className="difficulty-slider-container">
                                        <input
                                            type="range"
                                            min="0"
                                            max="100"
                                            step="5"
                                            value={dl.percentage}
                                            onChange={(e) => updateDifficultyLevel(idx, parseInt(e.target.value))}
                                            className="difficulty-slider"
                                            style={{
                                                background: `linear-gradient(to right, ${dl.color} 0%, ${dl.color} ${dl.percentage}%, #e2e8f0 ${dl.percentage}%, #e2e8f0 100%)`
                                            }}
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="5"
                                            value={dl.percentage}
                                            onChange={(e) => updateDifficultyLevel(idx, parseInt(e.target.value) || 0)}
                                            className="input-small"
                                            style={{ width: '70px', marginLeft: '1rem' }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className={`difficulty-total ${getTotalDifficultyPercentage() === 100 ? 'valid' : 'invalid'}`}>
                            <strong>Total: {getTotalDifficultyPercentage()}%</strong>
                            {getTotalDifficultyPercentage() !== 100 && (
                                <span className="error-text">Must equal 100%</span>
                            )}
                            {getTotalDifficultyPercentage() === 100 && (
                                <span className="success-text">✓ Perfect!</span>
                            )}
                        </div>
                    </div>
                )}

                {step === 6 && (
                    <div className="generated-paper-card">
                        <div className="card-header">
                            <Sparkles size={24} />
                            <h2>Generated Question Paper</h2>
                        </div>
                        <div className="action-buttons">
                            <button onClick={handlePrint} className="btn btn-primary">
                                <Printer size={18} />
                                Print
                            </button>
                            <button onClick={handleDownload} className="btn btn-secondary">
                                <Download size={18} />
                                Download
                            </button>
                            <button
                                onClick={() => {
                                    if ((window as any).MathJax) {
                                        (window as any).MathJax.typesetPromise?.()
                                            .then(() => alert('Math formulas rendered!'))
                                            .catch((err: any) => alert('Error: ' + err.message));
                                    } else {
                                        alert('MathJax not loaded yet. Please wait a moment and try again.');
                                    }
                                }}
                                className="btn btn-secondary"
                                title="Click to render LaTeX formulas"
                            >
                                <Sparkles size={18} />
                                Render Math
                            </button>
                            <button onClick={resetForm} className="btn btn-outline">
                                <Edit2 size={18} />
                                Generate New
                            </button>
                        </div>
                        <div className="paper-preview" dangerouslySetInnerHTML={{ __html: convertMarkdownToHTML(generatedPaper) }} />
                    </div>
                )}
            </div>

            {/* Navigation Buttons */}
            {step < 6 && (
                <div className="navigation-buttons">
                    {step > 1 && (
                        <button
                            onClick={() => setStep(step - 1)}
                            className="btn btn-outline"
                        >
                            <ChevronLeft size={18} />
                            Previous
                        </button>
                    )}
                    <div style={{ flex: 1 }}></div>
                    {step < 5 ? (
                        <button
                            onClick={() => setStep(step + 1)}
                            disabled={!canProceed()}
                            className="btn btn-primary"
                        >
                            Next
                            <ChevronRight size={18} />
                        </button>
                    ) : (
                        <button
                            onClick={generateQuestionPaper}
                            disabled={!canProceed() || isGenerating}
                            className="btn btn-primary"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={18} />
                                    Generate Question Paper
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}


            <style>{`
                .question-generator-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 2rem;
                }

                .header-section {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 3rem;
                    gap: 2rem;
                }

                .header-content {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                }

                .header-icon {
                    width: 60px;
                    height: 60px;
                    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                }

                .page-title {
                    font-size: 2rem;
                    font-weight: 800;
                    color: #1e293b;
                    margin: 0;
                }

                .page-subtitle {
                    font-size: 1rem;
                    color: #64748b;
                    margin: 0.25rem 0 0 0;
                }

                /* Stepper */
                .stepper {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 3rem;
                    position: relative;
                    padding: 0 2rem;
                }

                .stepper::before {
                    content: '';
                    position: absolute;
                    top: 20px;
                    left: 10%;
                    right: 10%;
                    height: 2px;
                    background: #e2e8f0;
                    z-index: 0;
                }

                .step {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.5rem;
                    position: relative;
                    z-index: 1;
                }

                .step-circle {
                    width: 40px;
                    height: 40px;
                    border-radius: 50%;
                    background: #f1f5f9;
                    color: #94a3b8;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    transition: all 0.3s ease;
                }

                .step.active .step-circle {
                    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                    color: white;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                }

                .step.completed .step-circle {
                    background: #10b981;
                    color: white;
                }

                .step-label {
                    font-size: 0.875rem;
                    color: #64748b;
                    font-weight: 600;
                    text-align: center;
                }

                .step.active .step-label {
                    color: #6366f1;
                }

                /* Cards */
                .selection-card, .generated-paper-card {
                    background: white;
                    border-radius: 20px;
                    padding: 2rem;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    margin-bottom: 2rem;
                }

                .card-header {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                    color: #6366f1;
                }

                .card-header h2 {
                    margin: 0;
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: #1e293b;
                }

                .helper-text {
                    color: #64748b;
                    margin-bottom: 1.5rem;
                }

                .options-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                    gap: 1rem;
                }

                .option-card {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 1.25rem;
                    background: #f8fafc;
                    border: 2px solid #e2e8f0;
                    border-radius: 12px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-weight: 600;
                    color: #475569;
                }

                .option-card:hover {
                    background: #f1f5f9;
                    border-color: #cbd5e1;
                    transform: translateY(-2px);
                }

                .option-card.selected {
                    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                    border-color: #6366f1;
                    color: white;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                }

                .chapters-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                    margin-bottom: 1.5rem;
                }

                .chapter-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 1rem;
                    background: #f8fafc;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .chapter-item:hover {
                    background: #f1f5f9;
                }

                .chapter-item input[type="checkbox"] {
                    width: 20px;
                    height: 20px;
                    cursor: pointer;
                    accent-color: #6366f1;
                }

                .chapter-item span {
                    font-weight: 500;
                    color: #334155;
                }

                .selected-summary {
                    background: #eff6ff;
                    padding: 1rem;
                    border-radius: 10px;
                    color: #1e40af;
                }

                /* Difficulty Level Configuration */
                .difficulty-config {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                }

                .difficulty-item {
                    background: #f8fafc;
                    padding: 1.5rem;
                    border-radius: 12px;
                    border: 2px solid #e2e8f0;
                    transition: all 0.3s ease;
                }

                .difficulty-item:hover {
                    background: white;
                    border-color: #cbd5e1;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                }

                .difficulty-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .difficulty-name {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-weight: 700;
                    font-size: 1.125rem;
                }

                .difficulty-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 50%;
                    box-shadow: 0 0 8px currentColor;
                }

                .difficulty-value {
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: #1e293b;
                }

                .difficulty-slider-container {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .difficulty-slider {
                    flex: 1;
                    height: 8px;
                    border-radius: 10px;
                    outline: none;
                    -webkit-appearance: none;
                    cursor: pointer;
                }

                .difficulty-slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: white;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                    border: 3px solid currentColor;
                }

                .difficulty-slider::-moz-range-thumb {
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    background: white;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                    border: 3px solid currentColor;
                }

                .difficulty-total {
                    background: #f1f5f9;
                    padding: 1.5rem;
                    border-radius: 12px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 1.25rem;
                    border: 2px solid #e2e8f0;
                }

                .difficulty-total.valid {
                    background: #ecfdf5;
                    border-color: #10b981;
                }

                .difficulty-total.invalid {
                    background: #fef2f2;
                    border-color: #ef4444;
                }

                .error-text {
                    color: #ef4444;
                    font-weight: 600;
                    font-size: 0.875rem;
                }

                .success-text {
                    color: #10b981;
                    font-weight: 600;
                    font-size: 0.875rem;
                }

                .question-pattern-table {
                    overflow-x: auto;
                }

                .question-pattern-table table {
                    width: 100%;
                    border-collapse: collapse;
                }

                .question-pattern-table th,
                .question-pattern-table td {
                    padding: 1rem;
                    text-align: left;
                    border-bottom: 1px solid #e2e8f0;
                }

                .question-pattern-table th {
                    background: #f8fafc;
                    font-weight: 700;
                    color: #475569;
                }

                .input-small {
                    width: 80px;
                    padding: 0.5rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    font-size: 0.875rem;
                }

                .total-row {
                    background: #f1f5f9;
                    font-weight: 700;
                }

                .action-buttons {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 2rem;
                }

                .paper-preview {
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    padding: 3rem;
                    max-height: 600px;
                    overflow-y: auto;
                    font-family: 'Times New Roman', serif;
                    line-height: 1.8;
                    color: #1a1a1a;
                }

                .paper-preview h1 {
                    text-align: center;
                    font-size: 24px;
                    font-weight: bold;
                    margin: 1rem 0;
                    text-transform: uppercase;
                }

                .paper-preview h2 {
                    font-size: 18px;
                    font-weight: bold;
                    margin: 1.5rem 0 1rem 0;
                    background: #f0f0f0;
                    padding: 0.5rem;
                    border-left: 4px solid #333;
                }

                .paper-preview h3 {
                    font-size: 16px;
                    font-weight: bold;
                    margin: 1rem 0 0.5rem 0;
                }

                .paper-preview p {
                    margin: 0.5rem 0;
                }

                .paper-preview ul,
                .paper-preview ol {
                    margin: 0.5rem 0;
                    padding-left: 2rem;
                }

                .paper-preview li {
                    margin: 0.25rem 0;
                }

                .paper-preview strong {
                    font-weight: bold;
                }

                .paper-preview hr {
                    border: none;
                    border-top: 2px solid #333;
                    margin: 1rem 0;
                }

                .paper-preview table.matching-table {
                    border-collapse: collapse;
                    width: 100%;
                    margin: 0 0 1rem 0;
                    border: 2px solid #333;
                }

                .paper-preview table.matching-table th,
                .paper-preview table.matching-table td {
                    border: 1px solid #333;
                    padding: 0.75rem;
                    text-align: left;
                }

                .paper-preview table.matching-table th {
                    background: #f0f0f0;
                    font-weight: bold;
                }

                .paper-preview .matching-columns {
                    display: flex;
                    gap: 2rem;
                    margin: 1rem 0;
                }

                .paper-preview .matching-columns .column-a,
                .paper-preview .matching-columns .column-b {
                    flex: 1;
                }

                .paper-preview .matching-columns strong {
                    display: block;
                    margin-bottom: 0.5rem;
                    font-size: 16px;
                    font-weight: bold;
                }

                .navigation-buttons {
                    display: flex;
                    gap: 1rem;
                    margin-top: 2rem;
                }

                .btn {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    padding: 0.75rem 1.5rem;
                    border-radius: 10px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border: none;
                }

                .btn-primary {
                    background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
                    color: white;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                }

                .btn-primary:hover:not(:disabled) {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
                }

                .btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .btn-secondary {
                    background: #f1f5f9;
                    color: #475569;
                    border: 1px solid #e2e8f0;
                }

                .btn-secondary:hover {
                    background: #e2e8f0;
                }

                .btn-outline {
                    background: white;
                    color: #6366f1;
                    border: 2px solid #6366f1;
                }

                .btn-outline:hover {
                    background: #f5f3ff;
                }

                .empty-state {
                    text-align: center;
                    padding: 3rem;
                    color: #64748b;
                }

                /* Modal */
                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                    backdrop-filter: blur(4px);
                }

                .modal-content {
                    background: white;
                    border-radius: 20px;
                    width: 90%;
                    max-width: 800px;
                    max-height: 90vh;
                    display: flex;
                    flex-direction: column;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1.5rem 2rem;
                    border-bottom: 1px solid #e2e8f0;
                }

                .modal-header h2 {
                    margin: 0;
                    font-size: 1.5rem;
                    font-weight: 700;
                }

                .close-btn {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: #64748b;
                    padding: 0.5rem;
                    border-radius: 6px;
                    transition: all 0.2s ease;
                }

                .close-btn:hover {
                    background: #f1f5f9;
                }

                .modal-tabs {
                    display: flex;
                    padding: 0 2rem;
                    border-bottom: 1px solid #e2e8f0;
                }

                .tab {
                    padding: 1rem 1.5rem;
                    background: none;
                    border: none;
                    border-bottom: 2px solid transparent;
                    cursor: pointer;
                    font-weight: 600;
                    color: #64748b;
                    transition: all 0.2s ease;
                }

                .tab.active {
                    color: #6366f1;
                    border-bottom-color: #6366f1;
                }

                .modal-body {
                    padding: 2rem;
                    overflow-y: auto;
                    flex: 1;
                }

                .add-form {
                    display: flex;
                    gap: 1rem;
                    margin-bottom: 1.5rem;
                }

                .input-field {
                    flex: 1;
                    padding: 0.75rem;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    font-size: 0.875rem;
                }

                .data-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .data-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 1rem;
                    background: #f8fafc;
                    border-radius: 8px;
                }

                .delete-btn {
                    background: #fee2e2;
                    color: #ef4444;
                    border: none;
                    padding: 0.5rem;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }

                .delete-btn:hover {
                    background: #fecaca;
                }

                .modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 1rem;
                    padding: 1.5rem 2rem;
                    border-top: 1px solid #e2e8f0;
                }

                @media (max-width: 768px) {
                    .header-section {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .stepper {
                        padding: 0;
                        overflow-x: auto;
                    }

                    .step-label {
                        font-size: 0.75rem;
                    }

                    .options-grid {
                        grid-template-columns: 1fr;
                    }

                    .add-form {
                        flex-direction: column;
                    }

                    .action-buttons {
                        flex-direction: column;
                    }
                }

                .animate-spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default QuestionGenerator;
