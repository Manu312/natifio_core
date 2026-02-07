import { IsString, IsDateString, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminAssignBookingDto {
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

  @ApiProperty({ example: '2026-02-15T00:00:00.000Z' })
  @IsDateString()
  date: string;

  @ApiProperty({ example: '14:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  startTime: string;

  @ApiProperty({ example: '15:00' })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  endTime: string;
}
