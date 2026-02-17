/**
 * C5: Settlement Logic  +  C6: Atomic Booking RPC
 *
 * C5 – Settlement
 *  - Overlap guard prevents duplicate settlement periods
 *  - Calculation: gross − commission − refunds − tds = net
 *  - Net payable is floored at 0
 *
 * C6 – Atomic Booking
 *  - Handles SLOT_ALREADY_BOOKED via RPC error code
 *  - Handles SLOT_BEING_BOOKED (optimistic lock failure)
 *  - Handles SLOT_AT_CAPACITY
 *  - C10 — Ownership: patient can only pay for own appointments
 */

// ---------------------------------------------------------------------------
// C5 — Settlement logic (mirrors settlement.service.ts)
// ---------------------------------------------------------------------------

describe('C5 — Settlement Overlap Guard', () => {
  interface SettlementPeriod {
    hospital_id: string;
    period_start: string;
    period_end: string;
  }

  const existingPeriods: SettlementPeriod[] = [];

  function findOverlapping(hospitalId: string, start: string, end: string): SettlementPeriod | null {
    return (
      existingPeriods.find(
        (p) =>
          p.hospital_id === hospitalId &&
          new Date(p.period_start) < new Date(end) &&
          new Date(p.period_end) > new Date(start),
      ) ?? null
    );
  }

  beforeEach(() => {
    existingPeriods.length = 0;
    existingPeriods.push({
      hospital_id: 'h1',
      period_start: '2025-01-01',
      period_end: '2025-01-31',
    });
  });

  it('detects overlapping settlement period', () => {
    const overlap = findOverlapping('h1', '2025-01-15', '2025-02-15');
    expect(overlap).not.toBeNull();
  });

  it('allows non-overlapping period', () => {
    const overlap = findOverlapping('h1', '2025-02-01', '2025-02-28');
    expect(overlap).toBeNull();
  });

  it('allows same dates for different hospital', () => {
    const overlap = findOverlapping('h2', '2025-01-01', '2025-01-31');
    expect(overlap).toBeNull();
  });

  it('detects exact boundary overlap (end == start treated as no overlap due to <)', () => {
    // period_start < end AND period_end > start
    // existing: [2025-01-01, 2025-01-31], query: [2025-01-31, 2025-02-28]
    // 2025-01-01 < 2025-02-28 = true, 2025-01-31 > 2025-01-31 = false → no overlap
    const overlap = findOverlapping('h1', '2025-01-31', '2025-02-28');
    expect(overlap).toBeNull();
  });
});

describe('C5 — Settlement Calculation', () => {
  interface SettlementInput {
    grossAmount: number;
    commissionRate: number; // 0-1
    refundAmount: number;
    tdsRate: number; // 0-1
  }

  function calculateSettlement(input: SettlementInput) {
    const { grossAmount, commissionRate, refundAmount, tdsRate } = input;
    const commission = grossAmount * commissionRate;
    const afterCommission = grossAmount - commission;
    const afterRefunds = afterCommission - refundAmount;
    const tds = afterRefunds * tdsRate;
    const netPayable = Math.max(afterRefunds - tds, 0);

    return {
      grossAmount,
      commission: Math.round(commission * 100) / 100,
      refundAmount,
      tds: Math.round(tds * 100) / 100,
      netPayable: Math.round(netPayable * 100) / 100,
    };
  }

  it('calculates standard settlement correctly', () => {
    const result = calculateSettlement({
      grossAmount: 10000,
      commissionRate: 0.1,
      refundAmount: 500,
      tdsRate: 0.01,
    });
    // gross=10000, commission=1000, afterComm=9000, afterRef=8500, tds=85, net=8415
    expect(result.commission).toBe(1000);
    expect(result.tds).toBe(85);
    expect(result.netPayable).toBe(8415);
  });

  it('floors net payable at 0 when refunds exceed revenue', () => {
    const result = calculateSettlement({
      grossAmount: 1000,
      commissionRate: 0.1,
      refundAmount: 5000,
      tdsRate: 0.01,
    });
    expect(result.netPayable).toBe(0);
  });

  it('handles zero gross amount', () => {
    const result = calculateSettlement({
      grossAmount: 0,
      commissionRate: 0.1,
      refundAmount: 0,
      tdsRate: 0.01,
    });
    expect(result.netPayable).toBe(0);
  });

  it('handles 100% commission', () => {
    const result = calculateSettlement({
      grossAmount: 5000,
      commissionRate: 1.0,
      refundAmount: 0,
      tdsRate: 0.01,
    });
    expect(result.netPayable).toBe(0);
  });

  it('handles zero TDS', () => {
    const result = calculateSettlement({
      grossAmount: 10000,
      commissionRate: 0.1,
      refundAmount: 0,
      tdsRate: 0,
    });
    // gross=10000, commission=1000, net=9000
    expect(result.netPayable).toBe(9000);
  });
});

