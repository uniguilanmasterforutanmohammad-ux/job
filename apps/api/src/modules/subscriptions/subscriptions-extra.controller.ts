import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { SubscriptionsExtraService } from './subscriptions-extra.service.js';
import {
  addFamilyMemberSchema,
  createFamilyGroupSchema,
  type AddFamilyMemberDto,
  type CreateFamilyGroupDto,
} from './dto/subscription-extra.schemas.js';

@ApiTags('subscriptions-extra')
@Controller('subscriptions')
@RequireModule('SUB')
export class SubscriptionsExtraController {
  constructor(private readonly subscriptions: SubscriptionsExtraService) {}

  @Post('family-groups')
  @RequirePermissions(PERMISSIONS.SUB_WRITE)
  @ApiOperation({ summary: 'ساخت گروه خانوادگی (SUB-06)' })
  createGroup(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createFamilyGroupSchema)) dto: CreateFamilyGroupDto,
  ) {
    return this.subscriptions.createFamilyGroup(tenantId, dto);
  }

  @Get('family-groups')
  @RequirePermissions(PERMISSIONS.SUB_READ)
  @ApiOperation({ summary: 'فهرست گروه‌های خانوادگی' })
  listGroups(@CurrentUser('tenantId') tenantId: string) {
    return this.subscriptions.listFamilyGroups(tenantId);
  }

  @Post('family-groups/:id/members')
  @RequirePermissions(PERMISSIONS.SUB_WRITE)
  @ApiOperation({ summary: 'افزودن عضو به گروه خانوادگی' })
  addMember(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(addFamilyMemberSchema)) dto: AddFamilyMemberDto,
  ) {
    return this.subscriptions.addFamilyMember(tenantId, id, dto);
  }

  @Delete('family-groups/:id/members/:customerId')
  @RequirePermissions(PERMISSIONS.SUB_WRITE)
  @ApiOperation({ summary: 'حذف عضو از گروه خانوادگی' })
  removeMember(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Param('customerId') customerId: string,
  ) {
    return this.subscriptions.removeFamilyMember(tenantId, id, customerId);
  }

  @Patch(':id/apply-family-discount')
  @RequirePermissions(PERMISSIONS.SUB_WRITE)
  @ApiOperation({ summary: 'اعمال تخفیف خانوادگی روی اشتراک (SUB-06)' })
  applyDiscount(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.subscriptions.applyFamilyDiscount(tenantId, id);
  }
}
