import { Module } from '@nestjs/common'
import { BoxCodesModule } from '../box-codes/box-codes.module'
import { ContractsModule } from '../contracts/contracts.module'
import { PrepaidModule } from '../prepaid/prepaid.module'
import { ProcurementController } from './procurement.controller'
import { ProcurementService } from './procurement.service'

@Module({
  imports: [ContractsModule, PrepaidModule, BoxCodesModule],
  controllers: [ProcurementController],
  providers: [ProcurementService],
  exports: [ProcurementService],
})
export class ProcurementModule {}
