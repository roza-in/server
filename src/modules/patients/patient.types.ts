import type { AppointmentListItem } from '../appointments/appointment.types.js';

export interface PatientDashboardStats {
    upcomingAppointments: number;
    completedConsultations: number;
    prescriptions: number;
    healthRecords: number;
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
}
