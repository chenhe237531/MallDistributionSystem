import { IsIn } from 'class-validator'

export class SwitchProviderDto {
  @IsIn(['esignbao', 'tencent'])
  provider!: 'esignbao' | 'tencent'
}
