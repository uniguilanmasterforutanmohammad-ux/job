import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS, type AuthenticatedUser } from '@repo/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequirePermissions, RequireSystemRoles } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { TenantsExtService } from './tenants-ext.service.js';
import {
  createBackupSchema,
  createMemberSchema,
  createRoleSchema,
  disableTwoFactorSchema,
  enableTwoFactorSchema,
  notificationPrefsSchema,
  updateMemberSchema,
  type CreateBackupDto,
  type CreateMemberDto,
  type CreateRoleDto,
  type DisableTwoFactorDto,
  type EnableTwoFactorDto,
  type NotificationPrefsDto,
  type UpdateMemberDto,
} from './dto/tenant-ext.schemas.js';

@ApiTags('core-ext')
@Controller('core')
export class TenantsExtController {
  constructor(private readonly core: TenantsExtService) {}

  @Get('notifications/preferences')
  @ApiOperation({ summary: 'تنظیمات اعلان من (CORE-08)' })
  getPrefs(@CurrentUser() user: AuthenticatedUser) {
    return this.core.getNotificationPrefs(user.tenantId, user.memberId);
  }

  @Patch('notifications/preferences')
  @ApiOperation({ summary: 'ویرایش تنظیمات اعلان (CORE-08)' })
  setPrefs(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(notificationPrefsSchema)) dto: NotificationPrefsDto,
  ) {
    return this.core.setNotificationPrefs(user.tenantId, user.memberId, dto);
  }

  @Post('2fa/challenge')
  @ApiOperation({ summary: 'ارسال کد احراز دو مرحله‌ای (CORE-01)' })
  challenge(@CurrentUser() user: AuthenticatedUser) {
    return this.core.challengeTwoFactor(user.tenantId, user.memberId);
  }

  @Post('2fa/enable')
  @ApiOperation({ summary: 'فعال‌سازی احراز دو مرحله‌ای' })
  enable2fa(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(enableTwoFactorSchema)) dto: EnableTwoFactorDto,
  ) {
    return this.core.enableTwoFactor(user.tenantId, user.memberId, dto);
  }

  @Post('2fa/disable')
  @ApiOperation({ summary: 'غیرفعال‌سازی احراز دو مرحله‌ای' })
  disable2fa(
    @CurrentUser() user: AuthenticatedUser,
    @Body(new ZodValidationPipe(disableTwoFactorSchema)) dto: DisableTwoFactorDto,
  ) {
    return this.core.disableTwoFactor(user.tenantId, user.memberId, dto);
  }

  @Post('backups')
  @RequireSystemRoles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'ایجاد پشتیبان (CORE-06)' })
  createBackup(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createBackupSchema)) dto: CreateBackupDto,
  ) {
    return this.core.createBackup(tenantId, dto);
  }

  @Get('backups')
  @RequireSystemRoles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'فهرست پشتیبان‌ها (CORE-06)' })
  listBackups(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.core.listBackups(tenantId, page ? Number(page) : 1, pageSize ? Number(pageSize) : 20);
  }

  @Post('backups/prune')
  @RequireSystemRoles('OWNER', 'MANAGER')
  @ApiOperation({ summary: 'پاکسازی پشتیبان‌های قدیمی‌تر از ۳۰ روز' })
  pruneBackups(@CurrentUser('tenantId') tenantId: string) {
    return this.core.pruneBackups(tenantId);
  }

  @Post('members')
  @RequirePermissions(PERMISSIONS.MEMBER_WRITE)
  @ApiOperation({ summary: 'افزودن کاربر (CORE-03)' })
  createMember(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createMemberSchema)) dto: CreateMemberDto,
  ) {
    return this.core.createMember(tenantId, dto);
  }

  @Get('members')
  @RequirePermissions(PERMISSIONS.MEMBER_READ)
  @ApiOperation({ summary: 'فهرست کاربران' })
  listMembers(
    @CurrentUser('tenantId') tenantId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.core.listMembers(tenantId, page ? Number(page) : 1, pageSize ? Number(pageSize) : 20);
  }

  @Patch('members/:id')
  @RequirePermissions(PERMISSIONS.MEMBER_WRITE)
  @ApiOperation({ summary: 'ویرایش کاربر' })
  updateMember(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateMemberSchema)) dto: UpdateMemberDto,
  ) {
    return this.core.updateMember(tenantId, id, dto);
  }

  @Delete('members/:id')
  @RequirePermissions(PERMISSIONS.MEMBER_WRITE)
  @ApiOperation({ summary: 'حذف کاربر' })
  removeMember(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.core.removeMember(tenantId, id);
  }

  @Post('roles')
  @RequirePermissions(PERMISSIONS.ROLE_WRITE)
  @ApiOperation({ summary: 'ساخت نقش (CORE-03)' })
  createRole(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(createRoleSchema)) dto: CreateRoleDto,
  ) {
    return this.core.createRole(tenantId, dto);
  }

  @Get('roles')
  @RequirePermissions(PERMISSIONS.ROLE_READ)
  @ApiOperation({ summary: 'فهرست نقش‌ها' })
  listRoles(@CurrentUser('tenantId') tenantId: string) {
    return this.core.listRoles(tenantId);
  }

  @Patch('roles/:id')
  @RequirePermissions(PERMISSIONS.ROLE_WRITE)
  @ApiOperation({ summary: 'ویرایش نقش' })
  updateRole(
    @CurrentUser('tenantId') tenantId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(createRoleSchema.partial())) dto: Partial<CreateRoleDto>,
  ) {
    return this.core.updateRole(tenantId, id, dto);
  }

  @Delete('roles/:id')
  @RequirePermissions(PERMISSIONS.ROLE_WRITE)
  @ApiOperation({ summary: 'حذف نقش' })
  removeRole(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.core.removeRole(tenantId, id);
  }
}
