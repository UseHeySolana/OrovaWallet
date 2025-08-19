/**
 * Utility functions for calendar date and time handling
 */

export interface TimeSlot {
    start: Date;
    end: Date;
    duration: number; // in minutes
}

export interface DateRange {
    start: Date;
    end: Date;
}

export interface RecurringPattern {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number; // every X days/weeks/months/years
    endDate?: Date;
    endAfter?: number; // number of occurrences
}

export class CalendarUtils {
    /**
     * Parse natural language date/time strings
     */
    static parseNaturalLanguageDateTime(text: string): Date | null {
        const now = new Date();
        const lowerText = text.toLowerCase();
        
        // Handle relative dates
        if (lowerText.includes('today')) {
            return new Date(now.getFullYear(), now.getMonth(), now.getDate());
        }
        
        if (lowerText.includes('tomorrow')) {
            const tomorrow = new Date(now);
            tomorrow.setDate(tomorrow.getDate() + 1);
            return tomorrow;
        }
        
        if (lowerText.includes('next week')) {
            const nextWeek = new Date(now);
            nextWeek.setDate(nextWeek.getDate() + 7);
            return nextWeek;
        }
        
        if (lowerText.includes('next month')) {
            const nextMonth = new Date(now);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            return nextMonth;
        }
        
        // Handle specific days
        const dayMap: { [key: string]: number } = {
            'monday': 1, 'tuesday': 2, 'wednesday': 3, 'thursday': 4,
            'friday': 5, 'saturday': 6, 'sunday': 0
        };
        
        for (const [day, dayNum] of Object.entries(dayMap)) {
            if (lowerText.includes(day)) {
                const targetDay = new Date(now);
                const currentDay = targetDay.getDay();
                let daysToAdd = (dayNum - currentDay + 7) % 7;
                if (daysToAdd === 0) daysToAdd = 7; // Next week
                targetDay.setDate(targetDay.getDate() + daysToAdd);
                return targetDay;
            }
        }
        
        // Handle time
        const timeMatch = text.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
        if (timeMatch) {
            let hours = parseInt(timeMatch[1]);
            const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
            const period = timeMatch[3]?.toLowerCase();
            
            if (period === 'pm' && hours !== 12) hours += 12;
            if (period === 'am' && hours === 12) hours = 0;
            
            const date = new Date(now);
            date.setHours(hours, minutes, 0, 0);
            return date;
        }
        
        return null;
    }

