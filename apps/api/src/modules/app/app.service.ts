import { Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import { OtpService } from '../auth/otp.service.js';
import { TokenService, type TokenPair } from '../auth/token.service.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { PaymentsService } from '../payments/payments.service.js';
import { AttendanceQrService } from '../attendance/attendance-qr.service.js';
import { ShopService } from '../shop/shop.service.js';
import type { AppCheckInDto } from '../attendance/dto/attendance-qr.schemas.js';
import type { CreateAbsenceRequestDto } from '../attendance/dto/attendance-extra.schemas.js';
import type {
  AppAvailabilityDto,
  AppBookDto,
  AppBusinessDirectoryDto,
  AppCancelDto,
  AppGlobalOtpRequestDto,
  AppGlobalOtpVerifyDto,
  AppOtpRequestDto,
  AppOtpVerifyDto,
  AppPayDto,
  AppReviewDto,
  AppSwitchClubDto,
} from './dto/app.schemas.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const END_USER_PERMISSIONS = ['app:read', 'app:write'];
/** Last-resort name for a portal member nobody has named yet. */
const PORTAL_NAME_PLACEHOLDER = 'کاربر';

/**
 * End-user (customer) portal — PRD §4.14 (APP-01..07). Reuses the CORE auth
 * primitives but scopes every query to the customer row linked to the logged-in
 * member, so a portal user can never see another customer's data.
 */
@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
    private readonly payments: PaymentsService,
    private readonly messaging: MessagingService,
    private readonly attendanceQr: AttendanceQrService,
    private readonly shop: ShopService,
  ) {}

  // ----- APP-01 login -----

  async requestOtp(dto: AppOtpRequestDto) {
    await this.otp.request(dto.phone, 'LOGIN');
    return { message: 'کد یکبار مصرف ارسال شد' };
  }

  /**
   * Global student portal login: mobile is the cross-club identity. The issued
   * token is scoped to the *first* club by default (so panel features like
   * check-in work for one tenant at a time), while a picker lets the student
   * switch between every club they belong to.
   */
  async requestGlobalOtp(dto: AppGlobalOtpRequestDto) {
    await this.otp.request(dto.phone, 'LOGIN');
    return { message: 'کد یکبار مصرف ارسال شد' };
  }

  /**
   * Public directory of businesses a new end-user can register with. Only
   * `ACTIVE` businesses are listed: when the platform admin suspends or
   * archives a business, its title disappears from the new-user signup flow
   * (and `verifyOtp` below refuses a direct slug hit too).
   */
  async listBusinesses(filter: AppBusinessDirectoryDto) {
    return this.prisma.client.tenant.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        ...(filter.industry ? { industry: filter.industry } : {}),
        ...(filter.search
          ? {
              OR: [
                { name: { contains: filter.search, mode: 'insensitive' as const } },
                { slug: { contains: filter.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: { name: 'asc' },
      take: 100,
      select: { id: true, name: true, slug: true, industry: true, logoUrl: true },
    });
  }

  async verifyGlobalOtp(dto: AppGlobalOtpVerifyDto, context: { userAgent?: string; ip?: string }) {
    await this.otp.verify(dto.phone, dto.code, 'LOGIN');

    const clubs = await this.membershipsForPhone(dto.phone);
    if (clubs.length === 0) {
      // 404 with a *complete* sentence (the `notFound()` helper appends
      // «یافت نشد», which read badly here) and the three ways to join.
      throw DomainException.notFoundMessage(
        'این شماره هنوز در هیچ کسب‌وکاری عضو نیست. برای شروع: ۱) لینک یا QR دعوت همان کسب‌وکار را باز کنید، ۲) از فهرست کسب‌وکارهای فعال یکی را انتخاب کنید تا حساب شما همان لحظه ساخته شود، یا ۳) از مدیر مجموعه بخواهید شمارهٔ شما را در فهرست کاربران ثبت کند.',
        'NO_MEMBERSHIP',
      );
    }

    const primary = clubs.find((club) => club.primaryLinked) ?? clubs[0];
    const { member, customer } = await this.resolveOrCreatePortalUser(
      primary.tenantId,
      dto.phone,
      dto.fullName,
    );

    const tokens = await this.tokens.issue(
      {
        memberId: member.id,
        tenantId: primary.tenantId,
        branchId: member.branchId,
        systemRole: 'END_USER',
        permissions: END_USER_PERMISSIONS,
        fullName: member.fullName,
        phone: member.phone,
      },
      context,
    );

    return {
      tokens,
      clubs,
      user: {
        memberId: member.id,
        customerId: customer.id,
        fullName: member.fullName,
        phone: member.phone,
        tenantId: primary.tenantId,
        tenantName: primary.tenantName,
        tenantSlug: primary.tenantSlug,
      },
    };
  }

  /** Verifies OTP; auto-provisions a portal member + customer on first login. */
  async verifyOtp(dto: AppOtpVerifyDto, context: { userAgent?: string; ip?: string }) {
    await this.otp.verify(dto.phone, dto.code, 'LOGIN');

    const tenant = await this.prisma.client.tenant.findFirst({
      where: { slug: dto.tenantSlug, status: 'ACTIVE' },
      select: { id: true, name: true, slug: true },
    });
    if (!tenant) throw DomainException.notFound('کسب‌وکار');

    const { member, customer } = await this.resolveOrCreatePortalUser(
      tenant.id,
      dto.phone,
      dto.fullName,
    );

    const accessToken = await this.tokens.issue(
      {
        memberId: member.id,
        tenantId: tenant.id,
        branchId: member.branchId,
        systemRole: 'END_USER',
        permissions: END_USER_PERMISSIONS,
        fullName: member.fullName,
        phone: member.phone,
      },
      context,
    );

    return {
      tokens: accessToken,
      user: {
        memberId: member.id,
        customerId: customer.id,
        fullName: member.fullName,
        phone: member.phone,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        tenantId: tenant.id,
      },
    };
  }

  /**
   * Switches the active club of a signed-in end-user. A mobile number can be a
   * member of several businesses (a language school *and* a gym, say), but a
   * token is scoped to exactly one tenant at a time — this re-issues it for
   * another club the same phone already belongs to, without a new OTP.
   */
  async switchClub(memberId: string, dto: AppSwitchClubDto, context: { userAgent?: string; ip?: string }) {
    const current = await this.prisma.client.member.findFirst({
      where: { id: memberId, deletedAt: null },
      select: { phone: true },
    });
    if (!current?.phone) throw DomainException.notFound('شمارهٔ کاربری');

    const clubs = await this.membershipsForPhone(current.phone);
    const club = clubs.find((item) => item.tenantId === dto.tenantId);
    if (!club) {
      throw DomainException.forbidden(
        'این شماره در کسب‌وکار انتخابی عضو نیست؛ ابتدا با لینک دعوت همان کسب‌وکار عضو شوید',
        'NOT_A_MEMBER',
      );
    }

    const { member, customer } = await this.resolveOrCreatePortalUser(
      club.tenantId,
      current.phone,
      club.fullName,
    );
    const tokens = await this.tokens.issue(
      {
        memberId: member.id,
        tenantId: club.tenantId,
        branchId: member.branchId,
        systemRole: 'END_USER',
        permissions: END_USER_PERMISSIONS,
        fullName: member.fullName,
        phone: member.phone,
      },
      context,
    );
    this.logger.log(`Portal club switched member=${member.id} tenant=${club.tenantId}`);

    return {
      tokens,
      clubs,
      user: {
        memberId: member.id,
        customerId: customer.id,
        fullName: member.fullName,
        phone: member.phone,
        tenantId: club.tenantId,
        tenantName: club.tenantName,
        tenantSlug: club.tenantSlug,
      },
    };
  }

  private async resolveOrCreatePortalUser(
    tenantId: string,
    phone: string,
    fullName?: string,
  ): Promise<{
    member: { id: string; fullName: string; phone: string | null; branchId: string | null };
    customer: { id: string };
  }> {
    const existingMember = await this.prisma.client.member.findFirst({
      where: { tenantId, phone, deletedAt: null },
      include: { customer: true },
    });
    // A soft-deleted file (deletedAt set) is revived below instead of being
    // reused: the portal user is joining again and `memberId` is unique.
    if (existingMember?.customer && !existingMember.customer.deletedAt) {
      // The member was born from the invite-link flow, so it may still carry
      // the «کاربر» placeholder although the business already knows this
      // person's name — adopt the real name instead of greeting «کاربر».
      const displayName = this.portalDisplayName(
        fullName,
        existingMember.fullName,
        existingMember.customer.fullName,
      );
      if (displayName !== existingMember.fullName) {
        await this.prisma.client.member.update({
          where: { id: existingMember.id },
          data: { fullName: displayName },
        });
        return { member: { ...existingMember, fullName: displayName }, customer: existingMember.customer };
      }
      return { member: existingMember, customer: existingMember.customer };
    }

    // Staff usually record the person in «زبان‌آموزان/شاگردان» before the first
    // portal login, so a brand-new member inherits that name (the placeholder
    // «کاربر» is only the last resort).
    const file = await this.prisma.client.customer.findFirst({
      where: { tenantId, phone, deletedAt: null },
      select: { fullName: true },
    });
    const displayName = this.portalDisplayName(fullName, PORTAL_NAME_PLACEHOLDER, file?.fullName);

    return this.prisma.client.$transaction(async (tx) => {
      const role = await tx.role.upsert({
        where: { tenantId_key: { tenantId, key: 'end_user' } },
        update: {},
        create: {
          tenantId,
          key: 'end_user',
          name: 'کاربر نهایی',
          isSystem: true,
          permissions: END_USER_PERMISSIONS,
        },
      });

      const member =
        existingMember ??
        (await tx.member.create({
          data: {
            tenantId,
            roleId: role.id,
            systemRole: 'END_USER',
            fullName: displayName,
            phone,
            phoneVerified: true,
          },
        }));
      if (!existingMember) {
        await tx.member.update({
          where: { id: member.id },
          data: { roleId: role.id, phoneVerified: true },
        });
      }

      const linked = await tx.customer.findFirst({
        where: { tenantId, memberId: member.id },
        select: { id: true, fullName: true },
      });
      let customer: { id: string };
      if (linked) {
        // The archived file released its phone on delete; only reclaim it when
        // nobody else holds it now, otherwise stay phone-less instead of
        // tripping the `(tenantId, phone)` unique constraint.
        const phoneTaken = await tx.customer.findFirst({
          where: { tenantId, phone, deletedAt: null, id: { not: linked.id } },
          select: { id: true },
        });
        customer = await tx.customer.update({
          where: { id: linked.id },
          data: {
            memberId: member.id,
            deletedAt: null,
            isActive: true,
            fullName: fullName ?? linked.fullName,
            ...(phoneTaken ? {} : { phone }),
          },
        });
      } else {
        customer = await tx.customer.upsert({
          where: { tenantId_phone: { tenantId, phone } },
          update: { memberId: member.id, deletedAt: null, isActive: true },
          create: {
            tenantId,
            memberId: member.id,
            fullName: displayName,
            phone,
            source: 'portal',
          },
        });
      }
      return { member: { ...member, fullName: member.fullName }, customer: { id: customer.id } };
    });
  }

  private async customerFor(memberId: string) {
    const customer = await this.prisma.client.customer.findUnique({ where: { memberId } });
    if (!customer) throw DomainException.notFound('پرونده مشتری');
    return customer;
  }

  /**
   * The portal member is the *login* identity and the customer file is the
   * business-side record; whichever of them holds a real name wins over the
   * generic «کاربر» placeholder, so the panel never greets a known person as
   * «کاربر». The name typed at login wins first, then the staff-side file.
   */
  private portalDisplayName(
    fromLogin: string | undefined,
    memberName: string,
    customerName: string | null | undefined,
  ): string {
    const real = (value: string | null | undefined): string | undefined => {
      const trimmed = value?.trim();
      return trimmed && trimmed !== PORTAL_NAME_PLACEHOLDER ? trimmed : undefined;
    };
    return real(fromLogin) ?? real(customerName) ?? memberName;
  }

  /**
   * Every club (tenant) the phone belongs to, with the member/customer ids for
   * that specific club. This is what powers the student's multi-club dashboard:
   * "which clubs have I joined, and where".
   */
  async membershipsForPhone(phone: string) {
    const rows = await this.prisma.client.member.findMany({
      where: {
        phone,
        deletedAt: null,
        systemRole: 'END_USER',
        tenant: { status: 'ACTIVE' },
      },
      include: {
        tenant: { select: { id: true, name: true, slug: true, industry: true, logoUrl: true } },
        branch: { select: { id: true, name: true, city: true } },
        customer: { select: { id: true, fullName: true, isActive: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // The (tenant, phone) unique constraint guarantees one member per club, but
    // customers may be matched by phone only — keep the richest row per tenant.
    const byTenant = new Map<
      string,
      {
        tenantId: string;
        tenantName: string;
        tenantSlug: string;
        industry: string;
        logoUrl: string | null;
        memberId: string;
        customerId: string | null;
        fullName: string;
        branch: { id: string; name: string; city: string | null } | null;
        isActive: boolean;
        /** When this membership started — shown on the user's profile. */
        joinedAt: string;
      }
    >();
    for (const row of rows) {
      if (byTenant.has(row.tenantId)) continue;
      byTenant.set(row.tenantId, {
        tenantId: row.tenantId,
        tenantName: row.tenant.name,
        tenantSlug: row.tenant.slug,
        industry: row.tenant.industry,
        logoUrl: row.tenant.logoUrl,
        memberId: row.id,
        customerId: row.customer?.id ?? null,
        fullName: row.customer?.fullName ?? row.fullName,
        branch: row.branch ?? null,
        isActive: row.isActive && (row.customer?.isActive ?? true),
        joinedAt: row.createdAt.toISOString(),
      });
    }

    // Customers can exist without an END_USER member (e.g. imported by staff).
    const customers = await this.prisma.client.customer.findMany({
      where: { phone, deletedAt: null, memberId: null, tenant: { status: 'ACTIVE' } },
      include: {
        tenant: { select: { id: true, name: true, slug: true, industry: true, logoUrl: true } },
      },
    });
    for (const customer of customers) {
      if (byTenant.has(customer.tenantId)) continue;
      byTenant.set(customer.tenantId, {
        tenantId: customer.tenantId,
        tenantName: customer.tenant.name,
        tenantSlug: customer.tenant.slug,
        industry: customer.tenant.industry,
        logoUrl: customer.tenant.logoUrl,
        memberId: '', // no panel identity yet — provisioned on open
        customerId: customer.id,
        fullName: customer.fullName,
        branch: null,
        isActive: customer.isActive,
        joinedAt: customer.createdAt.toISOString(),
      });
    }

    return [...byTenant.values()].map((club, index) => ({
      ...club,
      primaryLinked: index === 0,
    }));
  }

  /** Clubs of the currently logged-in phone (student dashboard). */
  async myClubs(memberId: string) {
    const member = await this.prisma.client.member.findUnique({
      where: { id: memberId },
      select: { phone: true },
    });
    if (!member?.phone) throw DomainException.notFound('کاربر');
    return this.membershipsForPhone(member.phone);
  }

  /**
   * Cross-club home for the portal: every club this phone belongs to, each with
   * *its own* numbers (حضور و غیاب، شهریه، اطلاعیه، نوبت بعدی). The token scopes
   * the detail sections to a single club, so this is the only place where a
   * multi-club student can compare all of them side by side. Every query is
   * filtered by the customer ids of this phone's own memberships, so no other
   * customer's data can leak in.
   */
  async myOverview(memberId: string) {
    const member = await this.prisma.client.member.findUnique({
      where: { id: memberId },
      select: { phone: true },
    });
    if (!member?.phone) throw DomainException.notFound('کاربر');

    const clubs = await this.membershipsForPhone(member.phone);
    const customerIds = clubs
      .map((club) => club.customerId)
      .filter((id): id is string => Boolean(id));
    const tenantIds = clubs.map((club) => club.tenantId);
    const now = new Date();

    const [attendance, invoices, installments, notices, appointments] = customerIds.length
      ? await Promise.all([
          this.prisma.client.attendance.groupBy({
            by: ['customerId', 'status'],
            where: { tenantId: { in: tenantIds }, customerId: { in: customerIds } },
            _count: { _all: true },
          }),
          this.prisma.client.invoice.findMany({
            where: {
              tenantId: { in: tenantIds },
              customerId: { in: customerIds },
              deletedAt: null,
              status: { notIn: ['PAID', 'CANCELED', 'DRAFT', 'REFUNDED'] },
            },
            select: { customerId: true, total: true, paidTotal: true, dueDate: true },
          }),
          this.prisma.client.installment.findMany({
            where: {
              tenantId: { in: tenantIds },
              customerId: { in: customerIds },
              status: { in: ['PENDING', 'OVERDUE'] },
            },
            orderBy: { dueDate: 'asc' },
            select: { customerId: true, amount: true, dueDate: true },
          }),
          this.prisma.client.message.findMany({
            where: { tenantId: { in: tenantIds }, customerId: { in: customerIds } },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              customerId: true,
              subject: true,
              body: true,
              channel: true,
              createdAt: true,
              readAt: true,
            },
          }),
          this.prisma.client.appointment.findMany({
            where: {
              tenantId: { in: tenantIds },
              customerId: { in: customerIds },
              status: { in: ['SCHEDULED', 'CONFIRMED'] },
              startsAt: { gte: now },
            },
            orderBy: { startsAt: 'asc' },
            select: { customerId: true, startsAt: true },
          }),
        ])
      : [[], [], [], [], []];

    const attendanceByCustomer = new Map<string, { present: number; total: number }>();
    for (const row of attendance) {
      if (!row.customerId) continue;
      const bucket = attendanceByCustomer.get(row.customerId) ?? { present: 0, total: 0 };
      bucket.total += row._count._all;
      if (row.status === 'PRESENT' || row.status === 'LATE') bucket.present += row._count._all;
      attendanceByCustomer.set(row.customerId, bucket);
    }

    const financeByCustomer = new Map<
      string,
      { outstanding: number; invoices: number; installments: number; nextDueDate: Date | null }
    >();
    const financeFor = (customerId: string) => {
      const bucket = financeByCustomer.get(customerId) ?? {
        outstanding: 0,
        invoices: 0,
        installments: 0,
        nextDueDate: null,
      };
      financeByCustomer.set(customerId, bucket);
      return bucket;
    };
    const keepEarliest = (current: Date | null, candidate: Date | null) => {
      if (!candidate) return current;
      return !current || candidate < current ? candidate : current;
    };
    for (const invoice of invoices) {
      const bucket = financeFor(invoice.customerId);
      bucket.outstanding += Number(invoice.total) - Number(invoice.paidTotal);
      bucket.invoices += 1;
      bucket.nextDueDate = keepEarliest(bucket.nextDueDate, invoice.dueDate);
    }
    for (const installment of installments) {
      const bucket = financeFor(installment.customerId);
      bucket.outstanding += Number(installment.amount);
      bucket.installments += 1;
      bucket.nextDueDate = keepEarliest(bucket.nextDueDate, installment.dueDate);
    }

    const noticesByCustomer = new Map<
      string,
      {
        total: number;
        unread: number;
        latest: {
          id: string;
          subject: string | null;
          body: string;
          channel: string;
          createdAt: Date;
          readAt: Date | null;
        } | null;
      }
    >();
    for (const notice of notices) {
      if (!notice.customerId) continue;
      const bucket = noticesByCustomer.get(notice.customerId) ?? {
        total: 0,
        unread: 0,
        latest: null,
      };
      bucket.total += 1;
      if (!notice.readAt) bucket.unread += 1;
      bucket.latest ??= {
        id: notice.id,
        subject: notice.subject,
        body: notice.body,
        channel: notice.channel,
        createdAt: notice.createdAt,
        readAt: notice.readAt,
      };
      noticesByCustomer.set(notice.customerId, bucket);
    }

    const appointmentsByCustomer = new Map<string, { upcoming: number; nextStartsAt: Date | null }>();
    for (const appointment of appointments) {
      const bucket = appointmentsByCustomer.get(appointment.customerId) ?? {
        upcoming: 0,
        nextStartsAt: null,
      };
      bucket.upcoming += 1;
      bucket.nextStartsAt ??= appointment.startsAt;
      appointmentsByCustomer.set(appointment.customerId, bucket);
    }

    const rows = clubs.map((club) => {
      const customerId = club.customerId;
      const attendanceBucket = (customerId && attendanceByCustomer.get(customerId)) || {
        present: 0,
        total: 0,
      };
      const finance = (customerId && financeByCustomer.get(customerId)) || {
        outstanding: 0,
        invoices: 0,
        installments: 0,
        nextDueDate: null,
      };
      const noticesBucket = (customerId && noticesByCustomer.get(customerId)) || {
        total: 0,
        unread: 0,
        latest: null,
      };
      const appointmentBucket = (customerId && appointmentsByCustomer.get(customerId)) || {
        upcoming: 0,
        nextStartsAt: null,
      };
      return {
        ...club,
        attendance: {
          present: attendanceBucket.present,
          total: attendanceBucket.total,
          ratio: attendanceBucket.total
            ? Math.round((attendanceBucket.present / attendanceBucket.total) * 100)
            : 0,
        },
        finance,
        notices: noticesBucket,
        appointments: appointmentBucket,
      };
    });

    return {
      totals: {
        clubs: rows.length,
        industries: new Set(rows.map((row) => row.industry)).size,
        outstanding: rows.reduce((sum, row) => sum + row.finance.outstanding, 0),
        unreadNotices: rows.reduce((sum, row) => sum + row.notices.unread, 0),
        upcomingAppointments: rows.reduce((sum, row) => sum + row.appointments.upcoming, 0),
      },
      clubs: rows,
    };
  }

  /** All attendance records for this student across every club (APP-04). */
  async myAttendance(memberId: string) {
    const customer = await this.customerFor(memberId);
    const rows = await this.prisma.client.attendance.findMany({
      where: { tenantId: customer.tenantId, customerId: customer.id },
      orderBy: { date: 'desc' },
      take: 100,
    });
    const present = rows.filter((row) => row.status === 'PRESENT' || row.status === 'LATE').length;
    return {
      present,
      total: rows.length,
      ratio: rows.length ? Math.round((present / rows.length) * 100) : 0,
      records: rows,
    };
  }

  /** Open attendance sessions in the student's club they can self check in to. */
  async checkInTargets(memberId: string) {
    const customer = await this.customerFor(memberId);
    return this.prisma.client.attendanceQrSession.findMany({
      where: {
        tenantId: customer.tenantId,
        status: 'OPEN',
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, code: true, label: true, branchId: true, expiresAt: true },
    });
  }

  /** Panel self check-in (APP + ATT): identity proven by JWT, no OTP. */
  async panelCheckIn(memberId: string, dto: AppCheckInDto) {
    const customer = await this.customerFor(memberId);
    return this.attendanceQr.appCheckIn(customer.id, customer.tenantId, dto);
  }

  // ----- ATT-03 absence/excuse requests (student self-service) -----

  /** A student submits an excuse request ("I can't attend this session because ..."). */
  async createAbsenceRequest(memberId: string, dto: CreateAbsenceRequestDto) {
    const customer = await this.customerFor(memberId);

    // `dateOnlySchema` already normalised the input to UTC midnight of the day.
    const day = dto.absenceDate;

    const existing = await this.prisma.client.absenceRequest.findFirst({
      where: {
        tenantId: customer.tenantId,
        customerId: customer.id,
        absenceDate: day,
        status: 'PENDING',
      },
      select: { id: true },
    });
    if (existing) {
      throw DomainException.conflict('برای این تاریخ یک درخواست در انتظار بررسی دارید');
    }

    return this.prisma.client.absenceRequest.create({
      data: {
        tenantId: customer.tenantId,
        customerId: customer.id,
        absenceDate: day,
        reason: dto.reason,
        note: dto.note ?? null,
        appointmentId: dto.appointmentId ?? null,
        serviceId: dto.serviceId ?? null,
      },
    });
  }

  /** A student's own absence requests and their review status. */
  async myAbsenceRequests(memberId: string) {
    const customer = await this.customerFor(memberId);
    return this.prisma.client.absenceRequest.findMany({
      where: { tenantId: customer.tenantId, customerId: customer.id },
      orderBy: { absenceDate: 'desc' },
      take: 100,
    });
  }

  // ----- APP-02 booking -----

  async availability(memberId: string, dto: AppAvailabilityDto) {
    const customer = await this.customerFor(memberId);
    const dayStart = new Date(dto.date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + DAY_MS);

    let duration = 60;
    if (dto.serviceId) {
      const service = await this.prisma.client.service.findFirst({
        where: { id: dto.serviceId, tenantId: customer.tenantId, deletedAt: null },
      });
      if (!service) throw DomainException.notFound('خدمت');
      duration = service.durationMinutes;
    }

    const busy = await this.prisma.client.appointment.findMany({
      where: {
        tenantId: customer.tenantId,
        ...(dto.staffId ? { staffId: dto.staffId } : {}),
        status: { notIn: ['CANCELED', 'NO_SHOW'] },
        startsAt: { lt: dayEnd },
        endsAt: { gt: dayStart },
      },
      select: { startsAt: true, endsAt: true },
    });

    const slots: string[] = [];
    for (
      let t = dayStart.getTime() + 9 * 3600_000;
      t + duration * 60_000 <= dayStart.getTime() + 21 * 3600_000;
      t += 30 * 60_000
    ) {
      const s = new Date(t);
      const e = new Date(t + duration * 60_000);
      if (!busy.some((a) => a.startsAt < e && a.endsAt > s)) slots.push(s.toISOString());
    }
    return { date: dayStart.toISOString(), durationMinutes: duration, slots };
  }

  async book(memberId: string, dto: AppBookDto) {
    const customer = await this.customerFor(memberId);
    let duration = 60;
    let price = 0;
    if (dto.serviceId) {
      const service = await this.prisma.client.service.findFirst({
        where: { id: dto.serviceId, tenantId: customer.tenantId, deletedAt: null },
      });
      if (!service) throw DomainException.notFound('خدمت');
      duration = service.durationMinutes;
      price = Number(service.price);
    }
    const startsAt = dto.startsAt;
    const endsAt = new Date(startsAt.getTime() + duration * 60_000);

    const conflict = await this.prisma.client.appointment.findFirst({
      where: {
        tenantId: customer.tenantId,
        ...(dto.staffId ? { staffId: dto.staffId } : {}),
        status: { notIn: ['CANCELED', 'NO_SHOW'] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
    });
    if (conflict) throw DomainException.conflict('این زمان قبلاً رزرو شده است');

    return this.prisma.client.appointment.create({
      data: {
        tenantId: customer.tenantId,
        branchId: dto.branchId ?? null,
        customerId: customer.id,
        serviceId: dto.serviceId ?? null,
        staffId: dto.staffId ?? null,
        startsAt,
        endsAt,
        status: 'SCHEDULED',
        source: 'app',
        notes: dto.notes ?? null,
        meta: { price } as never,
      },
    });
  }

  async cancelAppointment(memberId: string, appointmentId: string, dto: AppCancelDto) {
    const customer = await this.customerFor(memberId);
    const appointment = await this.prisma.client.appointment.findFirst({
      where: { id: appointmentId, tenantId: customer.tenantId, customerId: customer.id },
    });
    if (!appointment) throw DomainException.notFound('نوبت');
    if (appointment.status === 'CANCELED') throw DomainException.conflict('نوبت قبلاً لغو شده است');
    return this.prisma.client.appointment.update({
      where: { id: appointmentId },
      data: { status: 'CANCELED', cancelReason: dto.reason ?? 'لغو توسط کاربر' },
    });
  }

  async myAppointments(memberId: string) {
    const customer = await this.customerFor(memberId);
    return this.prisma.client.appointment.findMany({
      where: { tenantId: customer.tenantId, customerId: customer.id },
      orderBy: { startsAt: 'desc' },
      take: 100,
      include: { service: { select: { name: true } } },
    });
  }

  // ----- APP-03 invoices & payment -----

  async myInvoices(memberId: string) {
    const customer = await this.customerFor(memberId);
    return this.prisma.client.invoice.findMany({
      where: { tenantId: customer.tenantId, customerId: customer.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { items: true },
    });
  }

  async payInvoice(memberId: string, dto: AppPayDto) {
    const customer = await this.customerFor(memberId);
    const invoice = await this.prisma.client.invoice.findFirst({
      where: { id: dto.invoiceId, tenantId: customer.tenantId, customerId: customer.id },
    });
    if (!invoice) throw DomainException.notFound('فاکتور');
    const remaining = Number(invoice.total) - Number(invoice.paidTotal);
    if (remaining <= 0) throw DomainException.conflict('این فاکتور قبلاً تسویه شده است');

    const amount = dto.amount ?? remaining;
    if (amount > remaining)
      throw DomainException.badRequest('مبلغ پرداخت بیشتر از مانده فاکتور است');

    return this.payments.createOnlinePayment(customer.tenantId, {
      invoiceId: invoice.id,
      customerId: customer.id,
      amount,
      description: `پرداخت فاکتور ${invoice.number}`,
      provider: dto.provider,
    });
  }

  // ----- APP-04 personal history -----

  async myHistory(memberId: string) {
    const customer = await this.customerFor(memberId);
    const [appointments, payments, subscriptions] = await this.prisma.client.$transaction([
      this.prisma.client.appointment.findMany({
        where: { tenantId: customer.tenantId, customerId: customer.id, status: 'COMPLETED' },
        orderBy: { startsAt: 'desc' },
        take: 50,
        include: { service: { select: { name: true } } },
      }),
      this.prisma.client.payment.findMany({
        where: { tenantId: customer.tenantId, customerId: customer.id, status: 'SUCCEEDED' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.client.studentSubscription.findMany({
        where: { tenantId: customer.tenantId, customerId: customer.id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { appointments, payments, subscriptions };
  }

  // ----- APP-05 messages & notifications -----

  async myNotifications(memberId: string) {
    const customer = await this.customerFor(memberId);
    return this.prisma.client.message.findMany({
      where: { tenantId: customer.tenantId, customerId: customer.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markNotificationRead(memberId: string, messageId: string) {
    const customer = await this.customerFor(memberId);
    const message = await this.prisma.client.message.findFirst({
      where: { id: messageId, tenantId: customer.tenantId, customerId: customer.id },
    });
    if (!message) throw DomainException.notFound('پیام');
    return this.prisma.client.message.update({
      where: { id: messageId },
      data: { status: 'READ', readAt: new Date() },
    });
  }

  // ----- APP-06 loyalty & wallet -----

  async myLoyalty(memberId: string) {
    const customer = await this.customerFor(memberId);
    const [wallet, loyalty] = await this.prisma.client.$transaction([
      this.prisma.client.wallet.findUnique({ where: { customerId: customer.id } }),
      this.prisma.client.loyaltyAccount.findUnique({ where: { customerId: customer.id } }),
    ]);
    return {
      walletBalance: wallet ? Number(wallet.balance) : 0,
      points: loyalty?.points ?? 0,
      tier: loyalty?.tier ?? 'bronze',
    };
  }

  // ----- SHOP — my orders (marketplace purchases) -----

  /** Every order placed with the mobile number behind this portal member. */
  async myOrders(memberId: string) {
    const customerIds = await this.portalCustomerIds(memberId);
    if (customerIds.length === 0) return [];

    const orders = await this.prisma.client.order.findMany({
      where: { customerId: { in: customerIds } },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        number: true,
        status: true,
        items: true,
        subtotal: true,
        shippingCost: true,
        total: true,
        shippingMethod: true,
        trackingCode: true,
        address: true,
        createdAt: true,
        tenant: { select: { slug: true, name: true, logoUrl: true } },
        payments: {
          select: { id: true, status: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    return orders.map(({ payments, ...order }) => ({
      ...order,
      payment: payments[0] ?? null,
    }));
  }

  /** A single order, only when it belongs to one of this member's files. */
  private async findMyOrder(memberId: string, orderId: string) {
    const customerIds = await this.portalCustomerIds(memberId);
    if (customerIds.length === 0) throw DomainException.notFound('سفارش');
    const order = await this.prisma.client.order.findFirst({
      where: { id: orderId, customerId: { in: customerIds } },
    });
    if (!order) throw DomainException.notFound('سفارش');
    return order;
  }

  async myOrder(memberId: string, orderId: string) {
    return this.findMyOrder(memberId, orderId);
  }

  async cancelMyOrder(memberId: string, orderId: string) {
    const order = await this.findMyOrder(memberId, orderId);
    if (order.status !== 'PENDING') {
      throw DomainException.badRequest('فقط سفارش در انتظار تأیید قابل لغو است');
    }
    return this.shop.updateStatus(order.tenantId, order.id, { status: 'CANCELED' });
  }

  /** Starts (or retries) the online payment of a pending order. */
  async payMyOrder(memberId: string, orderId: string) {
    const order = await this.findMyOrder(memberId, orderId);
    if (order.status !== 'PENDING') {
      throw DomainException.badRequest('این سفارش دیگر قابل پرداخت نیست');
    }
    return this.payments.createOnlinePayment(order.tenantId, {
      orderId: order.id,
      customerId: order.customerId ?? undefined,
      description: `پرداخت سفارش ${order.number}`,
    });
  }

  private async portalCustomerIds(memberId: string): Promise<string[]> {
    const customers = await this.prisma.client.customer.findMany({
      where: { memberId, deletedAt: null },
      select: { id: true },
    });
    return customers.map((customer) => customer.id);
  }

  // ----- APP-07 reviews -----

  async submitReview(memberId: string, dto: AppReviewDto) {
    const customer = await this.customerFor(memberId);

    let orderId: string | null = null;
    let productId = dto.productId ?? null;
    let serviceId = dto.serviceId ?? null;
    let isVerified = false;

    if (dto.orderId) {
      const order = await this.prisma.client.order.findFirst({
        where: { id: dto.orderId, customerId: customer.id },
      });
      if (!order) throw DomainException.notFound('سفارش');
      if (order.status !== 'DELIVERED') {
        throw DomainException.badRequest('ثبت نظر پس از تحویل سفارش ممکن است');
      }
      const items = Array.isArray(order.items) ? (order.items as Array<{ productId?: string }>) : [];
      if (!productId) productId = items.find((item) => item.productId)?.productId ?? null;
      orderId = order.id;
      isVerified = true;
    }

    if (productId) {
      const product = await this.prisma.client.product.findFirst({
        where: { id: productId, tenantId: customer.tenantId },
        select: { id: true },
      });
      if (!product) throw DomainException.notFound('محصول');
      const duplicate = await this.prisma.client.review.findFirst({
        where: { customerId: customer.id, productId },
        select: { id: true },
      });
      if (duplicate) throw DomainException.conflict('برای این محصول قبلاً نظر ثبت کرده‌اید');
    }
    if (serviceId) {
      const service = await this.prisma.client.service.findFirst({
        where: { id: serviceId, tenantId: customer.tenantId },
        select: { id: true },
      });
      if (!service) throw DomainException.notFound('خدمت');
    }

    const review = await this.prisma.client.review.create({
      data: {
        tenantId: customer.tenantId,
        customerId: customer.id,
        productId,
        serviceId,
        orderId,
        isVerified,
        rating: dto.rating,
        comment: dto.comment ?? null,
        // A verified purchase can be published right away; anything else waits
        // for the platform moderation queue.
        isPublic: isVerified,
        approvedAt: isVerified ? new Date() : null,
      },
    });
    // ACK via in-app message so the customer sees confirmation (APP-05).
    await this.messaging
      .send(customer.tenantId, {
        customerId: customer.id,
        channel: 'IN_APP',
        body: isVerified
          ? 'نظر شما ثبت و منتشر شد. سپاسگزاریم!'
          : 'نظر شما ثبت شد و پس از تأیید نمایش داده می‌شود. سپاسگزاریم!',
      })
      .catch(() => undefined);
    return review;
  }

  /** Public: tenant branding + services for the portal landing page. */
  async tenantProfile(slug: string) {
    const tenant = await this.prisma.client.tenant.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { id: true, name: true, logoUrl: true, address: true, phone: true, industry: true },
    });
    if (!tenant) throw DomainException.notFound('کسب‌وکار');
    const services = await this.prisma.client.service.findMany({
      where: { tenantId: tenant.id, isActive: true, deletedAt: null },
      select: { id: true, name: true, description: true, durationMinutes: true, price: true },
    });
    return { tenant: { slug, ...tenant }, services };
  }
}
