import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';
import { CrmExtController } from './crm-ext.controller.js';
import { CrmExtService } from './crm-ext.service.js';
import { CrmExtraController, PublicLeadFormController } from './crm-extra.controller.js';
import { CrmExtraService } from './crm-extra.service.js';

@Module({
  // CrmExtController first: its literal `customers/...` routes must be matched
  // before the parameterised `customers/:id` routes in CustomersController.
  controllers: [CrmExtController, CrmExtraController, CustomersController, PublicLeadFormController],
  providers: [CustomersService, CrmExtService, CrmExtraService],
  exports: [CustomersService, CrmExtService, CrmExtraService],
})
export class CrmModule {}
