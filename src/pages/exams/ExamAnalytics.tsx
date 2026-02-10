import React, { useState, useMemo } from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar
} from 'recharts';
import {
    TrendingUp,
    TrendingDown,
    Award,
    Target,
    Users,
    BookOpen,
    Filter,
    Calendar,
    ChevronDown,
    ArrowRight,
    BarChart as BarChartIcon
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#3b82f6', '#14b8a6'];

const ExamAnalytics: React.FC = () => {
    const { currentSchool } = useSchool();
    const { data: exams } = useFirestore<any>('exams');
    const { data: marksEntries } = useFirestore<any>('marks_entries');
    const { data: academicYears } = useFirestore<any>('academic_years');
    const { data: allSettings } = useFirestore<any>('settings');

    const activeClasses = allSettings?.filter((d: any) => d.type === 'class' && d.active !== false) || [];

    const [selectedYearId, setSelectedYearId] = useState<string>('');
    const [selectedExamId, setSelectedExamId] = useState<string>('');

    const schoolYears = academicYears?.filter((y: any) => y.schoolId === currentSchool?.id) || [];
    const schoolExams = exams?.filter((e: any) => e.schoolId === currentSchool?.id && (selectedYearId ? e.academicYearId === selectedYearId : true)) || [];

    // Analytics Data Calculation
    const analyticsData = useMemo(() => {
        if (!marksEntries || !schoolExams.length) return null;

        const currentExams = selectedExamId ? schoolExams.filter(e => e.id === selectedExamId) : schoolExams;
        const relevantMarks = marksEntries.filter((m: any) =>
            currentExams.some(e => e.id === m.examId) && (m.status === 'APPROVED' || m.status === 'SUBMITTED')
        );

        // 1. Class-wise Performance
        const classPerformance = activeClasses.map((cls: any) => {
            const classMarks = relevantMarks.filter((m: any) => m.classId === cls.id || m.className === cls.name);
            if (classMarks.length === 0) return { name: cls.name, passRate: 0, avg: 0 };

            let totalStudents = 0;
            let totalPassed = 0;
            let totalObtained = 0;
            let totalMax = 0;

            classMarks.forEach((entry: any) => {
                entry.marks?.forEach((m: any) => {
                    if (!m.isNA) {
                        totalStudents++;
                        if (!m.isAbsent && m.percentage >= 40) totalPassed++;
                        totalObtained += m.obtainedMarks || 0;
                        totalMax += entry.maxMarks || 100;
                    }
                });
            });

            return {
                name: cls.name,
                passRate: totalStudents > 0 ? (totalPassed / totalStudents) * 100 : 0,
                avg: totalMax > 0 ? (totalObtained / totalMax) * 100 : 0
            };
        }).filter(d => d.passRate > 0 || d.avg > 0);

        // 2. Grade Distribution
        const grades: { [key: string]: number } = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
        relevantMarks.forEach((entry: any) => {
            entry.marks?.forEach((m: any) => {
                if (m.isNA) return;
                const grade = m.grade || (m.isAbsent ? 'F' : 'F');
                if (grades[grade] !== undefined) grades[grade]++;
                else if (grade.includes('A')) grades['A']++;
            });
        });
        const gradeData = Object.keys(grades).map(g => ({ name: g, value: grades[g] })).filter(d => d.value > 0);

        // 3. Subject Mastery
        const subjectAverages: { [key: string]: { name: string, total: number, max: number } } = {};
        relevantMarks.forEach((entry: any) => {
            if (!subjectAverages[entry.subjectId]) {
                subjectAverages[entry.subjectId] = { name: entry.subjectName, total: 0, max: 0 };
            }
            entry.marks?.forEach((m: any) => {
                if (m.isNA) return;
                subjectAverages[entry.subjectId].total += m.obtainedMarks || 0;
                subjectAverages[entry.subjectId].max += entry.maxMarks || 100;
            });
        });
        const subjectData = Object.values(subjectAverages).map(s => ({
            name: s.name,
            average: s.max > 0 ? (s.total / s.max) * 100 : 0
        }));

        // Summary Stats
        const allMarks = relevantMarks.flatMap((rm: any) => rm.marks || []).filter(m => !m.isNA);
        const avgScore = allMarks.length > 0
            ? allMarks.reduce((acc, curr) => acc + (curr.percentage || 0), 0) / allMarks.length
            : 0;

        return { classPerformance, gradeData, subjectData, avgScore };
    }, [marksEntries, schoolExams, activeClasses, selectedExamId, selectedYearId]);

    return (
        <div className="page-container" style={{ background: '#f8fafc', color: '#1e293b' }}>
            <div className="page-header" style={{ marginBottom: '3rem', alignItems: 'flex-start' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                        <div style={{
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: 'white',
                            padding: '0.75rem',
                            borderRadius: '1rem',
                            boxShadow: '0 10px 15px -3px rgba(99, 102, 241, 0.3)'
                        }}>
                            <TrendingUp size={28} />
                        </div>
                        <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, letterSpacing: '-0.025em' }}>Exam Analytics</h1>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0 }}>Discover academic patterns and student performance insights</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: 'white',
                        padding: '0.5rem 1.25rem',
                        borderRadius: '1rem',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}>
                        <Calendar size={18} color="#6366f1" />
                        <select
                            style={{ border: 'none', background: 'transparent', fontWeight: 700, color: '#1e293b', appearance: 'none', paddingRight: '1rem', cursor: 'pointer' }}
                            value={selectedYearId}
                            onChange={(e) => setSelectedYearId(e.target.value)}
                        >
                            <option value="">All Academic Years</option>
                            {schoolYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
                        </select>
                        <ChevronDown size={16} color="#94a3b8" style={{ pointerEvents: 'none', marginLeft: '-0.75rem' }} />
                    </div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                        background: 'white',
                        padding: '0.5rem 1.25rem',
                        borderRadius: '1rem',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                    }}>
                        <Filter size={18} color="#6366f1" />
                        <select
                            style={{ border: 'none', background: 'transparent', fontWeight: 700, color: '#1e293b', appearance: 'none', paddingRight: '1rem', cursor: 'pointer' }}
                            value={selectedExamId}
                            onChange={(e) => setSelectedExamId(e.target.value)}
                        >
                            <option value="">All Exams</option>
                            {schoolExams.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select>
                        <ChevronDown size={16} color="#94a3b8" style={{ pointerEvents: 'none', marginLeft: '-0.75rem' }} />
                    </div>
                </div>
            </div>

            {analyticsData ? (
                <div className="animate-fade-in">
                    {/* Top Stats Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '3rem' }}>
                        {[
                            {
                                title: 'School Average',
                                value: `${analyticsData.avgScore.toFixed(1)}%`,
                                icon: <Award size={24} />,
                                color: '#6366f1',
                                footer: 'Across all subjects',
                                bg: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(79, 70, 229, 0.05) 100%)'
                            },
                            {
                                title: 'Top Class',
                                value: (analyticsData.classPerformance.sort((a, b) => b.avg - a.avg)[0]?.name || 'N/A').split('_')[0],
                                icon: <TrendingUp size={24} />,
                                color: '#10b981',
                                footer: `Highest performance`,
                                bg: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)'
                            },
                            {
                                title: 'Pass Rate',
                                value: `${(analyticsData.classPerformance.reduce((acc, curr) => acc + curr.passRate, 0) / (analyticsData.classPerformance.length || 1)).toFixed(0)}%`,
                                icon: <Target size={24} />,
                                color: '#f59e0b',
                                footer: 'School percentage',
                                bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%)'
                            },
                            {
                                title: 'Active Exams',
                                value: schoolExams.length,
                                icon: <BookOpen size={24} />,
                                color: '#ec4899',
                                footer: 'Academic assessment',
                                bg: 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(219, 39, 119, 0.05) 100%)'
                            }
                        ].map((card, i) => (
                            <div key={i} className="card" style={{
                                padding: '1.75rem',
                                position: 'relative',
                                overflow: 'hidden',
                                border: 'none',
                                background: card.bg,
                                borderRadius: '1.5rem',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)'
                            }}>
                                <div style={{
                                    background: 'white',
                                    color: card.color,
                                    width: '45px',
                                    height: '45px',
                                    borderRadius: '1rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: '1.25rem',
                                    boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                                }}>
                                    {card.icon}
                                </div>
                                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.title}</h3>
                                <h2 style={{ fontSize: '2.25rem', fontWeight: 900, color: '#1e293b', margin: 0, letterSpacing: '-0.02em' }}>{card.value}</h2>
                                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.5rem', fontWeight: 600 }}>{card.footer}</p>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '2rem' }}>
                        {/* Class Performance Bar Chart */}
                        <div className="card" style={{ padding: '2.5rem', borderRadius: '2rem', border: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Class-wise Mastery</h3>
                                    <p style={{ fontSize: '0.875rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>Performance comparison across all classes</p>
                                </div>
                                <div style={{ background: '#f8fafc', padding: '0.5rem 1rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontWeight: 700, color: '#6366f1' }}>
                                    Real-time Data
                                </div>
                            </div>
                            <div style={{ height: '350px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={analyticsData.classPerformance} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#6366f1" stopOpacity={1} />
                                                <stop offset="100%" stopColor="#818cf8" stopOpacity={0.8} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                                            tickFormatter={(val) => val.split('_')[0]}
                                        />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} unit="%" />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', padding: '12px' }}
                                            cursor={{ fill: '#f8fafc', radius: 10 }}
                                        />
                                        <Bar dataKey="passRate" name="Pass Rate" fill="url(#barGradient)" radius={[8, 8, 0, 0]} barSize={40} animationDuration={1500} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Grade Distribution Pie Chart */}
                        <div className="card" style={{ padding: '2.5rem', borderRadius: '2rem', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Grade Mix</h3>
                            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '2.5rem' }}>Overall student achievement levels</p>
                            <div style={{ height: '300px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={analyticsData.gradeData}
                                            innerRadius={80}
                                            outerRadius={110}
                                            paddingAngle={8}
                                            dataKey="value"
                                            animationBegin={200}
                                            animationDuration={1500}
                                        >
                                            {analyticsData.gradeData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} style={{ outline: 'none' }} strokeWidth={0} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                                        />
                                        <Legend
                                            verticalAlign="bottom"
                                            height={36}
                                            iconType="circle"
                                            formatter={(value) => <span style={{ color: '#64748b', fontWeight: 600, fontSize: '12px' }}>{value}</span>}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Subject Performance Radar Chart */}
                        <div className="card" style={{ padding: '2.5rem', borderRadius: '2rem', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Subject Mastery</h3>
                            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '2.5rem' }}>Skills profiling by curriculum area</p>
                            <div style={{ height: '350px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={analyticsData.subjectData}>
                                        <PolarGrid stroke="#e2e8f0" />
                                        <PolarAngleAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
                                        <PolarRadiusAxis axisLine={false} tick={false} />
                                        <Radar
                                            name="Average Score"
                                            dataKey="average"
                                            stroke="#6366f1"
                                            strokeWidth={3}
                                            fill="#6366f1"
                                            fillOpacity={0.15}
                                            animationDuration={2000}
                                        />
                                        <Tooltip />
                                    </RadarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Insights List */}
                        <div className="card" style={{ padding: '2.5rem', borderRadius: '2rem', border: '1px solid #e2e8f0' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '2rem' }}>Academic Insights</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {[
                                    {
                                        icon: <Award size={20} color="#6366f1" />,
                                        title: 'Top Performer',
                                        desc: `Class ${analyticsData.classPerformance.sort((a, b) => b.passRate - a.passRate)[0]?.name.split('_')[0] || 'N/A'} is leading with highest pass rate.`,
                                        bg: 'rgba(99, 102, 241, 0.08)'
                                    },
                                    {
                                        icon: <Target size={20} color="#f59e0b" />,
                                        title: 'Goal Progression',
                                        desc: `Academic score is currently at ${analyticsData.avgScore.toFixed(0)}% overall.`,
                                        bg: 'rgba(245, 158, 11, 0.08)'
                                    },
                                    {
                                        icon: <Users size={20} color="#10b981" />,
                                        title: 'Engagement',
                                        desc: 'Participation levels are stable across the school spectrum.',
                                        bg: 'rgba(16, 185, 129, 0.08)'
                                    }
                                ].map((insight, idx) => (
                                    <div key={idx} style={{ background: insight.bg, padding: '1.25rem', borderRadius: '1.25rem', display: 'flex', gap: '1rem', transition: 'transform 0.2s' }}>
                                        <div style={{ background: 'white', padding: '0.6rem', borderRadius: '0.75rem', height: 'fit-content', boxShadow: '0 2px 4px rgba(0,0,0,0.03)' }}>
                                            {insight.icon}
                                        </div>
                                        <div>
                                            <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.25rem 0', color: '#1e293b' }}>{insight.title}</h4>
                                            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, lineHeight: 1.5, fontWeight: 500 }}>{insight.desc}</p>
                                        </div>
                                    </div>
                                ))}
                                <button className="btn" style={{
                                    marginTop: '1rem',
                                    justifyContent: 'center',
                                    background: 'white',
                                    border: '1px solid #e2e8f0',
                                    color: '#6366f1',
                                    fontWeight: 700,
                                    padding: '0.85rem',
                                    borderRadius: '1.25rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                }}>
                                    Download Full Analytics <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="card" style={{ padding: '6rem 2rem', textAlign: 'center', borderRadius: '2rem', border: '2px dashed #e2e8f0' }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginBottom: '2rem',
                        background: '#f1f5f9',
                        width: '100px',
                        height: '100px',
                        borderRadius: '50%',
                        margin: '0 auto 1.5rem auto',
                        alignItems: 'center'
                    }}>
                        <BarChartIcon size={48} color="#94a3b8" />
                    </div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#334155' }}>Analytic Engines Idle</h2>
                    <p style={{ color: '#64748b', maxWidth: '450px', margin: '1rem auto', fontSize: '1.1rem', lineHeight: 1.6 }}>
                        We need examination and approval data to generate your vision. Ensure marks are published to see real-time insights.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="btn"
                        style={{ background: '#6366f1', color: 'white', padding: '0.75rem 2rem', borderRadius: '1rem', border: 'none', fontWeight: 700, marginTop: '1rem' }}
                    >
                        Try Refreshing
                    </button>
                </div>
            )}
        </div>
    );
};

export default ExamAnalytics;
