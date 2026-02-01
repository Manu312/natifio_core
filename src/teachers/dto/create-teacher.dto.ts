import { IsString, IsOptional, IsInt, Min, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTeacherDto {
  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiProperty({ default: 1 })
  @IsInt()
  @Min(1)
  maxCapacity: number;

  @ApiProperty()
  @IsString()
  userId: string; // Link to User

  @ApiProperty({ 
    required: false, 
    type: [String],
    description: 'Array of subject IDs that this teacher can teach',
    example: ['uuid-1', 'uuid-2']
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  subjectIds?: string[];
}

export class UpdateTeacherDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  bio?: string;

  @ApiProperty({ required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxCapacity?: number;

  @ApiProperty({ 
    required: false, 
    type: [String],
    description: 'Array of subject IDs that this teacher can teach',
    example: ['uuid-1', 'uuid-2']
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  subjectIds?: string[];
}
