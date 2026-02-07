import { IsString, IsInt, Min, Max, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MonthlyBookingDto {
  @ApiProperty({ description: 'Student ID or User ID (will be resolved automatically)' })
  @IsString()
  studentId: string;

  @ApiProperty()
  @IsString()
  teacherId: string;

  @ApiProperty({ required: false, description: 'Optional subject ID' })
  @IsString()
  @IsOptional()
  subjectId?: string;

  @ApiProperty({ example: 2, description: 'Day of week: 0=Sunday, 1=Monday, 2=Tuesday, ..., 6=Saturday' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: '14:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  startTime: string;

  @ApiProperty({ example: '15:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  endTime: string;

  @ApiProperty({ example: 2, description: 'Month (1-12)' })
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2020)
  @Max(2030)
  year: number;
}
