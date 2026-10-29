import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service.js';
import { DomainException } from '../../common/exceptions/domain.exception.js';
import {
  BaleApiError,
  BaleClient,
  BALE_TOKEN_PATTERN,
  isGroupChat,
  maskBotToken,
  type BaleChat,
  type BaleChatMember,
  type BaleUpdate,
} from './bale.api.js';
import { BALE_EVENTS, type DiscoverBaleDto, type SaveBaleSettingsDto } from './bale.schemas.js';

export type BaleCandidate = {
  chatId: string;
  title: string;
  type: string;
  status: BaleChatMember['status'] | 'unknown';
  isAdmin: boolean;
  inviteLink: string | null;
};

export type BaleMirrorResult =
  | { status: 'SENT'; messageId: string }
  | { status: 'SKIPPED'; reason: string }
  | { status: 'FAILED'; error: string };

const STATUS_LABELS: Record<string, string> = {
  creator: 'مالک گروه',
  administrator: 'ادمین',
  member: 'عضو',
  restricted: 'محدود',
  left: 'خارج از گروه',
  kicked: 'حذف‌شده',
  unknown: 'نامشخص',
};

/** Mirrors a business's notifications into a Bale group (MSG-BALE). */
@Injectable()
export class BaleService {
  private readonly logger = new Logger(BaleService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.baseUrl = config.get<string>('baleApiUrl') ?? 'https://tapi.bale.ai';
  }

  // ------------------------------------------------------------------ settings

  async getSettings(tenantId: string) {
    const row = await this.prisma.client.baleIntegration.findUnique({ where: { tenantId } });
    return this.toView(row);
  }

  async saveSettings(tenantId: string, dto: SaveBaleSettingsDto) {
    const existing = await this.prisma.client.baleIntegration.findUnique({ where: { tenantId } });
    const token = dto.botToken?.trim() || existing?.botToken;
    if (!token) throw DomainException.badRequest('برای اتصال، توکن ربات بله را وارد کنید');
    if (!BALE_TOKEN_PATTERN.test(token)) {
      throw DomainException.badRequest('توکن ربات معتبر نیست؛ قالب صحیح: ۱۲۳۴۵۶۷۸۹:ABC…');
    }

    const client = new BaleClient(token, this.baseUrl);
    let bot: Awaited<ReturnType<BaleClient['getMe']>>;
    try {
      bot = await client.getMe();
    } catch (error) {
      throw DomainException.badRequest(this.friendly(error, 'توکن ربات پذیرفته نشد'));
    }

    const groupLink = dto.groupLink ?? existing?.groupLink ?? null;
    let chatId = dto.chatId ?? existing?.chatId ?? null;
    let chatTitle = existing?.chatTitle ?? null;
    let adminVerified = false;
    let verificationMessage: string | null = null;

    // The owner may only know the join link; try to resolve it from the bot's
    // recent updates (a group shows up there once the bot is added).
    if (!chatId) {
      const candidates = await this.discoverChats(client, bot.id).catch(() => []);
      const picked = this.pickChat(candidates, groupLink);
      if (picked) {
        chatId = picked.chat.chatId;
        chatTitle = picked.chat.title;
      }
    }

    if (chatId) {
      try {
        const chat = await client.getChat(chatId);
        if (!isGroupChat(chat)) throw DomainException.badRequest('شناسهٔ داده‌شده یک گروه نیست');
        chatTitle = chat.title ?? chatTitle;
        const member = await client.getChatMember(chatId, bot.id);
        adminVerified = member.status === 'administrator' || member.status === 'creator';
        verificationMessage = adminVerified
          ? `ربات با دسترسی «${STATUS_LABELS[member.status]}» در گروه «${chatTitle ?? chatId}» تأیید شد`
          : `ربات در گروه «${chatTitle ?? chatId}» ${STATUS_LABELS[member.status] ?? member.status} است، نه ادمین`;
      } catch (error) {
        verificationMessage = this.friendly(error, 'بررسی گروه ممکن نشد');
        if (error instanceof DomainException) throw error;
      }
    }

    const adminConfirmed = adminVerified ? true : (dto.adminConfirmed ?? existing?.adminConfirmed ?? false);
    const events = dto.events ?? ((existing?.events as string[] | undefined) ?? ['announcement']);

    const row = await this.prisma.client.baleIntegration.upsert({
      where: { tenantId },
      create: {
        tenantId,
        botToken: token,
        botUsername: bot.username ?? null,
        groupLink,
        chatId,
        chatTitle,
        adminConfirmed,
        isActive: dto.isActive ?? true,
        events: events as never,
        lastError: adminVerified ? null : verificationMessage,
      },
      update: {
        botToken: token,
        botUsername: bot.username ?? null,
        ...(dto.groupLink !== undefined ? { groupLink } : {}),
        ...(dto.chatId !== undefined ? { chatId } : {}),
        ...(chatTitle ? { chatTitle } : {}),
        adminConfirmed,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.events !== undefined ? { events: events as never } : {}),
        lastError: adminVerified ? null : verificationMessage,
      },
    });

