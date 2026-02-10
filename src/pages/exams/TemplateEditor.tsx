import React, { useState, useEffect } from 'react';
import {
    Layout,
    Save,
    Smartphone,
    Monitor,
    Type,
    Palette,
    FileText,
    Award,
    CheckCircle,
    RotateCcw,
    Eye
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';

interface TemplateConfig {
    id: string;
    schoolId: string;
    type: 'admit_card' | 'report_card';
    templateId: string;
    accentColor: string;
    schoolLogo?: string;
    customMessage?: string;
    showQrCode: boolean;
    includeGraphs: boolean;
    updatedAt: string;
}

const TemplateEditor: React.FC = () => {
    const { currentSchool } = useSchool();
    const { data: templates, add: addDocument, update: updateDocument } = useFirestore<TemplateConfig>('exam_templates');

    const [activeTab, setActiveTab] = useState<'admit_card' | 'report_card'>('admit_card');
    const [config, setConfig] = useState<Partial<TemplateConfig>>({
        type: 'admit_card',
        templateId: 'basic',
        accentColor: '#1e40af',
        showQrCode: true,
        includeGraphs: true,
        customMessage: ''
    });

    const currentTemplate = templates?.find(t => t.schoolId === currentSchool?.id && t.type === activeTab);

    useEffect(() => {
        if (currentTemplate) {
            setConfig(currentTemplate);
        } else {
            setConfig({
                type: activeTab,
                templateId: 'basic',
                accentColor: activeTab === 'admit_card' ? '#1e40af' : '#10b981',
                showQrCode: true,
                includeGraphs: true,
                customMessage: ''
            });
        }
    }, [currentTemplate, activeTab]);

    const handleSave = async () => {
        if (!currentSchool?.id) return;

        const data = {
            ...config,
            schoolId: currentSchool.id,
            updatedAt: new Date().toISOString()
        };

        try {
            if (currentTemplate?.id) {
                await updateDocument(currentTemplate.id, data);
            } else {
                await addDocument(data as TemplateConfig);
            }
            alert('Template settings saved successfully!');
        } catch (error) {
            console.error('Error saving template:', error);
            alert('Failed to save settings');
        }
    };

    const PreviewCard = () => {
        const isAdmitCard = activeTab === 'admit_card';
        return (
            <div style={{
                background: 'white',
                borderRadius: '1rem',
                border: `2px solid ${config.accentColor}`,
                padding: '2rem',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                width: '100%',
                maxWidth: '500px',
                margin: '0 auto'
            }}>
                <div style={{ background: config.accentColor, padding: '1rem', borderRadius: '0.5rem', textAlign: 'center', marginBottom: '1.5rem', color: 'white' }}>
                    <h4 style={{ margin: 0 }}>{currentSchool?.name || 'School Name'}</h4>
                    <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.9 }}>{isAdmitCard ? 'ADMIT CARD' : 'PROGRESS REPORT'}</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ width: '60px', height: '80px', border: `1px dashed ${config.accentColor}`, borderRadius: '4px' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ height: '12px', width: '80%', background: '#f1f5f9', marginBottom: '0.5rem', borderRadius: '2px' }} />
                        <div style={{ height: '12px', width: '50%', background: '#f1f5f9', marginBottom: '0.5rem', borderRadius: '2px' }} />
                        <div style={{ height: '12px', width: '60%', background: '#f1f5f9', borderRadius: '2px' }} />
                    </div>
                </div>

                {!isAdmitCard && config.includeGraphs && (
                    <div style={{ height: '80px', background: '#f8fafc', borderRadius: '4px', marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-end', gap: '4px', padding: '8px' }}>
                        {[40, 70, 50, 90, 60].map((h, i) => (
                            <div key={i} style={{ flex: 1, background: config.accentColor, height: `${h}%`, borderRadius: '2px 2px 0 0', opacity: 0.6 }} />
                        ))}
                    </div>
                )}

                {config.showQrCode && (
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ width: '40px', height: '40px', background: '#334155', display: 'inline-block', borderRadius: '4px' }} />
                    </div>
                )}

                <p style={{ fontSize: '0.625rem', color: '#64748b', marginTop: '1rem', textAlign: 'center', fontStyle: 'italic' }}>
                    {config.customMessage || (isAdmitCard ? 'Please report 15 mins before exam.' : 'Excellence is a habit.')}
                </p>
            </div>
        );
    };

    return (
        <div className="page-container">
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <h1 className="page-title">Exam Template Editor</h1>
                    <p className="page-subtitle">Personalize your admit cards and report cards with school branding</p>
                </div>
                <button onClick={handleSave} className="btn-primary">
                    <Save size={18} />
                    Save Changes
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
                {/* Configuration Panel */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div className="card" style={{ padding: '0' }}>
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                            <button
                                onClick={() => setActiveTab('admit_card')}
                                style={{
                                    flex: 1, padding: '1rem', border: 'none', background: 'transparent',
                                    fontWeight: activeTab === 'admit_card' ? 700 : 500,
                                    color: activeTab === 'admit_card' ? 'var(--primary)' : 'var(--text-muted)',
                                    borderBottom: activeTab === 'admit_card' ? '2px solid var(--primary)' : 'none'
                                }}
                            >
                                <FileText size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                                Admit Card
                            </button>
                            <button
                                onClick={() => setActiveTab('report_card')}
                                style={{
                                    flex: 1, padding: '1rem', border: 'none', background: 'transparent',
                                    fontWeight: activeTab === 'report_card' ? 700 : 500,
                                    color: activeTab === 'report_card' ? 'var(--primary)' : 'var(--text-muted)',
                                    borderBottom: activeTab === 'report_card' ? '2px solid var(--primary)' : 'none'
                                }}
                            >
                                <Award size={18} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                                Report Card
                            </button>
                        </div>

                        <div style={{ padding: '2rem' }}>
                            {/* Accent Color */}
                            <div className="form-group" style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <Palette size={16} /> Theme Accent Color
                                </label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                                    {['#1e40af', '#10b981', '#6366f1', '#f59e0b', '#ef4444', '#1f2937', '#7c3aed'].map(color => (
                                        <button
                                            key={color}
                                            onClick={() => setConfig({ ...config, accentColor: color })}
                                            style={{
                                                width: '36px', height: '36px', borderRadius: '50%',
                                                background: color, border: config.accentColor === color ? '3px solid white' : 'none',
                                                boxShadow: config.accentColor === color ? '0 0 0 2px var(--primary)' : 'none',
                                                cursor: 'pointer'
                                            }}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        value={config.accentColor}
                                        onChange={e => setConfig({ ...config, accentColor: e.target.value })}
                                        style={{ width: '36px', height: '36px', padding: 0, border: 'none', borderRadius: '50%', cursor: 'pointer' }}
                                    />
                                </div>
                            </div>

                            {/* Base Template */}
                            <div className="form-group" style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <Layout size={16} /> Visual Layout
                                </label>
                                <select className="input-field" value={config.templateId} onChange={e => setConfig({ ...config, templateId: e.target.value })}>
                                    <option value="basic">Standard Classic</option>
                                    <option value="modern">Modern Professional</option>
                                    <option value="premium">Premium Executive</option>
                                </select>
                            </div>

                            {/* Options */}
                            <div className="form-group" style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <Type size={16} /> Display Components
                                </label>
                                <div style={{ display: 'grid', gap: '1rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={config.showQrCode}
                                            onChange={e => setConfig({ ...config, showQrCode: e.target.checked })}
                                        />
                                        <span>Show Verification QR Code</span>
                                    </label>
                                    {activeTab === 'report_card' && (
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={config.includeGraphs}
                                                onChange={e => setConfig({ ...config, includeGraphs: e.target.checked })}
                                            />
                                            <span>Show Performance Analytics Graphs</span>
                                        </label>
                                    )}
                                </div>
                            </div>

                            {/* Custom Message */}
                            <div className="form-group">
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                    <FileText size={16} /> Footer Message / Instructions
                                </label>
                                <textarea
                                    className="input-field"
                                    rows={4}
                                    placeholder="Enter custom instructions or a motivational message..."
                                    value={config.customMessage}
                                    onChange={e => setConfig({ ...config, customMessage: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="card" style={{ padding: '1.5rem', background: 'var(--primary-glow)', border: '1px solid var(--primary-border)' }}>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                            <div style={{ padding: '0.5rem', background: 'white', borderRadius: '0.5rem', color: 'var(--primary)' }}>
                                <RotateCcw size={20} />
                            </div>
                            <div>
                                <h4 style={{ fontWeight: 700, margin: '0 0 0.25rem' }}>Auto-Sync Active</h4>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
                                    Templates updated here will be automatically applied whenever you generate or print cards in the future.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Preview Panel */}
                <div style={{ position: 'sticky', top: '2rem', height: 'fit-content' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 800 }}>Live Preview</h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn-secondary" style={{ padding: '0.375rem' }} title="Mobile View"><Smartphone size={16} /></button>
                            <button className="btn-secondary" style={{ padding: '0.375rem', color: 'var(--primary)' }} title="Desktop View"><Monitor size={16} /></button>
                        </div>
                    </div>

                    <div style={{
                        background: '#f1f5f9', borderRadius: '1.5rem', padding: '3rem',
                        minHeight: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '8px solid #cbd5e1'
                    }}>
                        <PreviewCard />
                    </div>

                    <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Eye size={14} /> Full fidelity preview
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemplateEditor;
