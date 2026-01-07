import { DAYS_OF_WEEK } from '../config/constants.js';

/**
 * Time utilities for the healthcare platform
 */

// Indian Standard Time offset (UTC+5:30)
const IST_OFFSET = 5.5 * 60 * 60 * 1000;

/**
 * Get current date in IST
 */
export const getCurrentDateIST = (): Date => {
  const now = new Date();
  return new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + IST_OFFSET);
};

/**
 * Get current time string in IST (HH:MM format)
 */
export const getCurrentTimeIST = (): string => {
  const now = getCurrentDateIST();
  return formatTime(now);
};

/**
 * Format date to YYYY-MM-DD
 */
export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0] ?? '';
};

/**
 * Format time to HH:MM
 */
export const formatTime = (date: Date): string => {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
};

/**
 * Format date-time to ISO string in IST
 */
export const formatDateTimeIST = (date: Date): string => {
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
};

/**
 * Parse time string (HH:MM) to Date object
 */
export const parseTime = (timeStr: string, baseDate?: Date): Date => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = baseDate ? new Date(baseDate) : new Date();
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date;
};

/**
 * Get day of week from date
 */
export const getDayOfWeek = (date: Date): string => {
  const dayIndex = date.getDay();
  return DAYS_OF_WEEK[dayIndex] ?? 'monday';
};

/**
 * Check if date is today
 */
export const isToday = (date: Date): boolean => {
  const today = getCurrentDateIST();
  return formatDate(date) === formatDate(today);
};

/**
 * Check if date is in the past
 */
export const isPastDate = (date: Date): boolean => {
  const today = getCurrentDateIST();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate < today;
};

/**
 * Check if date is in the future
 */
export const isFutureDate = (date: Date): boolean => {
  const today = getCurrentDateIST();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate > today;
};

/**
 * Add minutes to a time
 */
export const addMinutes = (date: Date, minutes: number): Date => {
  return new Date(date.getTime() + minutes * 60000);
};

/**
 * Add hours to a time
 */
export const addHours = (date: Date, hours: number): Date => {
  return new Date(date.getTime() + hours * 3600000);
};

/**
 * Add days to a date
 */
export const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Get difference between two dates in minutes
 */
export const diffInMinutes = (date1: Date, date2: Date): number => {
  return Math.floor((date1.getTime() - date2.getTime()) / 60000);
};

/**
 * Get difference between two dates in hours
 */
export const diffInHours = (date1: Date, date2: Date): number => {
  return Math.floor((date1.getTime() - date2.getTime()) / 3600000);
};

/**
 * Get difference between two dates in days
 */
export const diffInDays = (date1: Date, date2: Date): number => {
  return Math.floor((date1.getTime() - date2.getTime()) / 86400000);
};

/**
 * Check if time is within a range
 */
export const isTimeInRange = (
  time: string,
  startTime: string,
  endTime: string
): boolean => {
  const [timeHours, timeMinutes] = time.split(':').map(Number);
  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);

  const timeValue = (timeHours ?? 0) * 60 + (timeMinutes ?? 0);
  const startValue = (startHours ?? 0) * 60 + (startMinutes ?? 0);
  const endValue = (endHours ?? 0) * 60 + (endMinutes ?? 0);

  return timeValue >= startValue && timeValue < endValue;
};

/**
 * Generate time slots between start and end time
 */
export const generateTimeSlots = (
  startTime: string,
  endTime: string,
  slotDuration: number,
  bufferTime: number = 0
): string[] => {
  const slots: string[] = [];
  const totalInterval = slotDuration + bufferTime;

  const [startHours, startMinutes] = startTime.split(':').map(Number);
  const [endHours, endMinutes] = endTime.split(':').map(Number);

  let currentMinutes = (startHours ?? 0) * 60 + (startMinutes ?? 0);
  const endTotalMinutes = (endHours ?? 0) * 60 + (endMinutes ?? 0);

  while (currentMinutes + slotDuration <= endTotalMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const minutes = currentMinutes % 60;
    slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
    currentMinutes += totalInterval;
  }

  return slots;
};

/**
 * Format duration in minutes to human-readable string
 */
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${remainingMinutes} min`;
};

/**
 * Get start of day
 */
export const startOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
};

/**
 * Get end of day
 */
export const endOfDay = (date: Date): Date => {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
};

/**
 * Get start of week (Monday)
 */
export const startOfWeek = (date: Date): Date => {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
};

/**
 * Get start of month
 */
export const startOfMonth = (date: Date): Date => {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
};

/**
 * Calculate age from date of birth
 */
export const calculateAge = (dateOfBirth: Date): number => {
  const today = getCurrentDateIST();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }
  
  return age;
};

/**
 * Parse relative time string to Date
 * Supports: "1h", "30m", "7d", "1w"
 */
export const parseRelativeTime = (relativeTime: string): Date => {
  const match = relativeTime.match(/^(\d+)([mhdw])$/);
  if (!match) {
    throw new Error(`Invalid relative time format: ${relativeTime}`);
  }

  const value = parseInt(match[1] ?? '0', 10);
  const unit = match[2];
  const now = getCurrentDateIST();

  switch (unit) {
    case 'm':
      return addMinutes(now, value);
    case 'h':
      return addHours(now, value);
    case 'd':
      return addDays(now, value);
    case 'w':
      return addDays(now, value * 7);
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
};

/**
 * Get YYYY-MM format for month grouping
 */
export const getYearMonth = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${year}-${month}`;
};

/**
 * Convert a Date to IST timezone string
 */
export const toIST = (date: Date): string => {
  return date.toLocaleString('en-IN', { 
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

/**
 * Convert a Date to IST ISO string
 */
export const toISTISOString = (date: Date): string => {
  const istDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60000) + IST_OFFSET);
  return istDate.toISOString();
};
