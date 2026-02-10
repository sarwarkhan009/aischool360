/**
 * Formats class and section for display
 * If section is empty/null, returns just the class name
 * Otherwise returns "Class X - Section Y"
 */
export const formatClassSection = (className: string, section?: string, useRoman: boolean = false): string => {
    if (!className) return '';
    const displayClass = formatClassName(className, useRoman);
    if (!section || section.trim() === '') return displayClass;
    return `${displayClass} - Section ${section}`;
};

/**
 * Returns short format for class-section display
 * E.g., "Class 6" or "Class 6 • А"
 */
export const formatClassSectionShort = (className: string, section?: string, useRoman: boolean = false): string => {
    if (!className) return '';
    const displayClass = formatClassName(className, useRoman);
    if (!section || section.trim() === '') return displayClass;
    return `${displayClass} • ${section}`;
};

/**
 * Converts a number to its word representation in English
 */
export const amountToWords = (amount: number): string => {
    if (amount === 0) return 'Zero Rupees Only';

    const single = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const double = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const format_hundreds = (num: number) => {
        let str = '';
        if (num > 99) {
            str += single[Math.floor(num / 100)] + ' Hundred ';
            num %= 100;
        }
        if (num > 19) {
            str += tens[Math.floor(num / 10)] + ' ';
            num %= 10;
        }
        if (num > 9) {
            str += double[num - 10] + ' ';
        } else if (num > 0) {
            str += single[num] + ' ';
        }
        return str;
    };

    let result = '';
    if (amount >= 100000) {
        result += format_hundreds(Math.floor(amount / 100000)) + 'Lakh ';
        amount %= 100000;
    }
    if (amount >= 1000) {
        result += format_hundreds(Math.floor(amount / 1000)) + 'Thousand ';
        amount %= 1000;
    }
    result += format_hundreds(amount);

    return result.trim() + ' Rupees Only';
};

/**
 * Converts text to Proper Case (Capitalizes first letter of each word)
 */
export const toProperCase = (text: string): string => {
    if (!text) return '';
    return text
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};
/**
 * Formats date and time as DD-MMM-YY HH:mm
 * E.g., 13 Jan 26 12:14
 */
export const formatDateTimeDetailed = (dateInput: string | number | Date): string => {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '';

    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-IN', { month: 'short' });
    const year = date.getFullYear().toString().slice(-2);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');

    return `${day} ${month} ${year} ${hours}:${minutes}`;
};

/**
 * Formats class name based on school preference (e.g., "Class 1" to "STD I")
 */
export const formatClassName = (className: string, useRoman: boolean = false): string => {
    if (!className) return '';
    if (!useRoman) return className;

    const romanMap = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

    // Check if it's in "Class X" format
    if (className.startsWith('Class ')) {
        const numPart = className.replace('Class ', '').trim();
        const num = parseInt(numPart);
        if (!isNaN(num) && num >= 1 && num <= 12) {
            return `STD ${romanMap[num - 1]}`;
        }
        return numPart; // Handle Nursery, LKG, UKG etc by returning just the name
    }

    return className;
};
