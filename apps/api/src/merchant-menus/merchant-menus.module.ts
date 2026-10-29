import { Module } from '@nestjs/common'
import { MerchantMenusController } from './merchant-menus.controller'
import { MerchantMenusService } from './merchant-menus.service'

@Module({
  controllers: [MerchantMenusController],
  providers: [MerchantMenusService],
  exports: [MerchantMenusService],
})
export class MerchantMenusModule {}
