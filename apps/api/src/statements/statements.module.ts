import { Module } from '@nestjs/common'
import { ChannelsModule } from '../channels/channels.module'
import { StatementsController } from './statements.controller'
import { StatementsService } from './statements.service'

@Module({
  imports: [ChannelsModule],
  controllers: [StatementsController],
  providers: [StatementsService],
  exports: [StatementsService],
})
export class StatementsModule {}
