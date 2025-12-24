import { IsString, IsInt, Min, Max, Matches, IsArray, ValidateNested, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateAvailabilityDto {
  @ApiProperty()
  @IsString()
  teacherId: string;

  @ApiProperty({ description: '0=Sunday, 6=Saturday' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: '14:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  startTime: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  endTime: string;
}

export class UpdateAvailabilityDto {
  @ApiProperty({ required: false, description: '0=Sunday, 6=Saturday' })
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  dayOfWeek?: number;

  @ApiProperty({ required: false, example: '14:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  @IsOptional()
  startTime?: string;

  @ApiProperty({ required: false, example: '18:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  @IsOptional()
  endTime?: string;
}

export class AvailabilitySlotDto {
  @ApiProperty({ description: '0=Sunday, 6=Saturday' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: '14:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  startTime: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  endTime: string;
}

export class CreateBulkAvailabilityDto {
  @ApiProperty()
  @IsString()
  teacherId: string;

  @ApiProperty({
    type: [AvailabilitySlotDto],
    example: [
      { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 1, startTime: '15:00', endTime: '19:00' },
      { dayOfWeek: 3, startTime: '10:00', endTime: '14:00' },
    ]
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  slots: AvailabilitySlotDto[];
}
