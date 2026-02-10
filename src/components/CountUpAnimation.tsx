import React, { useState, useEffect } from 'react';

interface CountUpAnimationProps {
    end: number;
    duration?: number;
    suffix?: string;
    decimals?: number;
}

export const CountUpAnimation: React.FC<CountUpAnimationProps> = ({ end, duration = 2000, suffix = '', decimals = 0 }) => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        const startValue = 0;

        const step = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);

            // Ease out quart: 1 - (1-x)^4 - smooth deceleration
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);

            const current = startValue + (end - startValue) * easeOutQuart;
            setCount(current);

            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };

        window.requestAnimationFrame(step);
    }, [end, duration]);

    return <>{count.toFixed(decimals)}{suffix}</>;
};
