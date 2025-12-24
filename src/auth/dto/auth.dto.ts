import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum Role {
  ADMIN = 'ADMIN',
  PROFESOR = 'PROFESOR',
  ALUMNO = 'ALUMNO',
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(6)
  password: string;
}
export class AuthDto extends LoginDto {
  @ApiProperty({ enum: Role, isArray: true, required: false })
  @IsEnum(Role, { each: true })
  @IsOptional()
  roles: Role[];
}
