import { Module } from '@nestjs/common'
import { BoxCodesModule } from '../box-codes/box-codes.module'
import { CommissionsModule } from '../commissions/commissions.module'
import { BoxActivationController } from './box-activation.controller'
import { SamplesController } from './samples.controller'
import { SamplesService } from './samples.service'

@Module({
  imports: [BoxCodesModule, CommissionsModule],
  controllers: [BoxActivationController, SamplesController],
  providers: [SamplesService],
  exports: [SamplesService],
})
export class SamplesModule {}
