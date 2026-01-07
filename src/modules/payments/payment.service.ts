import crypto from 'crypto';
import { getSupabaseAdmin } from '../../config/db.js';
import { env } from '../../config/env.js';
import { logger } from '../../common/logger.js';
import { NotFoundError, ForbiddenError, BadRequestError } from '../../common/errors.js';
import { PLATFORM_FEES, GST_RATE } from '../../config/constants.js';
import type { PaymentStatus } from '../../types/database.types.js';
import type {
  Payment,
  PaymentWithDetails,
  PaymentListItem,
  PaymentFilters,
  PaymentStats,
  RevenueBreakdown,
  Refund,
  RefundFilters,
  Settlement,
  SettlementWithDetails,
  SettlementFilters,
  UserCredits,
  CreditTransaction,
  AddCreditsInput,
  CreateOrderInput,
  CreateOrderResponse,
  VerifyPaymentInput,
  ProcessRefundInput,
  RazorpayOrder,
  RazorpayPayment,
  RazorpayRefund,
  RazorpayWebhookEvent,
} from './payment.types.js';

/**
 * Payment Service - Production-ready payment management with Razorpay
 * Features: Order creation, payment verification, refunds, settlements, credits
 */
class PaymentService {
  private log = logger.child('PaymentService');
  private supabase = getSupabaseAdmin();
  private razorpayBaseUrl = 'https://api.razorpay.com/v1';

  // ============================================================================
  // Order & Payment Operations
  // ============================================================================

  /**
   * Create Razorpay order for appointment
   */
  async createOrder(patientId: string, input: CreateOrderInput): Promise<CreateOrderResponse> {
    const { appointment_id } = input;

    // Get appointment details
    const { data: appointment, error: aptError } = await this.supabase
      .from('appointments')
      .select(`
        id, booking_id, patient_id, doctor_id, hospital_id,
        total_amount, consultation_fee, platform_fee, status,
        patient:users!appointments_patient_id_fkey(full_name, email, phone)
      `)
      .eq('id', appointment_id)
      .single();

    if (aptError || !appointment) {
      throw new NotFoundError('Appointment');
    }

    if (appointment.patient_id !== patientId) {
      throw new ForbiddenError('You can only pay for your own appointments');
    }

    if (appointment.status !== 'pending_payment') {
      throw new BadRequestError('Payment already completed or appointment cancelled');
    }

    // Check for existing pending payment
    const { data: existingPayment } = await this.supabase
      .from('payments')
      .select('id, razorpay_order_id')
      .eq('appointment_id', appointment_id)
      .eq('status', 'pending')
      .single();

    if (existingPayment?.razorpay_order_id) {
      return {
        order_id: existingPayment.razorpay_order_id,
        amount: Number(appointment.total_amount) * 100,
        currency: 'INR',
        receipt: `RZX-${appointment.booking_id}`,
        key_id: env.RAZORPAY_KEY_ID,
        notes: {
          appointment_id: appointment.id,
          patient_id: appointment.patient_id,
          hospital_id: appointment.hospital_id,
        },
        prefill: {
          name: appointment.patient?.full_name || undefined,
          email: appointment.patient?.email || undefined,
          contact: appointment.patient?.phone || undefined,
        },
      };
    }

    // Create Razorpay order
    const amountInPaise = Math.round(Number(appointment.total_amount) * 100);
    const receipt = `RZX-${appointment.booking_id}`;

    const razorpayOrder = await this.createRazorpayOrder({
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      notes: {
        appointment_id: appointment.id,
        patient_id: appointment.patient_id,
        hospital_id: appointment.hospital_id,
        booking_id: appointment.booking_id,
      },
    });

    // Calculate fee distribution
    const totalAmount = Number(appointment.total_amount);
    const platformFee = Number(appointment.platform_fee);
    const consultationFee = Number(appointment.consultation_fee);
    const gstAmount = Math.round(platformFee * (GST_RATE / 100));
    const doctorAmount = consultationFee - platformFee;

    // Create payment record
    const { error: paymentError } = await this.supabase.from('payments').insert({
      appointment_id: appointment.id,
      patient_id: patientId,
      doctor_id: appointment.doctor_id,
      hospital_id: appointment.hospital_id,
      payment_type: 'appointment',
      amount: totalAmount,
      platform_fee: platformFee,
      doctor_amount: doctorAmount,
      hospital_amount: 0, // Or split based on hospital agreement
      gst_amount: gstAmount,
      currency: 'INR',
      status: 'pending',
      razorpay_order_id: razorpayOrder.id,
    });

    if (paymentError) {
      this.log.error('Failed to create payment record', paymentError);
      throw new BadRequestError('Failed to create payment');
    }

    this.log.info(`Payment order created: ${receipt}`, {
      appointmentId: appointment.id,
      orderId: razorpayOrder.id,
      amount: totalAmount,
    });

    return {
      order_id: razorpayOrder.id,
      amount: amountInPaise,
      currency: 'INR',
      receipt,
      key_id: env.RAZORPAY_KEY_ID,
      notes: {
        appointment_id: appointment.id,
        patient_id: patientId,
        hospital_id: appointment.hospital_id,
      },
      prefill: {
        name: appointment.patient?.full_name || undefined,
        email: appointment.patient?.email || undefined,
        contact: appointment.patient?.phone || undefined,
      },
    };
  }

