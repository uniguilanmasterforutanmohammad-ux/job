// TaskForMyAgent — ماژول بله: هم‌سان‌سازی اطلاعیه‌های سایت با گروه بیام‌رسان
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaleService } from './bale.service.js';
import { BALE_TOKEN_PATTERN, maskBotToken } from './bale.api.js';
import type { PrismaService } from '../../database/prisma.service.js';
import type { ConfigService } from '@nestjs/config';

const TOKEN = '406463380:wmR_RWKbVlhJaIA-ihwvLRrTL16MHvfo-fU';
const CHAT_ID = '4785540085';

function prismaMock() {
  const baleIntegration = {
    findUnique: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockImplementation(({ create }: { create: Record<string, unknown> }) =>
      Promise.resolve({ id: 'bale-1', ...create }),
    ),
    update: vi.fn().mockResolvedValue({}),
    deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
  };
  const client = {
    baleIntegration,
    tenant: { findUnique: vi.fn().mockResolvedValue({ name: 'باشگاه نمونه' }) },
  };
  return { prisma: { client } as unknown as PrismaService, baleIntegration };
}

type FetchCall = { method: string; body?: Record<string, unknown> };

function stubFetch(handlers: Record<string, (body?: Record<string, unknown>) => unknown>) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = String(url).split('/').pop() ?? '';
    calls.push({ method, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined });
    const handler = handlers[method];
    const payload = handler ? handler(calls[calls.length - 1]?.body) : { ok: false, description: 'Not Found' };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

