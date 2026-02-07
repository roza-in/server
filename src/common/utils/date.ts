/**
 * Parse duration string to seconds
 * Supports: s (seconds), m (minutes), h (hours), d (days), w (weeks)
 * Example: '1h' -> 3600, '7d' -> 604800
 */
export const parseDurationToSeconds = (duration: string): number => {
    if (!isNaN(Number(duration))) {
        return Number(duration);
    }

    const match = duration.match(/^(\d+)([smhdw])$/);
    if (!match) {
        return 3600;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
        case 's': return value;
        case 'm': return value * 60;
        case 'h': return value * 3600;
        case 'd': return value * 24 * 3600;
        case 'w': return value * 7 * 24 * 3600;
        default: return 3600;
    }
};

export const formatDate = (date: Date | string | number): string => {
    return new Date(date).toISOString().split('T')[0];
};

export const getStartOfDay = (date: Date = new Date()): Date => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
};

export const getCurrentIST = (): string => {
    // Create date object for current time
    const date = new Date();

    // Get UTC offset in minutes (IST is +330 minutes)
    const istOffset = 330;

    // Create new date adjusted for IST
    // We add the offset to make the UTC representation match the local IST time
    const istDate = new Date(date.getTime() + (istOffset * 60000));

    // Format to ISO and replace Z with +05:30
    return istDate.toISOString().replace('Z', '+05:30');
};

export const formatToIST = (utcString: string | null | undefined): string => {
    if (!utcString) return '';
    try {
        const date = new Date(utcString);
        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        }).format(date);
    } catch (e) {
        return utcString?.includes('T') ? utcString.split('T')[1].substring(0, 5) : utcString || '';
    }
};

export const formatAppointmentDate = (dateStr: string, timeStr: string): string => {
    try {
        const date = new Date(dateStr);
        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'short' });

        // Convert 24h time to 12h AM/PM
        const [hours, minutes] = timeStr.split(':').map(Number);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const hours12 = hours % 12 || 12;
        const time = `${hours12}:${minutes.toString().padStart(2, '0')} ${ampm}`;

        return `${day} ${month} at ${time}`;
    } catch (e) {
        return `${dateStr} at ${timeStr}`;
    }
};
