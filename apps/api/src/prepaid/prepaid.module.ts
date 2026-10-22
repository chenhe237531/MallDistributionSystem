import { Module } from '@nestjs/common'
import { PrepaidController } from './prepaid.controller'
import { PrepaidService } from './prepaid.service'

@Module({
  controllers: [PrepaidController],
  providers: [PrepaidService],
  exports: [PrepaidService],
})
export class PrepaidModule {}
