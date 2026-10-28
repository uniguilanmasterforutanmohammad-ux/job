import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { toDataURL } from 'qrcode';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import { PrismaService } from '../../database/prisma.service.js';
import { RedisService } from '../../redis/redis.service.js';
import { OtpService } from '../auth/otp.service.js';
import type {
  AppCheckInDto,
  OpenQrSessionDto,
  QrCheckInDto,
  QrCheckInOtpRequestDto,
} from './dto/attendance-qr.schemas.js';

const DEFAULT_SESSION_TTL_MINUTES = 120;
const CHECKIN_PREFIX = 'attqr:checkin:';
const CHECKIN_DEDUPE_SECONDS = 24 * 60 * 60;
const MIN_TOKEN_REFRESH_MS = 5_000;

type RotatingToken = {
  token: string;
  expiresInSeconds: number;
};

/**
 * Public/rotating QR attendance (ATT-01). A teacher opens a short-lived
 * "session"; the QR encodes a token that changes every few seconds so a photo
 * of the screen cannot be reused later. Students scan, then confirm their
 * identity with an OTP (and optionally a geofence) to mark themselves present.
 */
@Injectable()
export class AttendanceQrService {
  private readonly logger = new Logger(AttendanceQrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly otp: OtpService,
  ) {}

  // ----- manager side -----

  /** Opens a new attendance session and returns its first QR payload. */
  async openSession(tenantId: string, memberId: string, dto: OpenQrSessionDto) {
    if (dto.branchId) await this.assertBranch(tenantId, dto.branchId);
    if (dto.serviceId) await this.assertService(tenantId, dto.serviceId);

    const ttlMinutes = dto.ttlMinutes ?? DEFAULT_SESSION_TTL_MINUTES;
    const session = await this.prisma.client.attendanceQrSession.create({
      data: {
        tenantId,
        branchId: dto.branchId ?? null,
        serviceId: dto.serviceId ?? null,
        appointmentId: dto.appointmentId ?? null,
        label: dto.label ?? null,
        code: this.newCode(),
        secret: randomBytes(24).toString('base64url'),
        rotateSeconds: dto.rotateSeconds,
        radiusMeters: dto.radiusMeters,
        requireOtp: dto.requireOtp,
        openedByMemberId: memberId,
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      },
    });

    return this.decorateSession(session);
  }

  async listSessions(tenantId: string) {
    const sessions = await this.prisma.client.attendanceQrSession.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return Promise.all(sessions.map((session) => this.decorateSession(session)));
  }

  /** Live state of a session (poll target for the teacher's projector screen). */
  async getSession(tenantId: string, id: string) {
    const session = await this.prisma.client.attendanceQrSession.findFirst({
      where: { id, tenantId },
    });
    if (!session) throw DomainException.notFound('جلسه حاضری');
    return this.decorateSession(session);
  }

