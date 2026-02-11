/**
 * Utility functions for academic year management
 */

// All months in order
const ALL_MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

/**
 * Get the months list for fee structure based on academic year start month
 * @param startMonth - Starting month of academic year (e.g., "April", "March", etc.)
 * @returns Array of months starting from the specified month
 */
export function getAcademicYearMonths(startMonth: string = "April"): string[] {
    // Always include "Admission_month" at the beginning
    const months = ["Admission_month"];

    // Find the index of start month
    const startIndex = ALL_MONTHS.findIndex(m => m.toLowerCase() === startMonth.toLowerCase());

    // If not found, default to April (index 3)
    const actualStartIndex = startIndex >= 0 ? startIndex : 3;

    // Create the rotated array: start from actualStartIndex, wrap around
    for (let i = 0; i < 12; i++) {
        const monthIndex = (actualStartIndex + i) % 12;
        months.push(ALL_MONTHS[monthIndex]);
    }

    return months;
}

/**
 * Get display label for academic year based on start month
 * @param startMonth - Starting month of academic year
 * @returns Display label like "April - March" or "March - February"
 */
export function getAcademicYearLabel(startMonth: string = "April"): string {
    const months = getAcademicYearMonths(startMonth);
    // Get first real month (skip "Admission_month") and last month
    const firstMonth = months[1];
    const lastMonth = months[months.length - 1];
    return `${firstMonth} - ${lastMonth}`;
}

/**
 * Get all available months for dropdown selection
 */
export function getAllMonths(): string[] {
    return ALL_MONTHS;
}

/**
 * Get month to JS Date month index (0-11) mapping
 * This is used for dues calculation where we need the actual calendar month index
 * @returns Record mapping month name to JS Date month index (0-11)
 */
export function getMonthIndexMap(): Record<string, number> {
    const map: Record<string, number> = {};
    ALL_MONTHS.forEach((month, index) => {
        map[month] = index; // January = 0, February = 1, ..., December = 11
    });
    return map;
}
