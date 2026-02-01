import { IsEmail, IsString, MinLength, IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStudentDto {
  @ApiProperty({ 
    required: false, 
    example: '550e8400-e29b-41d4-a716-446655440000', 
    description: 'ID del usuario existente (si ya existe). Si se proporciona, no se necesita email/password.' 
  })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @ApiProperty({ 
    required: false, 
    example: 'alumno@email.com', 
    description: 'Email del alumno (requerido solo si no se proporciona userId)' 
  })
  @IsEmail()
  @ValidateIf((o) => !o.userId) // Solo valida si no hay userId
  @IsOptional()
  email?: string;

  @ApiProperty({ 
    required: false, 
    example: 'password123', 
    minLength: 6, 
    description: 'Contraseña (requerida solo si no se proporciona userId)' 
  })
  @IsString()
  @MinLength(6)
  @ValidateIf((o) => !o.userId) // Solo valida si no hay userId
  @IsOptional()
  password?: string;

  @ApiProperty({ example: 'Juan', description: 'Nombre del alumno' })
  @IsString()
  firstName: string;

  @ApiProperty({ required: false, example: 'Pérez', description: 'Apellido del alumno' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ required: false, example: 'padre@email.com', description: 'Email del padre/tutor' })
  @IsEmail()
  @IsOptional()
  parentEmail?: string;

  @ApiProperty({ required: false, example: 'María', description: 'Nombre del tutor' })
  @IsString()
  @IsOptional()
  tutorFirstName?: string;

  @ApiProperty({ required: false, example: 'González', description: 'Apellido del tutor' })
  @IsString()
  @IsOptional()
  tutorLastName?: string;

  @ApiProperty({ required: false, example: '5to grado', description: 'Clase/Curso del alumno' })
  @IsString()
  @IsOptional()
  grade?: string;

  @ApiProperty({ required: false, example: 'Escuela Primaria N°5', description: 'Escuela del alumno' })
  @IsString()
  @IsOptional()
  school?: string;
}

export class UpdateStudentDto {
  @ApiProperty({ required: false, example: 'nuevo@email.com', description: 'Email del alumno (para login)' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ required: false, example: 'Juan', description: 'Nombre del alumno' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ required: false, example: 'Pérez', description: 'Apellido del alumno' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({ required: false, example: 'padre@email.com', description: 'Email del padre/tutor' })
  @IsEmail()
  @IsOptional()
  parentEmail?: string;

  @ApiProperty({ required: false, example: 'María', description: 'Nombre del tutor' })
  @IsString()
  @IsOptional()
  tutorFirstName?: string;

  @ApiProperty({ required: false, example: 'González', description: 'Apellido del tutor' })
  @IsString()
  @IsOptional()
  tutorLastName?: string;

  @ApiProperty({ required: false, example: '5to grado', description: 'Clase/Curso del alumno' })
  @IsString()
  @IsOptional()
  grade?: string;

  @ApiProperty({ required: false, example: 'Escuela Primaria N°5', description: 'Escuela del alumno' })
  @IsString()
  @IsOptional()
  school?: string;
}
