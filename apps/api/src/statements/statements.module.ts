import { Module } from '@nestjs/common'
import { ChannelsModule } from '../channels/channels.module'
import { ContractsModule } from '../contracts/contracts.module'
import { StatementsController } from './statements.controller'
import { StatementsService } from './statements.service'

@Module({
  imports: [ChannelsModule, ContractsModule],
  controllers: [StatementsController],
  providers: [StatementsService],
  exports: [StatementsService],
})
export class StatementsModule {}
