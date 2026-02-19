export const APP_CONFIG = {
    name: 'Ai School 360',
    fullName: 'Ai School 360 - India\'s First AI based ERP System',
    logo: '/logo.jpg',
    favicon: '/logo.jpg',
};

export const SESSIONS = [
    '2025-26',
    '2026-27',
    '2027-28'
];

export const CLASS_ORDER = [
    'Pre-Nursery', 'Nursery', 'KG', 'Prep', 'LKG', 'UKG',
    ...Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`)
];

export const sortClasses = (classes: any[]) => {
    const normalize = (s: string) => (s || '')
        .toString()
        .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width spaces
        .trim()
        .replace(/\s+/g, ' ');

    const getDedupKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Deduplicate by name first (aggressive normalization)
    const uniqueMap = new Map();
    classes.forEach(item => {
        const name = typeof item === 'string' ? item : (item.name || '');
        const norm = normalize(name);
        if (!norm) return;

        const dedupKey = getDedupKey(norm);
        if (!uniqueMap.has(dedupKey)) {
            const processedItem = typeof item === 'string' ? norm : { ...item, name: norm };
            uniqueMap.set(dedupKey, processedItem);
        }
    });

    const uniqueClasses = Array.from(uniqueMap.values());

    const lowerOrder = CLASS_ORDER.map(c => normalize(c).toLowerCase());

    return uniqueClasses.sort((a, b) => {
        const nameA = normalize(typeof a === 'string' ? a : (a.name || ''));
        const nameB = normalize(typeof b === 'string' ? b : (b.name || ''));

        const lowerA = nameA.toLowerCase();
        const lowerB = nameB.toLowerCase();

        const indexA = lowerOrder.indexOf(lowerA);
        const indexB = lowerOrder.indexOf(lowerB);

        if (indexA === -1 && indexB === -1) return nameA.localeCompare(nameB);
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
    });
};

/**
 * Get only active classes (where active = true or active is undefined/not set)
 * Classes without the 'active' field are treated as enabled by default
 * Used for dropdowns, filters, and reports
 * @param classes - Array of class settings documents
 * @param financialYear - Optional financial year to filter by (e.g., '2025-2026')
 */
export const getActiveClasses = (classes: any[], financialYear?: string) => {
    let filtered = classes;
    if (financialYear) {
        // Only include classes that match the given financial year
        filtered = classes.filter((c: any) => c.financialYear === financialYear);
    }
    // Filter: include if active=true OR if active field doesn't exist (default enabled)
    const activeOnly = filtered.filter((c: any) => c.active !== false);
    return sortClasses(activeOnly);
};
