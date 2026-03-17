import type { AppointmentListItem } from '../appointments/appointment.types.js';

export interface PatientDashboardStats {
    upcomingAppointments: number;
    completedConsultations: number;
    prescriptions: number;
    healthRecords: number;
    pendingPayments: number;
    familyMembersCount: number;
    activeReminders: number;
}

export interface PatientVitals {
    blood_pressure_systolic: number | null;
    blood_pressure_diastolic: number | null;
    pulse_rate: number | null;
    temperature: number | null;
    weight: number | null;
    height: number | null;
    spo2: number | null;
    blood_sugar_fasting: number | null;
    blood_sugar_pp: number | null;
    bmi: number | null;
    recorded_at: string;
}

export type ActivityType = 'appointment' | 'prescription' | 'payment' | 'record';

export interface ActivityTimelineItem {
    id: string;
    type: ActivityType;
    title: string;
    description: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}

export interface PatientDashboardData {
    user: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        avatar_url: string | null;
    };
    stats: PatientDashboardStats;
    upcomingAppointments: AppointmentListItem[];
    activityTimeline: ActivityTimelineItem[];
    vitalsSnapshot: PatientVitals | null;
}
