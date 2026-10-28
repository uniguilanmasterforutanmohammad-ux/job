import { HttpException, HttpStatus } from '@nestjs/common';

export class DomainException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.BAD_REQUEST, code?: string) {
    super({ message, code }, status);
  }

  static notFound(entity: string) {
    return new DomainException(`${entity} یافت نشد`, HttpStatus.NOT_FOUND, 'NOT_FOUND');
  }

  /**
   * A 404 whose message is already a full sentence — unlike `notFound()`, no
   * «… یافت نشد» is appended (used for "state" answers such as "this mobile is
   * not a member of any business yet").
   */
  static notFoundMessage(message: string, code = 'NOT_FOUND') {
    return new DomainException(message, HttpStatus.NOT_FOUND, code);
  }

  static conflict(message: string) {
    return new DomainException(message, HttpStatus.CONFLICT, 'CONFLICT');
  }

  static forbidden(message = 'دسترسی غیرمجاز', code = 'FORBIDDEN') {
    return new DomainException(message, HttpStatus.FORBIDDEN, code);
  }

  static moduleDisabled(message = 'این ماژول برای کسب‌وکار شما فعال نیست') {
    return new DomainException(message, HttpStatus.FORBIDDEN, 'MODULE_DISABLED');
  }

  static badRequest(message: string, code = 'BAD_REQUEST') {
    return new DomainException(message, HttpStatus.BAD_REQUEST, code);
  }

  static tooManyRequests(message = 'تعداد درخواست‌ها بیش از حد مجاز است') {
    return new DomainException(message, HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED');
  }
}
