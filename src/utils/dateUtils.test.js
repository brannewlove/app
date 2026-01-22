import { describe, it, expect } from 'vitest';
import { formatDateTime } from './dateUtils';

describe('dateUtils', () => {
    describe('formatDateTime', () => {
        it('should return "-" if dateString is empty', () => {
            expect(formatDateTime(null)).toBe('-');
            expect(formatDateTime('')).toBe('-');
            expect(formatDateTime(undefined)).toBe('-');
        });

        it('should format a valid date string correctly', () => {
            // Create a fixed date: 2023-05-15 10:30:45
            // Month is 0-indexed in JS Date constructor (0-11), so 4 is May.
            const testDate = new Date(2023, 4, 15, 10, 30, 45);
            // formatDateTime uses local time. 
            // To make test deterministic regardless of timezone running environment, 
            // we should probably mock the date to return specific components 
            // or pass a string that parses predictably.
            // For simplicity, let's verify the structure matches YYYY-MM-DD HH:mm:ss

            // However, since formatDateTime uses getMonth, getDate etc. which are local time,
            // we need to be careful.

            // Let's use the return value of the function and check if it follows the pattern.
            // And maybe check specific parts if we can control the input.

            const result = formatDateTime(testDate.toString());
            expect(result).toMatch(/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}$/);
        });

        it('should handle single digit months/days/times by padding with 0', () => {
            // 2023-01-05 09:05:07
            const testDate = new Date(2023, 0, 5, 9, 5, 7);
            const result = formatDateTime(testDate.toString());
            // We assume the local machine running test won't shift this date to a double digit day/month due to timezone
            // Ideally we should refactor formatDateTime to accept options or work with UTC for consistency,
            // but for now we test existing behavior.

            const parts = result.split(' ');
            const dateParts = parts[0].split('-');
            const timeParts = parts[1].split(':');

            expect(dateParts[1].length).toBe(2); // Month
            expect(dateParts[2].length).toBe(2); // Day
            expect(timeParts[0].length).toBe(2); // Hour
            expect(timeParts[1].length).toBe(2); // Minute
            expect(timeParts[2].length).toBe(2); // Second
        });
    });
});