  /** Who has checked in to this session so far (live attendance wall). */
  async sessionAttendances(tenantId: string, id: string) {
    await this.getSession(tenantId, id);
    const rows = await this.prisma.client.attendance.findMany({
      where: { tenantId, sessionId: id },
      orderBy: { checkInAt: 'asc' },
      include: { customer: { select: { id: true, fullName: true, phone: true } } },
    });
    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      method: row.method,
      checkInAt: row.checkInAt,
      customer: row.customer,
    }));
  }

  async closeSession(tenantId: string, id: string) {
    const session = await this.prisma.client.attendanceQrSession.findFirst({
      where: { id, tenantId },
    });
    if (!session) throw DomainException.notFound('جلسه حاضری');
    if (session.status === 'CLOSED') return this.decorateSession(session);
    const closed = await this.prisma.client.attendanceQrSession.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
    return this.decorateSession(closed);
  }

  // ----- public / student side -----

  /** Public lookup used by the scan page to validate the code and token. */
  async lookupByCode(code: string, token?: string) {
    const session = await this.requireActive(code);
    const tokenValid = token
      ? this.verifyToken(session.secret, token, session.rotateSeconds)
      : null;
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: session.tenantId },
      select: { name: true, slug: true, logoUrl: true },
    });
    return {
      code: session.code,
      label: session.label,
      rotateSeconds: session.rotateSeconds,
      requireOtp: session.requireOtp,
      expiresAt: session.expiresAt,
      tokenValid,
      tenant,
    };
  }

  /** Sends an OTP to the student's phone (rate-limited by OtpService). */
  async requestCheckInOtp(dto: QrCheckInOtpRequestDto) {
    await this.requireActive(dto.code);
    await this.otp.request(dto.phone, 'LOGIN');
    return { message: 'کد تأیید ارسال شد' };
  }

  /**
   * Confirms a student's presence via the public path (scan or shared link):
   * validates the rotating token (or session code) plus an OTP.
   */
  async checkIn(dto: QrCheckInDto) {
    const session = dto.token
      ? await this.requireActiveByToken(dto.token)
      : await this.requireActive(dto.code!);

    const customer = await this.resolveCustomer(session.tenantId, dto.phone);

    if (session.requireOtp) {
      await this.otp.verify(dto.phone, dto.otp, 'LOGIN');
    }

    return this.recordCheckIn(session, customer, {
      method: 'QR',
      note: dto.latitude != null ? 'qr+geo' : 'qr',
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracyMeters: dto.accuracyMeters,
    });
  }

  /**
   * Self check-in from the authenticated end-user panel (APP). No OTP needed:
   * the JWT proves identity. The student targets one of their session's open
   * attendance codes; tenant isolation is enforced by resolving the session
   * only within the student's own tenant.
   */
  async appCheckIn(customerId: string, tenantId: string, dto: AppCheckInDto) {
    const session = dto.sessionId
      ? await this.prisma.client.attendanceQrSession.findFirst({
          where: { id: dto.sessionId, tenantId },
        })
      : await this.prisma.client.attendanceQrSession.findFirst({
          where: { code: dto.code!, tenantId },
          orderBy: { createdAt: 'desc' },
        });
    if (!session) throw DomainException.notFound('جلسه حاضری');
    this.assertOpen(session);

    return this.recordCheckIn(
      session,
      { id: customerId, memberId: null },
      {
        method: 'MANUAL',
        note: dto.latitude != null ? 'panel+geo' : 'panel',
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyMeters: dto.accuracyMeters,
      },
    );
  }

  /**
   * Idempotent attendance write shared by the public QR path and the panel
   * path. Dedupes per session+customer so a re-scan never double-records.
   */
  private async recordCheckIn(
    session: { id: string; tenantId: string; branchId: string | null; radiusMeters: number },
    customer: { id: string; memberId?: string | null },
    options: {
      method: 'QR' | 'MANUAL' | 'PERSONAL_CODE';
      note: string;
      latitude?: number;
      longitude?: number;
      accuracyMeters?: number;
    },
  ) {
    const dedupeKey = `${CHECKIN_PREFIX}${session.id}:${customer.id}`;
    const already = await this.redis.getJson<{ attendanceId: string }>(dedupeKey);
    if (already) {
      return { alreadyCheckedIn: true, attendanceId: already.attendanceId };
    }

    await this.assertWithinGeofence(session, options);

    const today = new Date();
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const attendance = await this.prisma.client.attendance.create({
      data: {
        tenantId: session.tenantId,
        branchId: session.branchId,
        customerId: customer.id,
        memberId: customer.memberId ?? null,
        sessionId: session.id,
        status: 'PRESENT',
        method: options.method,
        date: day,
        checkInAt: new Date(),
        note: options.note,
      },
    });

    await this.redis.setJson(dedupeKey, { attendanceId: attendance.id }, CHECKIN_DEDUPE_SECONDS);
    return { alreadyCheckedIn: false, attendanceId: attendance.id };
  }

  // ----- helpers -----

  private async decorateSession(session: {
    id: string;
    tenantId: string;
    branchId: string | null;
    serviceId: string | null;
    appointmentId: string | null;
    label: string | null;
    code: string;
    secret: string;
    rotateSeconds: number;
    radiusMeters: number;
    requireOtp: boolean;
    status: string;
    expiresAt: Date;
    closedAt: Date | null;
    createdAt: Date;
  }) {
    const expired = session.expiresAt.getTime() <= Date.now();
    const status = session.status === 'OPEN' && expired ? 'EXPIRED' : session.status;
    const token = this.rotatingToken(session.secret, session.rotateSeconds);
    const base = process.env.APP_URL ?? 'http://localhost:3000';

    return {
      id: session.id,
      tenantId: session.tenantId,
      branchId: session.branchId,
      serviceId: session.serviceId,
      appointmentId: session.appointmentId,
      label: session.label,
      code: session.code,
      rotateSeconds: session.rotateSeconds,
      radiusMeters: session.radiusMeters,
      requireOtp: session.requireOtp,
      status,
      expiresAt: session.expiresAt,
      closedAt: session.closedAt,
      createdAt: session.createdAt,
      checkInUrl: `${base}/attendance/scan/${session.code}`,
      token: token.token,
      tokenExpiresInSeconds: token.expiresInSeconds,
      qrDataUrl: token
        ? await toDataURL(this.buildQrPayload(session.code, token.token), {
            width: 320,
            margin: 1,
          })
        : null,
    };
  }

  private buildQrPayload(code: string, token: string): string {
    const base = process.env.APP_URL ?? 'http://localhost:3000';
    return `${base}/attendance/scan/${code}?t=${token}`;
  }

  /**
   * Derives a token bound to the current time bucket. Changing the bucket every
   * `rotateSeconds` invalidates screenshots taken earlier.
   */
  private rotatingToken(secret: string, rotateSeconds: number): RotatingToken {
    const bucket = Math.floor(Date.now() / (rotateSeconds * 1000));
    const token = createHmac('sha256', secret).update(String(bucket)).digest('base64url');
    const elapsedMs = Date.now() - bucket * rotateSeconds * 1000;
    const remaining = Math.max(
      Math.ceil((rotateSeconds * 1000 - elapsedMs) / 1000),
      MIN_TOKEN_REFRESH_MS / 1000,
    );
    return { token, expiresInSeconds: remaining };
  }

  /** Accepts the current bucket and the previous one (clock-skew tolerance). */
  private verifyToken(secret: string, token: string, rotateSeconds: number): boolean {
    if (!token) return false;
    const bucket = Math.floor(Date.now() / (rotateSeconds * 1000));
    for (const offset of [0, -1]) {
      const expected = createHmac('sha256', secret)
        .update(String(bucket + offset))
        .digest('base64url');
      if (this.safeEqual(expected, token)) return true;
    }
    return false;
  }

  private safeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  private async assertWithinGeofence(
    session: { branchId: string | null; radiusMeters: number; tenantId: string },
    dto: { latitude?: number; longitude?: number; accuracyMeters?: number },
  ) {
    if (!session.branchId) return;
    if (dto.latitude == null || dto.longitude == null) return;
    const branch = await this.prisma.client.branch.findFirst({
      where: { id: session.branchId, tenantId: session.tenantId },
      select: { latitude: true, longitude: true },
    });
    if (!branch?.latitude || !branch?.longitude) return;
    const distance = haversineMeters(
      { lat: Number(branch.latitude), lng: Number(branch.longitude) },
      { lat: dto.latitude, lng: dto.longitude },
    );
    if (distance > session.radiusMeters + (dto.accuracyMeters ?? 0)) {
      throw DomainException.badRequest('شما در محدوده محل برگزاری نیستید');
    }
  }

  private async resolveCustomer(tenantId: string, phone: string) {
    const existing = await this.prisma.client.customer.findFirst({
      where: { tenantId, phone, deletedAt: null },
      select: { id: true, memberId: true },
    });
    if (existing) return existing;

    const customer = await this.prisma.client.customer.create({
      data: { tenantId, fullName: 'حاضر (QR)', phone, source: 'attendance-qr' },
      select: { id: true, memberId: true },
    });
    return customer;
  }

  private async requireActive(code: string) {
    const session = await this.prisma.client.attendanceQrSession.findFirst({
      where: { code },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) throw DomainException.notFound('جلسه حاضری');
    this.assertOpen(session);
    return session;
  }

  private async requireActiveByToken(token: string) {
    // Tokens are validated against each open session (short list in practice).
    const candidates = await this.prisma.client.attendanceQrSession.findMany({
      where: { status: 'OPEN', expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const match = candidates.find((session) =>
      this.verifyToken(session.secret, token, session.rotateSeconds),
    );
    if (!match) throw DomainException.badRequest('کد QR نامعتبر یا منقضی شده است');
    return match;
  }

  private assertOpen(session: { status: string; expiresAt: Date }): void {
    if (session.status === 'CLOSED') throw DomainException.badRequest('این جلسه بسته شده است');
    if (session.status === 'EXPIRED' || session.expiresAt.getTime() <= Date.now()) {
      throw DomainException.badRequest('این جلسه حاضری منقضی شده است');
    }
  }

  private newCode(): string {
    // 6-char base32-ish code, easy to read out loud as a fallback.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i += 1) code += alphabet[randomInt(0, alphabet.length)];
    return code;
  }

  private async assertBranch(tenantId: string, branchId: string) {
    const branch = await this.prisma.client.branch.findFirst({
      where: { id: branchId, tenantId },
      select: { id: true },
    });
    if (!branch) throw DomainException.notFound('شعبه');
  }

  private async assertService(tenantId: string, serviceId: string) {
    const service = await this.prisma.client.service.findFirst({
      where: { id: serviceId, tenantId },
      select: { id: true },
    });
    if (!service) throw DomainException.notFound('خدمت');
  }
}

const R = 6_371_000;

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}