    return {
      ...this.toView(row),
      verification: {
        botOk: true,
        chatOk: Boolean(chatId && chatTitle),
        isAdmin: adminVerified,
        message: verificationMessage,
      },
    };
  }

  /** Disconnects the tenant: the token is destroyed, not just disabled. */
  async disconnect(tenantId: string) {
    await this.prisma.client.baleIntegration.deleteMany({ where: { tenantId } });
    return { connected: false };
  }

  // ---------------------------------------------------------------- discovery

  async discover(tenantId: string, dto: DiscoverBaleDto = {}) {
    const row = await this.prisma.client.baleIntegration.findUnique({ where: { tenantId } });
    if (!row?.botToken) throw DomainException.badRequest('اول توکن ربات را ذخیره کنید');

    const client = new BaleClient(row.botToken, this.baseUrl);
    const bot = await client.getMe().catch((error: unknown) => {
      throw DomainException.badRequest(this.friendly(error, 'توکن ربات پذیرفته نشد'));
    });
    const candidates = await this.discoverChats(client, bot.id);
    const link = dto.groupLink ?? row.groupLink ?? null;
    const picked = this.pickChat(candidates, link);

    return {
      botUsername: bot.username ?? null,
      candidates,
      matchedChatId: picked?.chat.chatId ?? null,
      matchedBy: picked?.matchedBy ?? null,
      hint: candidates.length
        ? null
        : 'گروهی پیدا نشد. ربات را به گروه اضافه کنید، یک پیام در گروه بفرستید و دوباره تلاش کنید.',
    };
  }

  // --------------------------------------------------------------------- test

  async test(tenantId: string) {
    const row = await this.prisma.client.baleIntegration.findUnique({ where: { tenantId } });
    if (!row?.botToken) throw DomainException.badRequest('اول توکن ربات را ذخیره کنید');

    const client = new BaleClient(row.botToken, this.baseUrl);
    const bot = await client.getMe().catch((error: unknown) => {
      throw DomainException.badRequest(this.friendly(error, 'توکن ربات پذیرفته نشد'));
    });

    let chatId = row.chatId;
    let chatTitle = row.chatTitle;
    if (!chatId) {
      const candidates = await this.discoverChats(client, bot.id);
      const adminGroups = candidates.filter((candidate) => candidate.isAdmin);
      if (adminGroups.length !== 1) {
        throw DomainException.badRequest(
          adminGroups.length
            ? 'ربات در چند گروه ادمین است؛ گروه مقصد را انتخاب کنید'
            : 'ربات در هیچ گروهی ادمین نیست؛ ابتدا آن را ادمین گروه کنید',
        );
      }
      chatId = adminGroups[0].chatId;
      chatTitle = adminGroups[0].title;
    }

    try {
      const member = await client.getChatMember(chatId, bot.id);
      const isAdmin = member.status === 'administrator' || member.status === 'creator';
      if (!isAdmin) {
        throw DomainException.badRequest(
          `ربات در این گروه ${STATUS_LABELS[member.status] ?? member.status} است؛ برای ارسال، آن را ادمین کنید`,
        );
      }

      const tenant = await this.prisma.client.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      const message = await client.sendMessage(
        chatId,
        [
          '✅ <b>اتصال سایت به بله برقرار است</b>',
          '',
          `این پیام آزمایشی از پنل «${escapeHtml(tenant?.name ?? 'کسب‌وکار')}» ارسال شد.`,
          'از این پس اطلاعیه‌های منتشرشده در سایت، همین‌جا هم ارسال می‌شوند.',
        ].join('\n'),
      );

      await this.prisma.client.baleIntegration.update({
        where: { tenantId },
        data: {
          chatId,
          chatTitle,
          adminConfirmed: true,
          lastTestedAt: new Date(),
          lastTestStatus: 'OK',
          lastError: null,
        },
      });

      return {
        ok: true,
        chatId,
        chatTitle,
        messageId: String(message.message_id),
        checks: {
          bot: bot.username ?? String(bot.id),
          admin: STATUS_LABELS[member.status],
          sent: true,
        },
      };
    } catch (error) {
      const message = this.friendly(error, 'ارسال پیام آزمایشی ناموفق بود');
      await this.prisma.client.baleIntegration.update({
        where: { tenantId },
        data: { lastTestedAt: new Date(), lastTestStatus: 'FAILED', lastError: message },
      });
      throw DomainException.badRequest(message);
    }
  }

  // ------------------------------------------------------------------- mirror

  /** Sends one notification to the tenant's group, honouring toggles/events. */
  async mirror(
    tenantId: string,
    event: string,
    payload: { title: string; body: string; eventDate?: Date | null },
  ): Promise<BaleMirrorResult> {
    const row = await this.prisma.client.baleIntegration.findUnique({ where: { tenantId } });
    if (!row?.botToken) return { status: 'SKIPPED', reason: 'not_configured' };
    if (!row.isActive) return { status: 'SKIPPED', reason: 'disabled' };
    if (!row.adminConfirmed || !row.chatId) return { status: 'SKIPPED', reason: 'not_confirmed' };

    const events = (row.events as string[] | null) ?? [];
    if (!events.includes(event)) return { status: 'SKIPPED', reason: 'event_disabled' };

    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    const lines = [`📢 <b>${escapeHtml(payload.title)}</b>`, '', escapeHtml(payload.body)];
    if (payload.eventDate) lines.push('', `🗓 ${formatJalali(payload.eventDate)}`);
    lines.push('', `— ${escapeHtml(tenant?.name ?? '')}`);

    try {
      const client = new BaleClient(row.botToken, this.baseUrl);
      const message = await client.sendMessage(row.chatId, lines.join('\n'));
      return { status: 'SENT', messageId: String(message.message_id) };
    } catch (error) {
      const message = this.friendly(error, 'ارسال به بله ناموفق بود');
      this.logger.warn(`Bale mirror failed tenant=${tenantId} event=${event}: ${message}`);
      await this.prisma.client.baleIntegration
        .update({ where: { tenantId }, data: { lastError: message, lastTestStatus: 'FAILED' } })
        .catch(() => undefined);
      return { status: 'FAILED', error: message };
    }
  }

  /** True when the tenant wants this event mirrored (cheap, no network call). */
  async isEventEnabled(tenantId: string, event: string): Promise<boolean> {
    const row = await this.prisma.client.baleIntegration.findUnique({
      where: { tenantId },
      select: { isActive: true, adminConfirmed: true, chatId: true, events: true, botToken: true },
    });
    if (!row?.botToken || !row.isActive || !row.adminConfirmed || !row.chatId) return false;
    const events = (row.events as string[] | null) ?? [];
    return events.includes(event);
  }

  // ------------------------------------------------------------------ helpers

  private async discoverChats(client: BaleClient, botId: number): Promise<BaleCandidate[]> {
    const updates = await client.getUpdates().catch((error: unknown) => {
      throw DomainException.badRequest(this.friendly(error, 'دریافت پیام‌های ربات ممکن نشد'));
    });
    const chats = new Map<string, BaleChat>();
    for (const update of updates as BaleUpdate[]) {
      const chat = update.message?.chat ?? update.my_chat_member?.chat ?? update.channel_post?.chat;
      if (!chat || !isGroupChat(chat)) continue;
      chats.set(String(chat.id), chat);
    }

    const candidates: BaleCandidate[] = [];
    for (const chat of chats.values()) {
      let status: BaleCandidate['status'] = 'unknown';
      let inviteLink = chat.invite_link ?? null;
      try {
        const member = await client.getChatMember(String(chat.id), botId);
        status = member.status;
      } catch {
        status = 'unknown';
      }
      if (!inviteLink) {
        inviteLink = await client
          .getChat(String(chat.id))
          .then((full) => full.invite_link ?? null)
          .catch(() => null);
      }
      candidates.push({
        chatId: String(chat.id),
        title: chat.title ?? chat.username ?? String(chat.id),
        type: chat.type,
        status,
        isAdmin: status === 'administrator' || status === 'creator',
        inviteLink,
      });
    }
    return candidates.sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin));
  }

  private matchLink(candidates: BaleCandidate[], link: string): BaleCandidate | null {
    const slug = linkSlug(link);
    if (!slug) return null;
    return candidates.find((candidate) => candidate.inviteLink && linkSlug(candidate.inviteLink) === slug) ?? null;
  }

  /**
   * Resolves the destination group. A join link can be regenerated in Bale, so
   * when the pasted link matches nothing we fall back to the only group where
   * the bot is an admin — the common single-group case.
   */
  private pickChat(
    candidates: BaleCandidate[],
    link: string | null,
  ): { chat: BaleCandidate; matchedBy: 'link' | 'bot-membership' } | null {
    if (link) {
      const byLink = this.matchLink(candidates, link);
      if (byLink) return { chat: byLink, matchedBy: 'link' };
    }
    const adminGroups = candidates.filter((candidate) => candidate.isAdmin);
    if (adminGroups.length === 1) return { chat: adminGroups[0], matchedBy: 'bot-membership' };
    return null;
  }

  private toView(row: {
    botToken: string;
    botUsername: string | null;
    groupLink: string | null;
    chatId: string | null;
    chatTitle: string | null;
    adminConfirmed: boolean;
    isActive: boolean;
    events: unknown;
    lastTestedAt: Date | null;
    lastTestStatus: string | null;
    lastError: string | null;
  } | null) {
    const events = ((row?.events as string[] | undefined) ?? ['announcement']).filter((event) =>
      (BALE_EVENTS as readonly string[]).includes(event),
    );
    return {
      configured: Boolean(row?.botToken),
      connected: Boolean(row?.botToken && row.isActive && row.adminConfirmed && row.chatId),
      botUsername: row?.botUsername ?? null,
      botTokenMasked: maskBotToken(row?.botToken),
      groupLink: row?.groupLink ?? null,
      chatId: row?.chatId ?? null,
      chatTitle: row?.chatTitle ?? null,
      adminConfirmed: row?.adminConfirmed ?? false,
      isActive: row?.isActive ?? false,
      events,
      availableEvents: BALE_EVENTS,
      lastTestedAt: row?.lastTestedAt ?? null,
      lastTestStatus: row?.lastTestStatus ?? null,
      lastError: row?.lastError ?? null,
    };
  }

  private friendly(error: unknown, fallback: string): string {
    if (error instanceof DomainException) return error.message;
    if (!(error instanceof BaleApiError)) return `${fallback}: ${(error as Error).message}`;
    const text = error.message.toLowerCase();
    if (text.includes('unauthorized')) return 'توکن ربات نامعتبر است';
    if (text.includes('chat not found')) return 'گروه پیدا نشد؛ ابتدا ربات را به گروه اضافه کنید';
    if (text.includes('not enough rights') || text.includes('forbidden')) {
      return 'ربات اجازهٔ ارسال پیام در این گروه را ندارد؛ آن را ادمین کنید';
    }
    if (text.includes('bot was blocked')) return 'ربات توسط کاربر مسدود شده است';
    return `${fallback}: ${error.message}`;
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function formatJalali(date: Date): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tehran',
  }).format(date);
}

function linkSlug(link: string): string | null {
  const match = /\/join\/([A-Za-z0-9_-]+)/.exec(link);
  return match?.[1] ?? null;
}
