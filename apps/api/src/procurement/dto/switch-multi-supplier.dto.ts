import { IsBoolean } from 'class-validator'

export class SwitchMultiSupplierDto {
  @IsBoolean()
  enabled!: boolean
}
