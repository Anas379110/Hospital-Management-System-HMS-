import { ApiProperty } from '@nestjs/swagger';

export class ApiErrorDetailResponseDto {
  @ApiProperty({ type: String, description: 'Machine-readable error code. Exact values depend on the operation.' })
  code!: string;

  @ApiProperty({ type: String })
  message!: string;

  @ApiProperty({ type: 'array', items: {}, description: 'Operation-specific validation strings or redacted detail objects. Empty when no details are supplied.' })
  details!: unknown[];
}

/** Current exception-filter envelope, not a new error translation layer. */
export class ApiErrorResponseDto {
  @ApiProperty({ type: ApiErrorDetailResponseDto })
  error!: ApiErrorDetailResponseDto;
}