    /**
     * Format date for display
     */
    static formatDate(date: Date, format: 'short' | 'long' | 'time' | 'full' = 'short'): string {
        switch (format) {
            case 'short':
                return date.toLocaleDateString();
            case 'long':
                return date.toLocaleDateString(undefined, { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
            case 'time':
                return date.toLocaleTimeString(undefined, { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            case 'full':
                return date.toLocaleString();
            default:
                return date.toLocaleDateString();
        }
    }

    /**
     * Calculate duration between two dates in minutes
     */
    static calculateDuration(start: Date, end: Date): number {
        return Math.round((end.getTime() - start.getTime()) / (1000 * 60));
    }

    /**
     * Add duration to a date
     */
    static addDuration(date: Date, duration: number, unit: 'minutes' | 'hours' | 'days' = 'minutes'): Date {
        const newDate = new Date(date);
        switch (unit) {
            case 'minutes':
                newDate.setMinutes(newDate.getMinutes() + duration);
                break;
            case 'hours':
                newDate.setHours(newDate.getHours() + duration);
                break;
            case 'days':
                newDate.setDate(newDate.getDate() + duration);
                break;
        }
        return newDate;
    }

    /**
     * Check if two time slots overlap
     */
    static doTimeSlotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
        return slot1.start < slot2.end && slot1.end > slot2.start;
    }

    /**
     * Find available time slots in a given range
     */
    static findAvailableSlots(
        dateRange: DateRange, 
        busySlots: TimeSlot[], 
        duration: number,
        workingHours: { start: number; end: number } = { start: 9, end: 17 }
    ): TimeSlot[] {
        const availableSlots: TimeSlot[] = [];
        const currentDate = new Date(dateRange.start);
        
        while (currentDate <= dateRange.end) {
            // Skip weekends
            if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }
            
            const dayStart = new Date(currentDate);
            dayStart.setHours(workingHours.start, 0, 0, 0);
            
            const dayEnd = new Date(currentDate);
            dayEnd.setHours(workingHours.end, 0, 0, 0);
            
            let currentSlot = new Date(dayStart);
            
            while (currentSlot < dayEnd) {
                const slotEnd = this.addDuration(currentSlot, duration);
                
                if (slotEnd <= dayEnd) {
                    const timeSlot: TimeSlot = {
                        start: new Date(currentSlot),
                        end: slotEnd,
                        duration
                    };
                    
                    // Check if this slot conflicts with any busy slots
                    const hasConflict = busySlots.some(busySlot => 
                        this.doTimeSlotsOverlap(timeSlot, busySlot)
                    );
                    
                    if (!hasConflict) {
                        availableSlots.push(timeSlot);
                    }
                }
                
                currentSlot = this.addDuration(currentSlot, 30); // Move by 30 minutes
            }
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return availableSlots;
    }

    /**
     * Generate recurring dates based on pattern
     */
    static generateRecurringDates(
        startDate: Date, 
        pattern: RecurringPattern, 
        maxOccurrences: number = 50
    ): Date[] {
        const dates: Date[] = [startDate];
        let currentDate = new Date(startDate);
        let occurrenceCount = 1;
        
        while (occurrenceCount < maxOccurrences) {
            let nextDate: Date;
            
            switch (pattern.frequency) {
                case 'daily':
                    nextDate = new Date(currentDate);
                    nextDate.setDate(nextDate.getDate() + pattern.interval);
                    break;
                case 'weekly':
                    nextDate = new Date(currentDate);
                    nextDate.setDate(nextDate.getDate() + (pattern.interval * 7));
                    break;
                case 'monthly':
                    nextDate = new Date(currentDate);
                    nextDate.setMonth(nextDate.getMonth() + pattern.interval);
                    break;
                case 'yearly':
                    nextDate = new Date(currentDate);
                    nextDate.setFullYear(nextDate.getFullYear() + pattern.interval);
                    break;
                default:
                    break;
            }
            
            if (nextDate) {
                // Check end conditions
                if (pattern.endDate && nextDate > pattern.endDate) break;
                if (pattern.endAfter && occurrenceCount >= pattern.endAfter) break;
                
                dates.push(nextDate);
                currentDate = nextDate;
                occurrenceCount++;
            } else {
                break;
            }
        }
        
        return dates;
    }

    /**
     * Validate date range
     */
    static validateDateRange(start: Date, end: Date): { valid: boolean; error?: string } {
        if (start >= end) {
            return { valid: false, error: 'Start date must be before end date' };
        }
        
        const now = new Date();
        if (start < now) {
            return { valid: false, error: 'Start date cannot be in the past' };
        }
        
        const maxFutureDate = new Date();
        maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 10);
        if (end > maxFutureDate) {
            return { valid: false, error: 'End date cannot be more than 10 years in the future' };
        }
        
        return { valid: true };
    }

    /**
     * Get timezone offset string
     */
    static getTimezoneOffset(): string {
        const offset = new Date().getTimezoneOffset();
        const hours = Math.abs(Math.floor(offset / 60));
        const minutes = Math.abs(offset % 60);
        const sign = offset <= 0 ? '+' : '-';
        return `${sign}${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }

    /**
     * Convert date to ISO string with timezone
     */
    static toISOStringWithTimezone(date: Date): string {
        const tzOffset = date.getTimezoneOffset() * 60000;
        const localISOTime = new Date(date.getTime() - tzOffset).toISOString().slice(0, -1);
        return localISOTime + this.getTimezoneOffset();
    }

    /**
     * Parse ISO string and return local date
     */
    static fromISOString(isoString: string): Date {
        return new Date(isoString);
    }

    /**
     * Get human-readable relative time
     */
    static getRelativeTime(date: Date): string {
        const now = new Date();
        const diffInMinutes = Math.round((now.getTime() - date.getTime()) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'just now';
        if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;
        
        const diffInHours = Math.round(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;
        
        const diffInDays = Math.round(diffInHours / 24);
        if (diffInDays < 7) return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
        
        const diffInWeeks = Math.round(diffInDays / 7);
        if (diffInWeeks < 4) return `${diffInWeeks} week${diffInWeeks === 1 ? '' : 's'} ago`;
        
        return this.formatDate(date, 'short');
    }
}
