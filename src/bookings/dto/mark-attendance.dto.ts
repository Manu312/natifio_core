import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
}

export class MarkAttendanceDto {
  @ApiProperty({ enum: AttendanceStatus, description: 'PRESENT or ABSENT' })
  @IsEnum(AttendanceStatus)
  attendance: AttendanceStatus;

  @ApiProperty({ required: false, description: 'Nota u observación sobre la clase', example: 'El alumno llegó 10 min tarde pero participó bien' })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string;
}