describe('BaleService', () => {
  let service: BaleService;
  let baleIntegration: ReturnType<typeof prismaMock>['baleIntegration'];

  const config = { get: (key: string) => (key === 'baleApiUrl' ? 'https://tapi.test' : undefined) };

  beforeEach(() => {
    const mock = prismaMock();
    baleIntegration = mock.baleIntegration;
    service = new BaleService(mock.prisma, config as unknown as ConfigService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('validates the token shape before touching the network', async () => {
    const { fetchMock } = stubFetch({});
    await expect(service.saveSettings('t1', { botToken: 'not-a-token' })).rejects.toThrow(
      /توکن ربات معتبر نیست/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(BALE_TOKEN_PATTERN.test(TOKEN)).toBe(true);
    expect(maskBotToken(TOKEN)).toBe('406463380:wmR…fU');
  });

  it('saves the bot, confirms the admin role and masks the stored token', async () => {
    const { calls } = stubFetch({
      getMe: () => ({ ok: true, result: { id: 406463380, is_bot: true, username: 'testforsitebot' } }),
      getChat: () => ({
        ok: true,
        result: { id: Number(CHAT_ID), type: 'group', title: 'گروه تست', invite_link: 'ble.ir/join/p9n7ukhUv2' },
      }),
      getChatMember: () => ({
        ok: true,
        result: { status: 'administrator', user: { id: 406463380, is_bot: true } },
      }),
    });

    const result = await service.saveSettings('t1', {
      botToken: TOKEN,
      chatId: CHAT_ID,
      groupLink: 'ble.ir/join/FJSpSsAa1i',
    });

    expect(calls.map((call) => call.method)).toContain('getMe');
    expect(result.botUsername).toBe('testforsitebot');
    expect(result.botTokenMasked).not.toContain('wmR_RWKbVlhJaIA');
    expect(result.chatTitle).toBe('گروه تست');
    expect(result.adminConfirmed).toBe(true);
    expect(result.verification).toMatchObject({ botOk: true, isAdmin: true });
    expect(baleIntegration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tenantId: 't1' },
        create: expect.objectContaining({ tenantId: 't1', chatId: CHAT_ID, adminConfirmed: true }),
      }),
    );
  });

  it('keeps the owner claim but flags a bot that is not an admin', async () => {
    stubFetch({
      getMe: () => ({ ok: true, result: { id: 1, is_bot: true, username: 'bot' } }),
      getChat: () => ({ ok: true, result: { id: 9, type: 'group', title: 'گروه' } }),
      getChatMember: () => ({ ok: true, result: { status: 'member' } }),
    });

    const result = await service.saveSettings('t1', {
      botToken: TOKEN,
      chatId: '9',
      adminConfirmed: true,
    });

    expect(result.adminConfirmed).toBe(true);
    expect(result.verification?.isAdmin).toBe(false);
    expect(result.lastError).toContain('نه ادمین');
  });

  it('discovers groups from updates and matches the pasted join link', async () => {
    stubFetch({
      getMe: () => ({ ok: true, result: { id: 7, is_bot: true, username: 'bot' } }),
      getUpdates: () => ({
        ok: true,
        result: [
          { update_id: 1, message: { message_id: 1, chat: { id: 5, type: 'private' } } },
          {
            update_id: 2,
            message: {
              message_id: 2,
              chat: { id: Number(CHAT_ID), type: 'group', title: 'گروه تست اتصال' },
              new_chat_members: [{ id: 7, is_bot: true }],
            },
          },
        ],
      }),
      getChatMember: () => ({ ok: true, result: { status: 'administrator' } }),
      getChat: () => ({ ok: true, result: { id: Number(CHAT_ID), type: 'group', invite_link: 'ble.ir/join/FJSpSsAa1i' } }),
    });
    baleIntegration.findUnique.mockResolvedValue({ id: 'bale-1', tenantId: 't1', botToken: TOKEN, groupLink: null });

    const result = await service.discover('t1', { groupLink: 'https://ble.ir/join/FJSpSsAa1i' });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]).toMatchObject({ chatId: CHAT_ID, isAdmin: true, status: 'administrator' });
    expect(result.matchedChatId).toBe(CHAT_ID);
    expect(result.matchedBy).toBe('link');
  });

  it('falls back to the only admin group when the pasted link was regenerated', async () => {
    stubFetch({
      getMe: () => ({ ok: true, result: { id: 7, is_bot: true, username: 'bot' } }),
      getUpdates: () => ({
        ok: true,
        result: [
          { update_id: 1, message: { message_id: 1, chat: { id: Number(CHAT_ID), type: 'group', title: 'گروه' } } },
        ],
      }),
      getChatMember: () => ({ ok: true, result: { status: 'administrator' } }),
      getChat: () => ({ ok: true, result: { id: Number(CHAT_ID), type: 'group', invite_link: 'ble.ir/join/p9n7ukhUv2' } }),
    });
    baleIntegration.findUnique.mockResolvedValue({ id: 'bale-1', tenantId: 't1', botToken: TOKEN, groupLink: null });

    const result = await service.discover('t1', { groupLink: 'ble.ir/join/FJSpSsAa1i' });

    expect(result.matchedChatId).toBe(CHAT_ID);
    expect(result.matchedBy).toBe('bot-membership');
  });

  it('sends a test message and records a successful check', async () => {
    baleIntegration.findUnique.mockResolvedValue({
      id: 'bale-1',
      tenantId: 't1',
      botToken: TOKEN,
      chatId: CHAT_ID,
      chatTitle: 'گروه تست',
      adminConfirmed: true,
      isActive: true,
      events: ['announcement'],
    });
    const { calls } = stubFetch({
      getMe: () => ({ ok: true, result: { id: 406463380, is_bot: true, username: 'testforsitebot' } }),
      getChatMember: () => ({ ok: true, result: { status: 'administrator' } }),
      sendMessage: () => ({ ok: true, result: { message_id: 42, chat: { id: Number(CHAT_ID), type: 'group' }, date: 1 } }),
    });

    const result = await service.test('t1');

    expect(result).toMatchObject({ ok: true, chatId: CHAT_ID, messageId: '42' });
    const sent = calls.find((call) => call.method === 'sendMessage');
    expect(sent?.body?.text).toContain('اتصال سایت به بله برقرار است');
    expect(baleIntegration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastTestStatus: 'OK' }) }),
    );
  });

  it('skips the mirror when the event is not enabled', async () => {
    baleIntegration.findUnique.mockResolvedValue({
      botToken: TOKEN,
      isActive: true,
      adminConfirmed: true,
      chatId: CHAT_ID,
      events: ['order.created'],
    });
    const { fetchMock } = stubFetch({});

    const result = await service.mirror('t1', 'announcement', { title: 'تعطیلی', body: 'باشگاه تعطیل است' });

    expect(result).toEqual({ status: 'SKIPPED', reason: 'event_disabled' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('mirrors an announcement with escaped HTML and a Jalali date', async () => {
    baleIntegration.findUnique.mockResolvedValue({
      botToken: TOKEN,
      isActive: true,
      adminConfirmed: true,
      chatId: CHAT_ID,
      chatTitle: 'گروه',
      events: ['announcement'],
    });
    const { calls } = stubFetch({
      sendMessage: () => ({ ok: true, result: { message_id: 77, chat: { id: 1, type: 'group' }, date: 1 } }),
    });

    const result = await service.mirror('t1', 'announcement', {
      title: 'تعطیلی <باشگاه>',
      body: 'روز یکشنبه تعطیل است & کلاس‌ها جبرانی می‌شوند',
      eventDate: new Date('2026-11-02T00:00:00.000Z'),
    });

    expect(result).toEqual({ status: 'SENT', messageId: '77' });
    const sent = calls.find((call) => call.method === 'sendMessage');
    expect(sent?.body?.text).toContain('تعطیلی &lt;باشگاه&gt;');
    expect(sent?.body?.text).toContain('&amp;');
    expect(sent?.body?.text).toContain('📢');
    expect(String(sent?.body?.text)).toContain('۱۴۰۵');
    expect(String(sent?.body?.text)).toContain('آبان');
    expect(baleIntegration.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastTestStatus: 'FAILED' }) }),
    );
  });

  it('records a failure instead of throwing when Bale rejects the message', async () => {
    baleIntegration.findUnique.mockResolvedValue({
      botToken: TOKEN,
      isActive: true,
      adminConfirmed: true,
      chatId: CHAT_ID,
      events: ['announcement'],
    });
    stubFetch({
      sendMessage: () => ({ ok: false, error_code: 403, description: 'Forbidden: bot is not a member' }),
    });

    const result = await service.mirror('t1', 'announcement', { title: 'ت', body: 'متن' });

    expect(result.status).toBe('FAILED');
    expect(baleIntegration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ lastTestStatus: 'FAILED' }) }),
    );
  });
});
