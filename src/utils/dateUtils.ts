export const formatDate = (dateInput: string | Date | any): string => {
    if (!dateInput) return '-';

    try {
        let date: Date;
        // Handle Firestore Timestamp
        if (dateInput?.toDate) {
            date = dateInput.toDate();
        } else {
            date = new Date(dateInput);
        }

        if (isNaN(date.getTime())) return String(dateInput);

        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear().toString().slice(-2);

        return `${day}-${month}-${year}`;
    } catch (error) {
        return String(dateInput);
    }
};

export const formatDateTime = (dateInput: string | Date | any): string => {
    if (!dateInput) return '-';

    try {
        let date: Date;
        // Handle Firestore Timestamp
        if (dateInput?.toDate) {
            date = dateInput.toDate();
        } else {
            date = new Date(dateInput);
        }

        if (isNaN(date.getTime())) return String(dateInput);

        const day = date.getDate().toString().padStart(2, '0');
        const month = date.toLocaleString('default', { month: 'short' });
        const year = date.getFullYear().toString().slice(-2);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');

        return `${day}-${month}-${year} ${hours}:${minutes}`;
    } catch (error) {
        return String(dateInput);
    }
};

export const getCurrentDate = (): string => {
    return new Date().toISOString().split('T')[0];
};

export const calculateAge = (dobString: string | undefined | null): { years: number; months: number } | null => {
    if (!dobString) return null;

    try {
        const birthDate = new Date(dobString);
        if (isNaN(birthDate.getTime())) return null;

        const today = new Date();
        let years = today.getFullYear() - birthDate.getFullYear();
        let months = today.getMonth() - birthDate.getMonth();

        if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
            years--;
            months += 12;
        }

        if (today.getDate() < birthDate.getDate()) {
            months--;
            if (months < 0) {
                months = 11;
                years--;
            }
        }

        return { years: Math.max(0, years), months: Math.max(0, months) };
    } catch (error) {
        return null;
    }
};
