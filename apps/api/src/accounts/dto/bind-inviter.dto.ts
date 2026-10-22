import { IsString } from 'class-validator'

export class BindInviterDto {
  @IsString()
  inviterId!: string
}
