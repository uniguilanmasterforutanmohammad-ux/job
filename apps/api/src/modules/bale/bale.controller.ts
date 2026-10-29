import { Body, Controller, Delete, Get, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { BaleService } from './bale.service.js';
import {
  discoverBaleSchema,
  saveBaleSettingsSchema,
  type DiscoverBaleDto,
  type SaveBaleSettingsDto,
} from './bale.schemas.js';

@ApiTags('bale')
@Controller('bale')
@RequireModule('MSG')
export class BaleController {
  constructor(private readonly bale: BaleService) {}

  @Get('settings')
  @RequirePermissions(PERMISSIONS.MSG_READ)
  @ApiOperation({ summary: 'وضعیت اتصال به گروه بیام‌رسان بله (توکن ماسک‌شده)' })
  settings(@CurrentUser('tenantId') tenantId: string) {
    return this.bale.getSettings(tenantId);
  }

  @Put('settings')
  @RequirePermissions(PERMISSIONS.MSG_WRITE)
  @ApiOperation({ summary: 'ذخیرهٔ توکن ربات، لینک گروه و تأیید ادمین بودن' })
  save(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(saveBaleSettingsSchema)) dto: SaveBaleSettingsDto,
  ) {
    return this.bale.saveSettings(tenantId, dto);
  }

  @Post('discover')
  @RequirePermissions(PERMISSIONS.MSG_WRITE)
  @ApiOperation({ summary: 'تشخیص گروه‌هایی که ربات در آن‌هاست' })
  discover(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(discoverBaleSchema)) dto: DiscoverBaleDto,
  ) {
    return this.bale.discover(tenantId, dto);
  }

  @Post('test')
  @RequirePermissions(PERMISSIONS.MSG_WRITE)
  @ApiOperation({ summary: 'بررسی دسترسی ادمین و ارسال پیام آزمایشی' })
  test(@CurrentUser('tenantId') tenantId: string) {
    return this.bale.test(tenantId);
  }

  @Delete('settings')
  @RequirePermissions(PERMISSIONS.MSG_WRITE)
  @ApiOperation({ summary: 'قطع اتصال و حذف توکن ربات' })
  disconnect(@CurrentUser('tenantId') tenantId: string) {
    return this.bale.disconnect(tenantId);
  }
}
