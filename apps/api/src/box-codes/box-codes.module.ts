import { Module } from '@nestjs/common'
import { BoxCodesController } from './box-codes.controller'
import { BoxCodesService } from './box-codes.service'

@Module({
  controllers: [BoxCodesController],
  providers: [BoxCodesService],
  exports: [BoxCodesService],
})
export class BoxCodesModule {}
