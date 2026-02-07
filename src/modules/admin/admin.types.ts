export interface DashboardStats {
  totalUsers: number;
  totalPatients: number;
  totalDoctors: number;
  totalHospitals: number;
  totalAppointments: number;
  totalRevenue?: number;
  pendingVerifications?: number;
  openTickets?: number;
  recentActivity?: any[];
}

export interface UserFilters {
  search?: string;
  role?: string;
  isActive?: boolean | string;
  isVerified?: boolean | string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface VerificationFilters {
  status?: string;
  page?: number;
  limit?: number;
}

export interface TicketFilters {
  status?: string;
  priority?: string;
  assignedTo?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface CreateTicketInput {
  subject: string;
  description: string;
  category: string;
  priority?: string;
  attachments?: string[];
}

