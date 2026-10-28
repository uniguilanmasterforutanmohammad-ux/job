import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@repo/shared';
import { z } from 'zod';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RequireModule } from '../../common/decorators/module.decorator.js';
import { RequirePermissions } from '../../common/decorators/permissions.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { InventoryExtraService } from './inventory-extra.service.js';

const sheetSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) });
type SheetDto = z.infer<typeof sheetSchema>;

@ApiTags('inventory-extra')
@Controller('inventory')
@RequireModule('INV')
export class InventoryExtraController {
  constructor(private readonly inventory: InventoryExtraService) {}

  @Get('products/:id/qr')
  @RequirePermissions(PERMISSIONS.INV_READ)
  @ApiOperation({ summary: 'تولید QR کالا (INV-07)' })
  qr(@CurrentUser('tenantId') tenantId: string, @Param('id') id: string) {
    return this.inventory.productQr(tenantId, id);
  }

  @Post('products/qr-sheet')
  @RequirePermissions(PERMISSIONS.INV_READ)
  @ApiOperation({ summary: 'برگه QR چند کالا (INV-07)' })
  sheet(
    @CurrentUser('tenantId') tenantId: string,
    @Body(new ZodValidationPipe(sheetSchema)) dto: SheetDto,
  ) {
    return this.inventory.productQrSheet(tenantId, dto.ids);
  }
}
