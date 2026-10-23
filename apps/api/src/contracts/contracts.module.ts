import { Module } from '@nestjs/common'
import { ContractsController } from './contracts.controller'
import { ContractsService } from './contracts.service'
import { ESignService } from './esign.service'

@Module({
  controllers: [ContractsController],
  providers: [ContractsService, ESignService],
  exports: [ContractsService],
})
export class ContractsModule {}
