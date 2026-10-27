import { Module } from '@nestjs/common'
import { ChannelsModule } from '../channels/channels.module'
import { CommissionsModule } from '../commissions/commissions.module'
import { JourneysModule } from '../journeys/journeys.module'
import { ProductsModule } from '../products/products.module'
import { StatementsModule } from '../statements/statements.module'
import { SalesOrdersController } from './sales-orders.controller'
import { SalesOrdersService } from './sales-orders.service'

@Module({
  imports: [ProductsModule, CommissionsModule, StatementsModule, ChannelsModule, JourneysModule],
  controllers: [SalesOrdersController],
  providers: [SalesOrdersService],
  exports: [SalesOrdersService],
})
export class SalesOrdersModule {}
