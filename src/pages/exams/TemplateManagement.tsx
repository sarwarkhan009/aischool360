import React, { useState, useEffect } from 'react';
import {
    Plus,
    Save,
    Trash2,
    Eye,
    Copy,
    Layout,
    Palette,
    CheckCircle,
    Edit2,
    Globe,
    Lock,
    Star
} from 'lucide-react';
import { useFirestore } from '../../hooks/useFirestore';
import { useSchool } from '../../context/SchoolContext';
import { useAuth } from '../../context/AuthContext';

interface ReportCardTemplate {
    id?: string;
    name: string;
    description: string;
    accentColor: string;
    headerStyle: 'modern' | 'classic' | 'minimal';
    fontFamily: string;
    showLogo: boolean;
    includeGraphs: boolean;
    includeRemarks: boolean;
    signatures: {
        teacher: string;
        incharge: string;
        principal: string;
    };
    customMessage: string;
    schoolId?: string; // If created by a specific school
    isPublic: boolean; // Available to all schools
    isDefault: boolean; // Default template
    supportsSingle: boolean; // Supports single exam report
    supportsMulti: boolean; // Supports combined/multi exam report
    createdAt: string;
    updatedAt: string;
    createdBy: string;
}

const DEFAULT_TEMPLATE: Partial<ReportCardTemplate> = {
    name: '',
    description: '',
    accentColor: '#1e40af',
    headerStyle: 'modern',
    fontFamily: 'Inter, sans-serif',
    showLogo: true,
    includeGraphs: true,
    includeRemarks: true,
    signatures: {
        teacher: 'CLASS TEACHER',
        incharge: 'EXAMINATION IN-CHARGE',
        principal: 'PRINCIPAL / HEADMASTER'
    },
    customMessage: '',
    isPublic: false,
    isDefault: false,
    supportsSingle: true,
    supportsMulti: true
};

