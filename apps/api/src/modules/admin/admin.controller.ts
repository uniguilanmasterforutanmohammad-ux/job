import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator.js';
import {
  CurrentPlatform,
  RequirePlatformRoles,
} from '../../common/decorators/platform.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { MODULE_KEYS, MODULE_LABELS } from '@repo/shared';
import { PlatformAuthGuard } from './guards/platform-auth.guard.js';
import { PlatformRolesGuard } from './guards/platform-roles.guard.js';
import { TwoFactorEnforcementGuard } from './guards/two-factor-enforcement.guard.js';
import { AdminAuditService } from './admin-audit.service.js';
import { AdminTenantService } from './admin-tenant.service.js';
import { AdminModuleService } from './admin-module.service.js';
import { AdminMemberService } from './admin-member.service.js';
import { AdminPlanService } from './admin-plan.service.js';
import { AdminTeamService } from './admin-team.service.js';
import type { PlatformPrincipal } from './admin.constants.js';
import { requestContext } from './admin-auth.controller.js';
import {
  adminAssignPlanSchema,
  adminAuditQuerySchema,
  adminCreateTenantSchema,
  adminCreatePlatformMemberSchema,
  adminListMembersSchema,
  adminListTenantsSchema,
  adminMemberStatusSchema,
  adminModuleGrantSchema,
  adminModuleRevokeSchema,
  adminModuleToggleSchema,
  adminResetPasswordSchema,
  adminTenantStatusSchema,
  adminUpdateMemberSchema,
  adminUpdatePlatformMemberSchema,
  adminUpdateTenantSchema,
  adminUpsertPlanSchema,
  type AdminAssignPlanDto,
  type AdminAuditQueryDto,
  type AdminCreateTenantDto,
  type AdminCreatePlatformMemberDto,
  type AdminListMembersDto,
  type AdminListTenantsDto,
  type AdminMemberStatusDto,
  type AdminModuleGrantDto,
  type AdminModuleRevokeDto,
  type AdminModuleToggleDto,
  type AdminResetPasswordDto,
  type AdminTenantStatusDto,
  type AdminUpdateMemberDto,
  type AdminUpdatePlatformMemberDto,
  type AdminUpdateTenantDto,
  type AdminUpsertPlanDto,
} from './dto/admin.schemas.js';

/**
 * Platform administration console. Every route is decorated @Public() so the
 * tenant-facing global guards (JwtAuthGuard/PermissionsGuard) skip it, and is
 * then protected by the platform-specific guards below. Tenant context comes
 * from the URL (:tenantId), never from a token, which is what lets one operator
 * manage many businesses.
 */
@ApiTags('admin')
@Controller('admin')
@Public()
@UseGuards(PlatformAuthGuard, PlatformRolesGuard, TwoFactorEnforcementGuard)
export class AdminController {
  constructor(
    private readonly tenants: AdminTenantService,
    private readonly modules: AdminModuleService,
    private readonly members: AdminMemberService,
    private readonly plans: AdminPlanService,
    private readonly team: AdminTeamService,
    private readonly audit: AdminAuditService,
  ) {}

  // ----- dashboard -----
  @Get('stats')
  @ApiOperation({ summary: 'آمار کلی پلتفرم' })
  stats() {
    return this.tenants.stats();
  }

  // ----- module catalog -----
  @Get('modules/catalog')
  @ApiOperation({ summary: 'کاتالوگ کامل ماژول‌های پلتفرم' })
  moduleCatalog() {
    return { keys: MODULE_KEYS, labels: MODULE_LABELS, entries: this.modules.catalog() };
  }

  // ----- tenants -----
  @Get('tenants')
  @ApiOperation({ summary: 'فهرست کسب‌وکارها' })
  listTenants(@Query(new ZodValidationPipe(adminListTenantsSchema)) dto: AdminListTenantsDto) {
    return this.tenants.list(dto);
  }

  @Get('tenants/:tenantId')
  @ApiOperation({ summary: 'جزئیات کامل یک کسب‌وکار' })
  tenantDetail(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.tenants.detail(tenantId);
  }

  @Post('tenants')
  @RequirePlatformRoles('ADMIN')
  @ApiOperation({ summary: 'ایجاد کسب‌وکار جدید به‌همراه ماژول‌های انتخابی' })
  createTenant(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Body(new ZodValidationPipe(adminCreateTenantSchema)) dto: AdminCreateTenantDto,
    @Req() req: Request,
  ) {
    return this.tenants.create(actor, dto, requestContext(req));
  }