  /**
   * Verify payment after Razorpay checkout
   */
  async verifyPayment(patientId: string, input: VerifyPaymentInput): Promise<PaymentWithDetails> {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = input;

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      this.log.warn('Invalid payment signature', { razorpay_order_id });
      throw new BadRequestError('Invalid payment signature');
    }

    // Get payment record
    const { data: payment, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('razorpay_order_id', razorpay_order_id)
      .single();

    if (error || !payment) {
      throw new NotFoundError('Payment');
    }

    if (payment.patient_id !== patientId) {
      throw new ForbiddenError('Payment verification failed');
    }

    // Fetch payment details from Razorpay
    const razorpayPayment = await this.fetchRazorpayPayment(razorpay_payment_id);

    // Update payment
    const { error: updateError } = await this.supabase
      .from('payments')
      .update({
        status: 'completed',
        razorpay_payment_id,
        razorpay_signature,
        payment_method: this.mapPaymentMethod(razorpayPayment.method),
        paid_at: new Date().toISOString(),
        metadata: {
          razorpay: {
            method: razorpayPayment.method,
            bank: razorpayPayment.bank,
            wallet: razorpayPayment.wallet,
            vpa: razorpayPayment.vpa,
            fee: razorpayPayment.fee,
            tax: razorpayPayment.tax,
          },
        },
      })
      .eq('id', payment.id);

    if (updateError) {
      throw new BadRequestError('Failed to update payment');
    }

    // Update appointment status to confirmed
    if (payment.appointment_id) {
      await this.supabase
        .from('appointments')
        .update({
          status: 'confirmed',
          payment_status: 'completed',
          payment_id: payment.id,
          paid_at: new Date().toISOString(),
        })
        .eq('id', payment.appointment_id);
    }

    this.log.info(`Payment verified: ${razorpay_payment_id}`, {
      paymentId: payment.id,
      appointmentId: payment.appointment_id,
    });

    return this.getById(payment.id);
  }

  /**
   * Handle Razorpay webhook
   */
  async handleWebhook(event: RazorpayWebhookEvent, signature: string): Promise<void> {
    // Verify webhook signature
    const body = JSON.stringify(event);
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== signature) {
      throw new BadRequestError('Invalid webhook signature');
    }

    this.log.info(`Webhook received: ${event.event}`);

