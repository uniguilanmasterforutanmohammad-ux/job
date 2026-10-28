import { HttpException, HttpStatus } from '@nestjs/common';

export class DomainException extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.BAD_REQUEST, code?: string) {
    super({ message, code }, status);
  }

  static notFound(entity: string) {
    return new DomainException(`${entity} یافت نشد`, HttpStatus.NOT_FOUND, 'NOT_FOUND');
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
