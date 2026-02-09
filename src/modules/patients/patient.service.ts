import { logger } from '../../config/logger.js';
import { supabaseAdmin } from '../../database/supabase-admin.js';
import { appointmentService } from '../appointments/appointment.service.js';
import { prescriptionService } from '../prescriptions/prescription.service.js';
import { userRepository } from '../../database/repositories/user.repo.js';
import type { PatientDashboardData, ActivityTimelineItem } from './patient.types.js';

class PatientService {
    private log = logger.child('PatientService');
    private supabase = supabaseAdmin;

    async getDashboardData(userId: string): Promise<PatientDashboardData> {
        const user = await userRepository.findWithDetails(userId);
        if (!user) {
            throw new Error('User not found');
        }

        // Parallel data fetching for stats
        const [stats, upcomingAppointments, recentPrescriptions, recentPayments, recentDocs] = await Promise.all([
            this.getStats(userId),
            this.getUpcomingAppointments(userId),
            this.getRecentPrescriptions(userId),
            this.getRecentPayments(userId),
            this.getRecentDocuments(userId)
        ]);

        // Construct activity timeline
        const activityTimeline = this.constructTimeline([
            ...upcomingAppointments.map(a => ({
                id: a.id,
                type: 'appointment' as const,
                title: `Appointment with Dr. ${a.doctorName}`,
                description: `Status: ${a.status} at ${a.hospitalName}`,
                timestamp: a.appointmentDate || new Date().toISOString()
            })),
            ...recentPrescriptions.map(p => ({
                id: p.id,
                type: 'prescription' as const,
                title: 'New Prescription Received',
                description: `From Dr. ${p.doctor?.users?.name || 'Doctor'}`,
                timestamp: p.created_at
            })),
            ...recentPayments.map(pay => ({
                id: pay.id,
                type: 'payment' as const,
                title: `Payment ${pay.status}`,
                description: `Amount: ₹${pay.amount} for appointment`,
                timestamp: pay.completed_at || pay.created_at
            })),
            ...recentDocs.map(doc => ({
                id: doc.id,
                type: 'record' as const,
                title: 'Health Record Uploaded',
                description: doc.document_name,
                timestamp: doc.created_at
            }))
        ]);

        return {
            user: {
                id: user.id,
                name: user.name || 'User',
                email: user.email,
                phone: user.phone,
                avatar_url: user.avatar_url
            },
            stats,
            upcomingAppointments: upcomingAppointments.slice(0, 2),
            activityTimeline: activityTimeline.slice(0, 5)
        };
    }

    private async getStats(userId: string) {
        const aptStats = await appointmentService.getStats(userId, 'patient');

        const { count: prescriptionCount } = await this.supabase
            .from('prescriptions')
            .select('*', { count: 'exact', head: true })
            .eq('patient_id', userId);

        const { count: recordCount } = await this.supabase
            .from('health_documents')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId);

        return {
            upcomingAppointments: aptStats.upcoming,
            completedConsultations: aptStats.completed,
            prescriptions: prescriptionCount || 0,
            healthRecords: recordCount || 0
        };
    }

    private async getUpcomingAppointments(userId: string) {
        const { appointments } = await appointmentService.list({
            patient_id: userId,
            status: ['confirmed', 'rescheduled', 'pending_payment'],
            date_from: new Date().toISOString().split('T')[0],
            limit: 5,
            sort_by: 'date',
            sort_order: 'asc'
        });
        return appointments;
    }

    private async getRecentPrescriptions(userId: string) {
        const { prescriptions } = await prescriptionService.getPatientPrescriptions(userId, 1, 5);
        return prescriptions;
    }

    private async getRecentPayments(userId: string) {
        const { data } = await this.supabase
            .from('payments')
            .select('*')
            .eq('payer_user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);
        return data || [];
    }

    private async getRecentDocuments(userId: string) {
        const { data } = await this.supabase
            .from('health_documents')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(5);
        return data || [];
    }

    private constructTimeline(items: any[]): ActivityTimelineItem[] {
        return items
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
}

export const patientService = new PatientService();