  @Patch('tenants/:tenantId')
  @RequirePlatformRoles('ADMIN')
  @ApiOperation({ summary: 'ویرایش اطلاعات کسب‌وکار' })
  updateTenant(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(adminUpdateTenantSchema)) dto: AdminUpdateTenantDto,
    @Req() req: Request,
  ) {
    return this.tenants.update(actor, tenantId, dto, requestContext(req));
  }

  @Post('tenants/:tenantId/status')
  @RequirePlatformRoles('ADMIN')
  @ApiOperation({ summary: 'تغییر وضعیت کسب‌وکار (فعال/غیرفعال/آرشیو)' })
  changeTenantStatus(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(adminTenantStatusSchema)) dto: AdminTenantStatusDto,
    @Req() req: Request,
  ) {
    return this.tenants.changeStatus(actor, tenantId, dto, requestContext(req));
  }

  @Delete('tenants/:tenantId')
  @RequirePlatformRoles('ADMIN')
  @ApiOperation({ summary: 'حذف نرم کسب‌وکار' })
  softDeleteTenant(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Req() req: Request,
  ) {
    return this.tenants.softDelete(actor, tenantId, requestContext(req));
  }

  @Post('tenants/:tenantId/restore')
  @RequirePlatformRoles('ADMIN')
  @ApiOperation({ summary: 'بازیابی کسب‌وکار حذف‌شده' })
  restoreTenant(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Req() req: Request,
  ) {
    return this.tenants.restore(actor, tenantId, requestContext(req));
  }

  @Get('tenants/:tenantId/audit')
  @ApiOperation({ summary: 'تاریخچه تغییرات یک کسب‌وکار' })
  tenantAudit(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.audit.listForTenant(
      tenantId,
      page ? Number(page) : 1,
      pageSize ? Number(pageSize) : 20,
    );
  }

  // ----- modules (grant/revoke/toggle) -----
  @Get('tenants/:tenantId/modules')
  @ApiOperation({ summary: 'وضعیت ماژول‌های یک کسب‌وکار' })
  tenantModules(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.modules.catalogForTenant(tenantId);
  }

  @Post('tenants/:tenantId/modules/grant')
  @RequirePlatformRoles('ADMIN')
  @ApiOperation({ summary: 'افزودن/فعال‌سازی ماژول‌ها برای کسب‌وکار' })
  grantModules(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(adminModuleGrantSchema)) dto: AdminModuleGrantDto,
    @Req() req: Request,
  ) {
    return this.modules.grant(actor, tenantId, dto, requestContext(req));
  }

  @Post('tenants/:tenantId/modules/revoke')
  @RequirePlatformRoles('ADMIN')
  @ApiOperation({ summary: 'غیرفعال‌سازی/حذف دسترسی ماژول از کسب‌وکار' })
  revokeModule(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(adminModuleRevokeSchema)) dto: AdminModuleRevokeDto,
    @Req() req: Request,
  ) {
    return this.modules.revoke(actor, tenantId, dto, requestContext(req));
  }

  @Post('tenants/:tenantId/modules/toggle')
  @RequirePlatformRoles('ADMIN')
  @ApiOperation({ summary: 'تغییر وضعیت یک ماژول (کلید روشن/خاموش)' })
  toggleModule(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(adminModuleToggleSchema)) dto: AdminModuleToggleDto,
    @Req() req: Request,
  ) {
    return this.modules.toggle(actor, tenantId, dto, requestContext(req));
  }

  // ----- members (business user panels) -----
  @Get('tenants/:tenantId/members')
  @ApiOperation({ summary: 'فهرست کاربران پنل یک کسب‌وکار' })
  listMembers(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Query(new ZodValidationPipe(adminListMembersSchema)) dto: AdminListMembersDto,
  ) {
    return this.members.list(tenantId, dto);
  }

  @Get('tenants/:tenantId/members/:memberId')
  @ApiOperation({ summary: 'جزئیات یک کاربر کسب‌وکار' })
  memberDetail(
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.members.getOne(tenantId, memberId);
  }

  @Patch('tenants/:tenantId/members/:memberId')
  @RequirePlatformRoles('ADMIN')
  @ApiOperation({ summary: 'ویرایش کاربر کسب‌وکار' })
  updateMember(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body(new ZodValidationPipe(adminUpdateMemberSchema)) dto: AdminUpdateMemberDto,
    @Req() req: Request,
  ) {
    return this.members.update(actor, tenantId, memberId, dto, requestContext(req));
  }

  @Post('tenants/:tenantId/members/:memberId/status')
  @RequirePlatformRoles('ADMIN')
  @ApiOperation({ summary: 'فعال/غیرفعال کردن کاربر کسب‌وکار' })
  setMemberStatus(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body(new ZodValidationPipe(adminMemberStatusSchema)) dto: AdminMemberStatusDto,
    @Req() req: Request,
  ) {
    return this.members.setActive(actor, tenantId, memberId, dto, requestContext(req));
  }

  @Post('tenants/:tenantId/members/:memberId/reset-password')
  @RequirePlatformRoles('ADMIN')
  @ApiOperation({ summary: 'بازنشانی رمز عبور کاربر کسب‌وکار' })
  resetMemberPassword(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body(new ZodValidationPipe(adminResetPasswordSchema)) dto: AdminResetPasswordDto,
    @Req() req: Request,
  ) {
    return this.members.resetPassword(actor, tenantId, memberId, dto, requestContext(req));
  }

  @Post('tenants/:tenantId/members/:memberId/revoke-sessions')
  @RequirePlatformRoles('ADMIN')
  @ApiOperation({ summary: 'بستن نشست‌های فعال کاربر کسب‌وکار' })
  revokeMemberSessions(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: Request,
  ) {
    return this.members.revokeSessions(actor, tenantId, memberId, requestContext(req));
  }

  // ----- plans & subscription -----
  @Get('plans')
  @ApiOperation({ summary: 'فهرست پلن‌های پلتفرم' })
  listPlans() {
    return this.plans.list();
  }

  @Post('plans')
  @RequirePlatformRoles('SUPER_ADMIN')
  @ApiOperation({ summary: 'ایجاد پلن جدید' })
  createPlan(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Body(new ZodValidationPipe(adminUpsertPlanSchema)) dto: AdminUpsertPlanDto,
    @Req() req: Request,
  ) {
    return this.plans.create(actor, dto, requestContext(req));
  }

  @Patch('plans/:planId')
  @RequirePlatformRoles('SUPER_ADMIN')
  @ApiOperation({ summary: 'ویرایش پلن' })
  updatePlan(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body(new ZodValidationPipe(adminUpsertPlanSchema.partial())) dto: Partial<AdminUpsertPlanDto>,
    @Req() req: Request,
  ) {
    return this.plans.update(actor, planId, dto, requestContext(req));
  }

  @Delete('plans/:planId')
  @RequirePlatformRoles('SUPER_ADMIN')
  @ApiOperation({ summary: 'غیرفعال‌سازی پلن' })
  removePlan(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Req() req: Request,
  ) {
    return this.plans.remove(actor, planId, requestContext(req));
  }

  @Post('tenants/:tenantId/subscription')
  @RequirePlatformRoles('ADMIN')
  @ApiOperation({ summary: 'تخصیص/تغییر پلن اشتراک کسب‌وکار' })
  assignPlan(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body(new ZodValidationPipe(adminAssignPlanSchema)) dto: AdminAssignPlanDto,
    @Req() req: Request,
  ) {
    return this.plans.assignToTenant(actor, tenantId, dto, requestContext(req));
  }

  // ----- platform team -----
  @Get('team')
  @RequirePlatformRoles('SUPER_ADMIN')
  @ApiOperation({ summary: 'فهرست مدیران پلتفرم' })
  listTeam(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
  ) {
    return this.team.list({
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      search,
    });
  }

  @Post('team')
  @RequirePlatformRoles('SUPER_ADMIN')
  @ApiOperation({ summary: 'ایجاد مدیر پلتفرم' })
  createTeamMember(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Body(new ZodValidationPipe(adminCreatePlatformMemberSchema))
    dto: AdminCreatePlatformMemberDto,
    @Req() req: Request,
  ) {
    return this.team.create(actor, dto, requestContext(req));
  }

  @Patch('team/:memberId')
  @RequirePlatformRoles('SUPER_ADMIN')
  @ApiOperation({ summary: 'ویرایش مدیر پلتفرم' })
  updateTeamMember(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body(new ZodValidationPipe(adminUpdatePlatformMemberSchema))
    dto: AdminUpdatePlatformMemberDto,
    @Req() req: Request,
  ) {
    return this.team.update(actor, memberId, dto, requestContext(req));
  }

  @Delete('team/:memberId')
  @RequirePlatformRoles('SUPER_ADMIN')
  @ApiOperation({ summary: 'حذف مدیر پلتفرم' })
  removeTeamMember(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: Request,
  ) {
    return this.team.remove(actor, memberId, requestContext(req));
  }

  @Post('team/:memberId/revoke-sessions')
  @RequirePlatformRoles('SUPER_ADMIN')
  @ApiOperation({ summary: 'بستن نشست‌های مدیر پلتفرم' })
  revokeTeamSessions(
    @CurrentPlatform() actor: PlatformPrincipal,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: Request,
  ) {
    return this.team.revokeSessions(actor, memberId, requestContext(req));
  }

  // ----- audit -----
  @Get('audit')
  @RequirePlatformRoles('ADMIN')
  @ApiOperation({ summary: 'گزارش کامل تغییرات پلتفرم' })
  listAudit(@Query(new ZodValidationPipe(adminAuditQuerySchema)) dto: AdminAuditQueryDto) {
    return this.audit.list(dto);
  }
}
