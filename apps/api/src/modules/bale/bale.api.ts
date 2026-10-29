/**
 * TaskForMyAgent — ماژول بله: هم‌سان‌سازی اطلاعیه‌های سایت با گروه بیام‌رسان
 *
 * Bale (بیام‌رسان) exposes a Bot API that is wire-compatible with Telegram's
 * `bot<token>/<method>` shape, so one tiny client covers everything we need.
 */

export const BALE_TOKEN_PATTERN = /^\d{5,}:[A-Za-z0-9_-]{20,}$/;

export type BaleChat = {
  id: number | string;
  type: string;
  title?: string;
  username?: string;
  first_name?: string;
  invite_link?: string;
};

export type BaleChatMember = {
  status: 'creator' | 'administrator' | 'member' | 'restricted' | 'left' | 'kicked';
  user?: { id: number; is_bot: boolean; username?: string; first_name?: string };
  can_send_messages?: boolean;
};

export type BaleMessage = { message_id: number; chat: BaleChat; date: number; text?: string };

type BaleEnvelope<T> = { ok: boolean; result?: T; description?: string; error_code?: number };

export class BaleApiError extends Error {
  constructor(
    message: string,
    readonly errorCode?: number,
  ) {
    super(message);
    this.name = 'BaleApiError';
  }
}

/** Group-ish chats we can mirror to. */
export function isGroupChat(chat: BaleChat | undefined | null): boolean {
  return Boolean(chat && (chat.type === 'group' || chat.type === 'supergroup' || chat.type === 'channel'));
}

/** `406463380:wmR_…` → `406463380:wmR_…fU` with the secret part masked. */
export function maskBotToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const [id, secret] = token.split(':');
  if (!secret) return '***';
  return `${id}:${secret.slice(0, 3)}…${secret.slice(-2)}`;
}

export class BaleClient {
  constructor(
    private readonly token: string,
    private readonly baseUrl: string,
  ) {}

  private async call<T>(method: string, body?: Record<string, unknown>): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/bot${this.token}/${method}`, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(12_000),
        cache: 'no-store',
      });
    } catch (error) {
      throw new BaleApiError(`ارتباط با بله برقرار نشد (${(error as Error).name})`);
    }

    const text = await response.text();
    let json: BaleEnvelope<T>;
    try {
      json = JSON.parse(text) as BaleEnvelope<T>;
    } catch {
      throw new BaleApiError('پاسخ بله قابل خواندن نبود');
    }
    if (!json.ok || json.result === undefined) {
      throw new BaleApiError(json.description ?? 'درخواست به بله ناموفق بود', json.error_code);
    }
    return json.result;
  }

  getMe() {
    return this.call<{ id: number; is_bot: boolean; username?: string; first_name?: string }>('getMe');
  }

  getChat(chatId: string) {
    return this.call<BaleChat>('getChat', { chat_id: chatId });
  }

  getChatMember(chatId: string, userId: number | string) {
    return this.call<BaleChatMember>('getChatMember', { chat_id: chatId, user_id: userId });
  }

  getUpdates(offset?: number) {
    return this.call<BaleUpdate[]>('getUpdates', {
      ...(offset === undefined ? {} : { offset }),
      timeout: 0,
      limit: 100,
    });
  }

  sendMessage(chatId: string, html: string) {
    return this.call<BaleMessage>('sendMessage', {
      chat_id: chatId,
      text: html,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  }
}

export type BaleUpdate = {
  update_id: number;
  message?: { message_id: number; chat: BaleChat; new_chat_members?: { id: number; is_bot: boolean }[] };
  my_chat_member?: { chat: BaleChat; new_chat_member: BaleChatMember };
  channel_post?: { chat: BaleChat };
};
