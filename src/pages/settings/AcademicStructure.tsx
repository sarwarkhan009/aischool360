import React from 'react';
import AcademicDataManager from '../../components/AcademicDataManager';
import { BookOpen } from 'lucide-react';

const AcademicStructure: React.FC = () => {
    return (
        <div className="animate-fade-in">
            <div className="header-section" style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                    }}>
                        <BookOpen size={24} />
                    </div>
                    <div>
                        <h1 className="page-title">Subjects & Chapters</h1>
                        <p className="page-subtitle">Manage academic subjects and chapter lists for all classes</p>
                    </div>
                </div>
            </div>

            <AcademicDataManager />
        </div>
    );
};

export default AcademicStructure;