const TemplateManagement: React.FC = () => {
    const { currentSchool, updateSchoolData } = useSchool();
    const { user } = useAuth();
    const { data: templates, add: addTemplate, update: updateTemplate, remove: deleteTemplate } = useFirestore<ReportCardTemplate>('report_card_templates');

    const [isCreating, setIsCreating] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<ReportCardTemplate | null>(null);
    const [formData, setFormData] = useState<Partial<ReportCardTemplate>>(DEFAULT_TEMPLATE);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>(currentSchool?.selectedReportCardTemplateId || '');

    // Filter templates: public templates + school's own templates
    const availableTemplates = templates?.filter(t =>
        t.isPublic || t.schoolId === currentSchool?.id
    ) || [];

    useEffect(() => {
        if (currentSchool?.selectedReportCardTemplateId) {
            setSelectedTemplateId(currentSchool.selectedReportCardTemplateId);
        }
    }, [currentSchool]);

    const handleCreateNew = () => {
        setFormData(DEFAULT_TEMPLATE);
        setEditingTemplate(null);
        setIsCreating(true);
    };

    const handleEdit = (template: ReportCardTemplate) => {
        setFormData(template);
        setEditingTemplate(template);
        setIsCreating(true);
    };

    const handleDuplicate = (template: ReportCardTemplate) => {
        const duplicated = {
            ...template,
            name: `${template.name} (Copy)`,
            id: undefined,
            schoolId: currentSchool?.id,
            isPublic: false,
            isDefault: false
        };
        setFormData(duplicated);
        setEditingTemplate(null);
        setIsCreating(true);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.description) {
            alert('कृपया Template Name और Description भरें');
            return;
        }

        try {
            const templateData: Partial<ReportCardTemplate> = {
                ...formData,
                schoolId: currentSchool?.id,
                updatedAt: new Date().toISOString(),
                createdBy: user?.id || user?.username || ''
            };

            if (editingTemplate?.id) {
                await updateTemplate(editingTemplate.id, templateData);
                alert('✅ Template successfully updated!');
            } else {
                await addTemplate({
                    ...templateData,
                    createdAt: new Date().toISOString()
                } as ReportCardTemplate);
                alert('✅ Template successfully created!');
            }

            setIsCreating(false);
            setFormData(DEFAULT_TEMPLATE);
            setEditingTemplate(null);
        } catch (error) {
            console.error('Error saving template:', error);
            alert('❌ Failed to save template');
        }
    };

    const handleDelete = async (templateId: string) => {
        if (!window.confirm('क्या आप सच में इस template को delete करना चाहते हैं?')) return;

        try {
            await deleteTemplate(templateId);
            alert('✅ Template deleted successfully!');
        } catch (error) {
            console.error('Error deleting template:', error);
            alert('❌ Failed to delete template');
        }
    };

    const handleSelectTemplate = async (templateId: string) => {
        try {
            if (updateSchoolData) {
                await updateSchoolData({
                    selectedReportCardTemplateId: templateId
                });
            }
            setSelectedTemplateId(templateId);
            alert('✅ Template selected successfully!');
        } catch (error) {
            console.error('Error selecting template:', error);
            alert('❌ Failed to select template');
        }
    };

    return (
        <div className="page-container">
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                        <div style={{
                            background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                            color: 'white',
                            padding: '0.6rem',
                            borderRadius: '1rem',
                            boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)'
                        }}>
                            <Layout size={24} />
                        </div>
                        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>Report Card Templates</h1>
                    </div>
                    <p className="page-subtitle">Manage और customize करें अपने progress report designs</p>
                </div>
                <button
                    onClick={handleCreateNew}
                    className="btn"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.75rem',
                        padding: '0.7rem 1.25rem',
                        fontWeight: 700,
                        boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
                    }}
                >
                    <Plus size={18} />
                    Create New Template
                </button>
            </div>

            {/* Template Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {availableTemplates.map(template => (
                    <div
                        key={template.id}
                        className="card"
                        style={{
                            padding: '1.5rem',
                            border: selectedTemplateId === template.id ? `2px solid ${template.accentColor}` : '1px solid #e2e8f0',
                            borderRadius: '1rem',
                            background: selectedTemplateId === template.id ? `${template.accentColor}05` : 'white',
                            transition: 'all 0.2s',
                            position: 'relative'
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    <h3 style={{ fontWeight: 800, fontSize: '1.125rem', margin: 0 }}>{template.name}</h3>
                                    {template.isDefault && (
                                        <Star size={16} fill="#f59e0b" color="#f59e0b" />
                                    )}
                                </div>
                                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>{template.description}</p>
                            </div>
                            <div
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '50%',
                                    background: template.accentColor,
                                    flexShrink: 0
                                }}
                            />
                        </div>

                        {/* Badges */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                            {template.isPublic && (
                                <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.375rem',
                                    background: '#dbeafe',
                                    color: '#1e40af',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                }}>
                                    <Globe size={12} />
                                    Public
                                </span>
                            )}
                            {template.schoolId === currentSchool?.id && !template.isPublic && (
                                <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.375rem',
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.25rem'
                                }}>
                                    <Lock size={12} />
                                    Private
                                </span>
                            )}
                            {template.supportsSingle && (
                                <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.375rem',
                                    background: '#dcfce7',
                                    color: '#15803d'
                                }}>
                                    Single
                                </span>
                            )}
                            {template.supportsMulti && (
                                <span style={{
                                    fontSize: '0.7rem',
                                    fontWeight: 700,
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.375rem',
                                    background: '#e0e7ff',
                                    color: '#4338ca'
                                }}>
                                    Multi
                                </span>
                            )}
                        </div>

                        {/* Features */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.8125rem', color: '#64748b' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Palette size={14} />
                                <span>Font: {template.fontFamily.split(',')[0]}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <span>✓ {template.includeGraphs ? 'Graphs' : 'No Graphs'}</span>
                                <span>✓ {template.includeRemarks ? 'Remarks' : 'No Remarks'}</span>
                                <span>✓ {template.showLogo ? 'Logo' : 'No Logo'}</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {selectedTemplateId !== template.id && (
                                <button
                                    onClick={() => handleSelectTemplate(template.id!)}
                                    className="btn"
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        fontSize: '0.8125rem',
                                        fontWeight: 700,
                                        background: template.accentColor,
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '0.5rem'
                                    }}
                                >
                                    Select Template
                                </button>
                            )}
                            {selectedTemplateId === template.id && (
                                <div
                                    style={{
                                        flex: 1,
                                        padding: '0.5rem',
                                        fontSize: '0.8125rem',
                                        fontWeight: 700,
                                        background: '#10b981',
                                        color: 'white',
                                        borderRadius: '0.5rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    <CheckCircle size={16} />
                                    Active Template
                                </div>
                            )}
                            <button
                                onClick={() => handleDuplicate(template)}
                                className="btn-secondary"
                                style={{ padding: '0.5rem', borderRadius: '0.5rem' }}
                                title="Duplicate"
                            >
                                <Copy size={16} />
                            </button>
                            {template.schoolId === currentSchool?.id && (
                                <>
                                    <button
                                        onClick={() => handleEdit(template)}
                                        className="btn-secondary"
                                        style={{ padding: '0.5rem', borderRadius: '0.5rem' }}
                                        title="Edit"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(template.id!)}
                                        className="btn-secondary"
                                        style={{ padding: '0.5rem', borderRadius: '0.5rem', color: '#ef4444' }}
                                        title="Delete"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Create/Edit Modal */}
            {isCreating && (
                <>
                    <div className="modal-overlay" onClick={() => setIsCreating(false)} />
                    <div className="modal" style={{ maxWidth: '700px', maxHeight: '90vh', overflow: 'auto' }}>
                        <div style={{ padding: '2rem' }}>
                            <h2 style={{ fontWeight: 800, marginBottom: '1.5rem' }}>
                                {editingTemplate ? 'Edit Template' : 'Create New Template'}
                            </h2>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {/* Basic Info */}
                                <div className="form-group">
                                    <label>Template Name *</label>
                                    <input
                                        type="text"
                                        className="input-field"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="e.g., Template 1, Modern Design, etc."
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Description *</label>
                                    <textarea
                                        className="input-field"
                                        rows={2}
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Brief description of this template"
                                    />
                                </div>

                                {/* Color & Style */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="form-group">
                                        <label>Accent Color</label>
                                        <input
                                            type="color"
                                            className="input-field"
                                            value={formData.accentColor}
                                            onChange={e => setFormData({ ...formData, accentColor: e.target.value })}
                                            style={{ height: '50px', cursor: 'pointer' }}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label>Header Style</label>
                                        <select
                                            className="input-field"
                                            value={formData.headerStyle}
                                            onChange={e => setFormData({ ...formData, headerStyle: e.target.value as any })}
                                        >
                                            <option value="modern">Modern</option>
                                            <option value="classic">Classic</option>
                                            <option value="minimal">Minimal</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Features */}
                                <div>
                                    <label style={{ fontWeight: 700, marginBottom: '0.75rem', display: 'block' }}>Template Features</label>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.showLogo}
                                                onChange={e => setFormData({ ...formData, showLogo: e.target.checked })}
                                            />
                                            Show School Logo
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.includeGraphs}
                                                onChange={e => setFormData({ ...formData, includeGraphs: e.target.checked })}
                                            />
                                            Include Performance Graphs
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.includeRemarks}
                                                onChange={e => setFormData({ ...formData, includeRemarks: e.target.checked })}
                                            />
                                            Include Teacher Remarks
                                        </label>
                                    </div>
                                </div>

                                {/* Supported Views */}
                                <div>
                                    <label style={{ fontWeight: 700, marginBottom: '0.75rem', display: 'block' }}>Supported Report Types</label>
                                    <div style={{ display: 'flex', gap: '1rem' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.supportsSingle}
                                                onChange={e => setFormData({ ...formData, supportsSingle: e.target.checked })}
                                            />
                                            Single Exam Report
                                        </label>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.supportsMulti}
                                                onChange={e => setFormData({ ...formData, supportsMulti: e.target.checked })}
                                            />
                                            Multi/Combined Report
                                        </label>
                                    </div>
                                </div>

                                {/* Visibility */}
                                <div>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={formData.isPublic}
                                            onChange={e => setFormData({ ...formData, isPublic: e.target.checked })}
                                        />
                                        <span style={{ fontWeight: 700 }}>Make this template public (visible to all schools)</span>
                                    </label>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                    <button
                                        onClick={handleSave}
                                        className="btn"
                                        style={{
                                            flex: 1,
                                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                            color: 'white',
                                            border: 'none',
                                            padding: '0.75rem',
                                            borderRadius: '0.5rem',
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '0.5rem'
                                        }}
                                    >
                                        <Save size={18} />
                                        {editingTemplate ? 'Update Template' : 'Create Template'}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsCreating(false);
                                            setFormData(DEFAULT_TEMPLATE);
                                            setEditingTemplate(null);
                                        }}
                                        className="btn-secondary"
                                        style={{ padding: '0.75rem 1.5rem' }}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default TemplateManagement;