    switch (event.event) {
      case 'payment.captured':
        await this.handlePaymentCaptured(event.payload.payment?.entity);
        break;
      case 'payment.failed':
        await this.handlePaymentFailed(event.payload.payment?.entity);
        break;
      case 'refund.processed':
        await this.handleRefundProcessed(event.payload.refund?.entity);
        break;
      default:
        this.log.debug(`Unhandled webhook event: ${event.event}`);
    }
  }

  // ============================================================================
  // Read Operations
  // ============================================================================

  /**
   * Get payment by ID
   */
  async getById(paymentId: string): Promise<PaymentWithDetails> {
    const { data, error } = await this.supabase
      .from('payments')
      .select(`
        *,
        appointment:appointments(id, booking_id, appointment_date, start_time, consultation_type),
        patient:users!payments_patient_id_fkey(id, full_name, phone, email),
        doctor:doctors(id, users(full_name)),
        hospital:hospitals(id, name),
        refund:refunds(*)
      `)
      .eq('id', paymentId)
      .single();

    if (error || !data) {
      throw new NotFoundError('Payment');
    }

    return this.transformPayment(data);
  }

  /**
   * List payments with filters
   */
  async list(filters: PaymentFilters): Promise<{
    payments: PaymentListItem[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      patient_id,
      doctor_id,
      hospital_id,
      status,
      payment_type,
      date_from,
      date_to,
      page = 1,
      limit = 20,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = filters;

    let query = this.supabase
      .from('payments')
      .select(`
        id, appointment_id, payment_type, amount, status, payment_method, paid_at, created_at,
        patient:users!payments_patient_id_fkey(full_name),
        doctor:doctors(users(full_name)),
        hospital:hospitals(name)
      `, { count: 'exact' });

    if (patient_id) query = query.eq('patient_id', patient_id);
    if (doctor_id) query = query.eq('doctor_id', doctor_id);
    if (hospital_id) query = query.eq('hospital_id', hospital_id);
    if (payment_type) query = query.eq('payment_type', payment_type);
    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to);

    if (status) {
      if (Array.isArray(status)) {
        query = query.in('status', status);
      } else {
        query = query.eq('status', status);
      }
    }

    query = query.order(sort_by, { ascending: sort_order === 'asc' });

    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw new BadRequestError('Failed to fetch payments');
    }

    const payments: PaymentListItem[] = (data || []).map((p: any) => ({
      id: p.id,
      appointment_id: p.appointment_id,
      payment_type: p.payment_type,
      amount: p.amount,
      status: p.status,
      payment_method: p.payment_method,
      patient_name: p.patient?.full_name || null,
      doctor_name: p.doctor?.users?.full_name || null,
      hospital_name: p.hospital?.name || null,
      paid_at: p.paid_at,
      created_at: p.created_at,
    }));

    return {
      payments,
      total: count || 0,
      page,
      limit,
    };
  }

  // ============================================================================
  // Refund Operations
  // ============================================================================

  /**
   * Process refund
   */
  async processRefund(
    userId: string,
    role: 'patient' | 'doctor' | 'hospital' | 'admin',
    input: ProcessRefundInput
  ): Promise<Refund> {
    const { payment_id, amount, reason, speed = 'normal' } = input;

    const payment = await this.getById(payment_id);

    // Validate refund eligibility
    if (payment.status !== 'completed') {
      throw new BadRequestError('Only completed payments can be refunded');
    }

    // Check existing refund
    const { data: existingRefund } = await this.supabase
      .from('refunds')
      .select('id')
      .eq('payment_id', payment_id)
      .in('status', ['pending', 'processing', 'completed'])
      .single();

    if (existingRefund) {
      throw new BadRequestError('Refund already processed for this payment');
    }

    // Calculate refund amount and policy
    const { refundAmount, policy } = this.calculateRefundPolicy(payment, amount);

    if (refundAmount <= 0) {
      throw new BadRequestError('Refund amount must be greater than 0');
    }

    // Create Razorpay refund
    const razorpayRefund = await this.createRazorpayRefund(
      payment.razorpay_payment_id!,
      refundAmount * 100, // Convert to paise
      speed
    );

    // Create refund record
    const { data: refund, error } = await this.supabase
      .from('refunds')
      .insert({
        payment_id,
        appointment_id: payment.appointment_id,
        amount: refundAmount,
        reason,
        status: 'processing',
        refund_policy: policy,
        initiated_by: userId,
        razorpay_refund_id: razorpayRefund.id,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestError('Failed to create refund');
    }

    // Update payment status
    await this.supabase
      .from('payments')
      .update({ status: 'refund_processing' })
      .eq('id', payment_id);

    this.log.info(`Refund initiated: ${razorpayRefund.id}`, {
      paymentId: payment_id,
      amount: refundAmount,
      policy,
    });

    return refund;
  }

  /**
   * List refunds
   */
  async listRefunds(filters: RefundFilters): Promise<{
    refunds: Refund[];
    total: number;
  }> {
    const { payment_id, status, date_from, date_to, page = 1, limit = 20 } = filters;

    let query = this.supabase.from('refunds').select('*', { count: 'exact' });

    if (payment_id) query = query.eq('payment_id', payment_id);
    if (status) query = query.eq('status', status);
    if (date_from) query = query.gte('created_at', date_from);
    if (date_to) query = query.lte('created_at', date_to);

    query = query.order('created_at', { ascending: false });

    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw new BadRequestError('Failed to fetch refunds');
    }

    return {
      refunds: data || [],
      total: count || 0,
    };
  }

  // ============================================================================
  // Settlement Operations
  // ============================================================================

  /**
   * Generate settlement for a period
   */
  async generateSettlement(
    hospitalId: string | null,
    doctorId: string | null,
    periodStart: string,
    periodEnd: string
  ): Promise<Settlement> {
    // Get all completed payments in the period
    let query = this.supabase
      .from('payments')
      .select('id, amount, platform_fee, doctor_amount, hospital_amount')
      .eq('status', 'completed')
      .gte('paid_at', periodStart)
      .lte('paid_at', periodEnd);

    if (hospitalId) query = query.eq('hospital_id', hospitalId);
    if (doctorId) query = query.eq('doctor_id', doctorId);

    const { data: payments, error } = await query;

    if (error) {
      throw new BadRequestError('Failed to fetch payments for settlement');
    }

    if (!payments || payments.length === 0) {
      throw new BadRequestError('No payments found for the specified period');
    }

    // Calculate totals
    const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const platformFee = payments.reduce((sum, p) => sum + Number(p.platform_fee), 0);
    const netAmount = payments.reduce(
      (sum, p) => sum + Number(p.doctor_amount) + Number(p.hospital_amount),
      0
    );

    // Create settlement
    const { data: settlement, error: settleError } = await this.supabase
      .from('settlements')
      .insert({
        hospital_id: hospitalId,
        doctor_id: doctorId,
        period_start: periodStart,
        period_end: periodEnd,
        total_amount: totalAmount,
        platform_fee: platformFee,
        net_amount: netAmount,
        transaction_count: payments.length,
        status: 'pending',
      })
      .select()
      .single();

    if (settleError) {
      throw new BadRequestError('Failed to create settlement');
    }

    this.log.info('Settlement generated', {
      settlementId: settlement.id,
      totalAmount,
      netAmount,
      transactions: payments.length,
    });

    return settlement;
  }

  /**
   * Mark settlement as processed
   */
  async processSettlement(
    settlementId: string,
    bankReference: string
  ): Promise<Settlement> {
    const { data, error } = await this.supabase
      .from('settlements')
      .update({
        status: 'processed',
        bank_reference: bankReference,
        settled_at: new Date().toISOString(),
      })
      .eq('id', settlementId)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !data) {
      throw new BadRequestError('Failed to process settlement');
    }

    return data;
  }

  /**
   * List settlements
   */
  async listSettlements(filters: SettlementFilters): Promise<{
    settlements: SettlementWithDetails[];
    total: number;
  }> {
    const { hospital_id, doctor_id, status, period_from, period_to, page = 1, limit = 20 } = filters;

    let query = this.supabase
      .from('settlements')
      .select(`
        *,
        hospital:hospitals(id, name),
        doctor:doctors(id, users(full_name))
      `, { count: 'exact' });

    if (hospital_id) query = query.eq('hospital_id', hospital_id);
    if (doctor_id) query = query.eq('doctor_id', doctor_id);
    if (status) query = query.eq('status', status);
    if (period_from) query = query.gte('period_start', period_from);
    if (period_to) query = query.lte('period_end', period_to);

    query = query.order('created_at', { ascending: false });

    const from = (page - 1) * limit;
    query = query.range(from, from + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      throw new BadRequestError('Failed to fetch settlements');
    }

    return {
      settlements: data || [],
      total: count || 0,
    };
  }

  // ============================================================================
  // Credits Operations
  // ============================================================================

  /**
   * Get user credits balance
   */
  async getCredits(userId: string): Promise<UserCredits> {
    const { data, error } = await this.supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new BadRequestError('Failed to fetch credits');
    }

    if (!data) {
      // Create credits record if doesn't exist
      const { data: newCredits, error: createError } = await this.supabase
        .from('user_credits')
        .insert({
          user_id: userId,
          balance: 0,
          lifetime_earned: 0,
          lifetime_used: 0,
        })
        .select()
        .single();

      if (createError) {
        throw new BadRequestError('Failed to create credits');
      }

      return newCredits;
    }

    return data;
  }

  /**
   * Add credits to user
   */
  async addCredits(input: AddCreditsInput): Promise<CreditTransaction> {
    const { user_id, amount, source, description, expires_at } = input;

    // Create transaction
    const { data: transaction, error: txError } = await this.supabase
      .from('credit_transactions')
      .insert({
        user_id,
        amount,
        type: 'earned',
        source,
        description,
        expires_at,
      })
      .select()
      .single();

    if (txError) {
      throw new BadRequestError('Failed to create credit transaction');
    }

    // Update balance
    await this.supabase.rpc('add_user_credits', {
      p_user_id: user_id,
      p_amount: amount,
    });

    this.log.info('Credits added', { userId: user_id, amount, source });

    return transaction;
  }

  /**
   * Use credits for payment
   */
  async useCredits(
    userId: string,
    amount: number,
    referenceId: string
  ): Promise<CreditTransaction> {
    const credits = await this.getCredits(userId);

    if (credits.balance < amount) {
      throw new BadRequestError('Insufficient credits');
    }

    // Create transaction
    const { data: transaction, error: txError } = await this.supabase
      .from('credit_transactions')
      .insert({
        user_id: userId,
        amount: -amount,
        type: 'used',
        source: 'payment',
        reference_id: referenceId,
        description: `Used for payment ${referenceId}`,
      })
      .select()
      .single();

    if (txError) {
      throw new BadRequestError('Failed to use credits');
    }

    // Update balance
    await this.supabase.rpc('deduct_user_credits', {
      p_user_id: userId,
      p_amount: amount,
    });

    return transaction;
  }

  /**
   * Get credit transactions
   */
  async getCreditTransactions(
    userId: string,
    limit = 20
  ): Promise<CreditTransaction[]> {
    const { data, error } = await this.supabase
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new BadRequestError('Failed to fetch transactions');
    }

    return data || [];
  }

  // ============================================================================
  // Stats Operations
  // ============================================================================

  /**
   * Get payment stats
   */
  async getStats(
    hospitalId?: string,
    doctorId?: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<PaymentStats> {
    let query = this.supabase
      .from('payments')
      .select('amount, platform_fee, doctor_amount, hospital_amount, status');

    if (hospitalId) query = query.eq('hospital_id', hospitalId);
    if (doctorId) query = query.eq('doctor_id', doctorId);
    if (dateFrom) query = query.gte('created_at', dateFrom);
    if (dateTo) query = query.lte('created_at', dateTo);

    const { data: payments } = await query;

    const completed = (payments || []).filter((p: any) => p.status === 'completed');
    const refunded = (payments || []).filter((p: any) => p.status === 'refunded');

    // Get pending settlements
    const { count: pendingSettlements } = await this.supabase
      .from('settlements')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');

    return {
      total_revenue: completed.reduce((sum: number, p: any) => sum + Number(p.amount), 0),
      platform_fees: completed.reduce((sum: number, p: any) => sum + Number(p.platform_fee), 0),
      doctor_payouts: completed.reduce((sum: number, p: any) => sum + Number(p.doctor_amount), 0),
      hospital_payouts: completed.reduce((sum: number, p: any) => sum + Number(p.hospital_amount), 0),
      total_refunds: refunded.reduce((sum: number, p: any) => sum + Number(p.amount), 0),
      transaction_count: completed.length,
      pending_settlements: pendingSettlements || 0,
    };
  }

  /**
   * Get revenue breakdown by period
   */
  async getRevenueBreakdown(
    period: 'day' | 'week' | 'month',
    hospitalId?: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<RevenueBreakdown[]> {
    // This would typically use a database function or aggregation
    // Simplified implementation
    const stats = await this.getStats(hospitalId, undefined, dateFrom, dateTo);

    return [
      {
        period: dateFrom || new Date().toISOString().split('T')[0],
        revenue: stats.total_revenue,
        platform_fee: stats.platform_fees,
        refunds: stats.total_refunds,
        net_revenue: stats.total_revenue - stats.total_refunds,
        transaction_count: stats.transaction_count,
      },
    ];
  }

  // ============================================================================
  // Razorpay API Helpers
  // ============================================================================

  /**
   * Create Razorpay order
   */
  private async createRazorpayOrder(data: {
    amount: number;
    currency: string;
    receipt: string;
    notes: Record<string, any>;
  }): Promise<RazorpayOrder> {
    const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');

    const response = await fetch(`${this.razorpayBaseUrl}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      this.log.error('Razorpay order creation failed', error);
      throw new BadRequestError('Failed to create payment order');
    }

    return response.json();
  }

  /**
   * Fetch Razorpay payment details
   */
  private async fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
    const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');

    const response = await fetch(`${this.razorpayBaseUrl}/payments/${paymentId}`, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      throw new BadRequestError('Failed to fetch payment details');
    }

    return response.json();
  }

  /**
   * Create Razorpay refund
   */
  private async createRazorpayRefund(
    paymentId: string,
    amount: number,
    speed: 'normal' | 'optimum'
  ): Promise<RazorpayRefund> {
    const auth = Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString('base64');

    const response = await fetch(`${this.razorpayBaseUrl}/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount,
        speed,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      this.log.error('Razorpay refund failed', error);
      throw new BadRequestError('Failed to process refund');
    }

    return response.json();
  }

  // ============================================================================
  // Webhook Handlers
  // ============================================================================

  private async handlePaymentCaptured(payment?: RazorpayPayment): Promise<void> {
    if (!payment) return;

    const { data } = await this.supabase
      .from('payments')
      .select('id, status')
      .eq('razorpay_payment_id', payment.id)
      .single();

    if (data && data.status === 'pending') {
      await this.supabase
        .from('payments')
        .update({
          status: 'completed',
          paid_at: new Date().toISOString(),
        })
        .eq('id', data.id);
    }
  }

  private async handlePaymentFailed(payment?: RazorpayPayment): Promise<void> {
    if (!payment) return;

    await this.supabase
      .from('payments')
      .update({
        status: 'failed',
        metadata: {
          error_code: payment.error_code,
          error_description: payment.error_description,
        },
      })
      .eq('razorpay_order_id', payment.order_id);
  }

  private async handleRefundProcessed(refund?: RazorpayRefund): Promise<void> {
    if (!refund) return;

    const status = refund.status === 'processed' ? 'completed' : 'failed';

    await this.supabase
      .from('refunds')
      .update({
        status,
        processed_at: new Date().toISOString(),
      })
      .eq('razorpay_refund_id', refund.id);

    if (status === 'completed') {
      // Update payment status
      await this.supabase
        .from('payments')
        .update({ status: 'refunded' })
        .eq('razorpay_payment_id', refund.payment_id);
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private transformPayment(data: any): PaymentWithDetails {
    return {
      ...data,
      appointment: data.appointment || null,
      patient: data.patient || undefined,
      doctor: data.doctor
        ? {
            id: data.doctor.id,
            full_name: data.doctor.users?.full_name || null,
          }
        : null,
      hospital: data.hospital || null,
      refund: data.refund?.[0] || null,
    };
  }

  private mapPaymentMethod(method: string): string {
    const methodMap: Record<string, string> = {
      card: 'card',
      upi: 'upi',
      netbanking: 'netbanking',
      wallet: 'wallet',
      emi: 'emi',
      bank_transfer: 'bank_transfer',
    };
    return methodMap[method] || 'other';
  }

  private calculateRefundPolicy(
    payment: PaymentWithDetails,
    requestedAmount?: number
  ): { refundAmount: number; policy: 'full' | 'partial_75' | 'partial_50' | 'none' } {
    // If appointment, check timing
    if (payment.appointment) {
      const appointmentDate = new Date(
        `${payment.appointment.appointment_date}T${payment.appointment.start_time}`
      );
      const now = new Date();
      const hoursUntil = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntil >= 24) {
        return { refundAmount: payment.amount, policy: 'full' };
      } else if (hoursUntil >= 4) {
        return { refundAmount: Math.round(payment.amount * 0.75), policy: 'partial_75' };
      } else if (hoursUntil >= 1) {
        return { refundAmount: Math.round(payment.amount * 0.50), policy: 'partial_50' };
      }
      return { refundAmount: 0, policy: 'none' };
    }

    // Default: full refund if no policy applies
    return {
      refundAmount: requestedAmount || payment.amount,
      policy: requestedAmount && requestedAmount < payment.amount ? 'partial_75' : 'full',
    };
  }
}

export const paymentService = new PaymentService();
