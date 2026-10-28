import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator.js';
import { IndustryRegistryService } from './industry-registry.service.js';

/**
 * Public industry catalogue. Powers the industry selector on `/register`:
 * industries whose registration the platform admin has disabled are returned
 * with `isRegistrationEnabled: false` so the UI can hide/disable them (and the
 * API rejects the signup anyway — see `IndustryRegistryService`).
 */
@ApiTags('industries')
@Controller('industries')
export class IndustriesController {
  constructor(private readonly registry: IndustryRegistryService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'فهرست صنف‌ها، وضعیت ثبت‌نام و ماژول‌های پیش‌فرض هر صنف' })
  async list() {
    const rows = await this.registry.list();
    return rows.map((row) => ({
      industry: row.key,
      label: row.label,
      description: row.description,
      endUserNoun: row.endUserNoun,
      endUserNounPlural: row.endUserNounPlural,
      branchNoun: row.branchNoun,
      branchNounPlural: row.branchNounPlural,
      isRegistrationEnabled: row.isRegistrationEnabled,
      defaultModules: row.defaultModules,
    }));
  }
}
