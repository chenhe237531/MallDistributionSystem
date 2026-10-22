import { Module } from '@nestjs/common'
import { ContractsModule } from '../contracts/contracts.module'
import { ProductsController } from './products.controller'
import { ProductsService } from './products.service'

@Module({
  imports: [ContractsModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
