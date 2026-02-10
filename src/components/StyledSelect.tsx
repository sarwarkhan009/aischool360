import React from 'react';

interface StyledSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    children: React.ReactNode;
}

export const StyledSelect: React.FC<StyledSelectProps> = ({ children, style, ...props }) => {
    const selectStyle: React.CSSProperties = {
        height: '2.75rem',
        fontSize: '0.9rem',
        color: '#1e293b',
        WebkitTextFillColor: '#1e293b',
        border: '2px solid #e2e8f0',
        background: 'white',
        backgroundColor: 'white',
        opacity: 1,
        textShadow: 'none',
        borderRadius: '0.5rem',
        padding: '0 1rem',
        width: '100%',
        cursor: 'pointer',
        outline: 'none',
        WebkitAppearance: 'menulist',
        MozAppearance: 'menulist',
        appearance: 'menulist',
        ...style
    };

    return (
        <select
            {...props}
            style={selectStyle}
            className={`input-field ${props.className || ''}`}
        >
            {children}
        </select>
    );
};
