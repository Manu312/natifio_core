import { IsString, IsDateString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateBookingDto {
  @ApiProperty()
  @IsString()
  teacherId: string;

  @ApiProperty()
  @IsString()
  studentId: string;

  @ApiProperty({ example: '2023-12-25T00:00:00.000Z' })
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
