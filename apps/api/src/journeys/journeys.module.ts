import { Module } from '@nestjs/common'
import { JourneyDispatchService } from './journey-dispatch.service'
import { JourneysController } from './journeys.controller'
import { JourneysService } from './journeys.service'

@Module({
  controllers: [JourneysController],
  providers: [JourneysService, JourneyDispatchService],
  exports: [JourneysService],
})
export class JourneysModule {}