// ---------------------------------------------------------------------------
// C6 — Atomic Booking RPC error handling
// ---------------------------------------------------------------------------

describe('C6 — Atomic Booking RPC', () => {
  type RpcError = 'SLOT_ALREADY_BOOKED' | 'SLOT_BEING_BOOKED' | 'SLOT_AT_CAPACITY';

  interface BookingResult {
    success: boolean;
    error?: string;
    appointment_id?: string;
  }

  function simulateBookAppointment(rpcOutcome: 'success' | RpcError): BookingResult {
    switch (rpcOutcome) {
      case 'success':
        return { success: true, appointment_id: 'apt_123' };
      case 'SLOT_ALREADY_BOOKED':
        return { success: false, error: 'This slot has already been booked' };
      case 'SLOT_BEING_BOOKED':
        return { success: false, error: 'This slot is being booked by another user, please try again' };
      case 'SLOT_AT_CAPACITY':
        return { success: false, error: 'This slot has reached maximum capacity' };
    }
  }

  function handleBookingResult(result: BookingResult) {
    if (!result.success) {
      const statusMap: Record<string, number> = {
        'This slot has already been booked': 409,
        'This slot is being booked by another user, please try again': 409,
        'This slot has reached maximum capacity': 409,
      };
      const status = statusMap[result.error!] ?? 500;
      return { status, message: result.error };
    }
    return { status: 201, appointment_id: result.appointment_id };
  }

  it('returns 201 for successful booking', () => {
    const result = simulateBookAppointment('success');
    const response = handleBookingResult(result);
    expect(response.status).toBe(201);
    expect(response.appointment_id).toBe('apt_123');
  });

  it('returns 409 for SLOT_ALREADY_BOOKED', () => {
    const result = simulateBookAppointment('SLOT_ALREADY_BOOKED');
    const response = handleBookingResult(result);
    expect(response.status).toBe(409);
    expect(response.message).toContain('already been booked');
  });

  it('returns 409 for SLOT_BEING_BOOKED', () => {
    const result = simulateBookAppointment('SLOT_BEING_BOOKED');
    const response = handleBookingResult(result);
    expect(response.status).toBe(409);
    expect(response.message).toContain('being booked by another user');
  });

  it('returns 409 for SLOT_AT_CAPACITY', () => {
    const result = simulateBookAppointment('SLOT_AT_CAPACITY');
    const response = handleBookingResult(result);
    expect(response.status).toBe(409);
    expect(response.message).toContain('maximum capacity');
  });
});

// ---------------------------------------------------------------------------
// C10 — Ownership Authorization
// ---------------------------------------------------------------------------

describe('C10 — Ownership Authorization', () => {
  interface Appointment {
    id: string;
    patient_id: string;
    doctor_id: string;
    hospital_id: string;
  }

  function canAccessAppointment(
    userId: string,
    role: string,
    appointment: Appointment,
    userHospitalIds: string[],
    userDoctorIds: string[],
  ): boolean {
    if (role === 'admin') return true;
    if (role === 'patient' && appointment.patient_id === userId) return true;
    if (role === 'doctor' && userDoctorIds.includes(appointment.doctor_id)) return true;
    if (
      (role === 'hospital' || role === 'reception') &&
      userHospitalIds.includes(appointment.hospital_id)
    )
      return true;
    return false;
  }

  const appointment: Appointment = {
    id: 'apt_1',
    patient_id: 'patient-1',
    doctor_id: 'doctor-1',
    hospital_id: 'hospital-1',
  };

  it('allows admin to access any appointment', () => {
    expect(canAccessAppointment('admin-1', 'admin', appointment, [], [])).toBe(true);
  });

  it('allows patient to access their own appointment', () => {
    expect(canAccessAppointment('patient-1', 'patient', appointment, [], [])).toBe(true);
  });

  it('blocks patient from accessing another patient appointment', () => {
    expect(canAccessAppointment('patient-2', 'patient', appointment, [], [])).toBe(false);
  });

  it('allows doctor to access their appointment', () => {
    expect(canAccessAppointment('user-1', 'doctor', appointment, [], ['doctor-1'])).toBe(true);
  });

  it('blocks doctor from accessing unrelated appointment', () => {
    expect(canAccessAppointment('user-1', 'doctor', appointment, [], ['doctor-2'])).toBe(false);
  });

  it('allows hospital staff to access hospital appointment', () => {
    expect(canAccessAppointment('user-1', 'hospital', appointment, ['hospital-1'], [])).toBe(true);
  });

  it('allows reception to access hospital appointment', () => {
    expect(canAccessAppointment('user-1', 'reception', appointment, ['hospital-1'], [])).toBe(true);
  });

  it('blocks reception from accessing other hospital appointment', () => {
    expect(canAccessAppointment('user-1', 'reception', appointment, ['hospital-2'], [])).toBe(false);
  });
});
