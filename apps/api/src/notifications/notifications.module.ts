import { Global, Module } from '@nestjs/common'
import {
  NotificationsController,
  ReportSharesController,
} from './notifications.controller'
import { NotificationsService } from './notifications.service'

@Global()
@Module({
  controllers: [NotificationsController, ReportSharesController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
