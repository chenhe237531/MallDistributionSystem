import { Module } from '@nestjs/common'
import { SalesWorkbenchController } from './sales-workbench.controller'
import { SalesWorkbenchService } from './sales-workbench.service'

@Module({
  controllers: [SalesWorkbenchController],
  providers: [SalesWorkbenchService],
  exports: [SalesWorkbenchService],
})
export class SalesWorkbenchModule {}
