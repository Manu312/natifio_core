import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto, UpdateStudentDto } from './dto/create-student.dto';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class StudentsService {
    constructor(private prisma: PrismaService) { }

    async create(createStudentDto: CreateStudentDto) {
        // Validación: Debe proporcionar userId O (email + password)
        if (!createStudentDto.userId && (!createStudentDto.email || !createStudentDto.password)) {
            throw new BadRequestException(
                'Debe proporcionar userId (usuario existente) o email y password (usuario nuevo)'
            );
        }

        let userId: string;
        let userEmail: string;
        let userRoles: Role[];

        if (createStudentDto.userId) {
            // Caso 1: Usuario existente - verificar que existe
            const existingUser = await this.prisma.user.findUnique({
                where: { id: createStudentDto.userId },
            });

            if (!existingUser) {
                throw new NotFoundException(`Usuario con ID ${createStudentDto.userId} no encontrado`);
            }

            // Verificar que no tenga ya un perfil de estudiante
            const existingStudent = await this.prisma.student.findUnique({
                where: { userId: createStudentDto.userId },
            });

            if (existingStudent) {
                throw new ConflictException('Este usuario ya tiene un perfil de estudiante');
            }

            // Agregar rol ALUMNO si no lo tiene
            if (!existingUser.roles.includes(Role.ALUMNO)) {
                await this.prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        roles: [...existingUser.roles, Role.ALUMNO],
                    },
                });
                userRoles = [...existingUser.roles, Role.ALUMNO];
            } else {
                userRoles = existingUser.roles;
            }

            userId = existingUser.id;
            userEmail = existingUser.email;

            // Crear solo el perfil de Student
            const student = await this.prisma.student.create({
                data: {
                    userId: userId,
                    firstName: createStudentDto.firstName,
                    lastName: createStudentDto.lastName,
                    parentEmail: createStudentDto.parentEmail,
                    tutorFirstName: createStudentDto.tutorFirstName,
                    tutorLastName: createStudentDto.tutorLastName,
                    grade: createStudentDto.grade,
                    school: createStudentDto.school,
                },
            });

            return {
                id: student.id,
                userId: userId,
                email: userEmail,
                firstName: student.firstName,
                lastName: student.lastName,
                parentEmail: student.parentEmail,
                tutorFirstName: student.tutorFirstName,
                tutorLastName: student.tutorLastName,
                grade: student.grade,
                school: student.school,
                roles: userRoles,
                createdAt: student.createdAt,
            };
        } else {
            // Caso 2: Crear nuevo usuario + perfil de estudiante
            const email = createStudentDto.email!;
            const password = createStudentDto.password!;

            // Check if email already exists
            const existingUser = await this.prisma.user.findUnique({
                where: { email: email },
            });

            if (existingUser) {
                throw new ConflictException('Email already registered');
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create User with ALUMNO role and Student profile in a transaction
            const result = await this.prisma.$transaction(async (tx) => {
                // Create User
                const user = await tx.user.create({
                    data: {
                        email: email,
                        password: hashedPassword,
                        roles: [Role.ALUMNO],
                    },
                });

                // Create Student profile
                const student = await tx.student.create({
                    data: {
                        userId: user.id,
                        firstName: createStudentDto.firstName,
                        lastName: createStudentDto.lastName,
                        parentEmail: createStudentDto.parentEmail,
                        tutorFirstName: createStudentDto.tutorFirstName,
                        tutorLastName: createStudentDto.tutorLastName,
                        grade: createStudentDto.grade,
                        school: createStudentDto.school,
                    },
                });

                return { user, student };
            });

            // Return without password
            return {
                id: result.student.id,
                userId: result.user.id,
                email: result.user.email,
                firstName: result.student.firstName,
                lastName: result.student.lastName,
                parentEmail: result.student.parentEmail,
                tutorFirstName: result.student.tutorFirstName,
                tutorLastName: result.student.tutorLastName,
                grade: result.student.grade,
                school: result.student.school,
                roles: result.user.roles,
                createdAt: result.student.createdAt,
            };
        }
    }

    async findAll() {
        const students = await this.prisma.student.findMany({
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        roles: true,
                        createdAt: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        return students.map(student => ({
            id: student.id,
            userId: student.userId,
            email: student.user.email,
            firstName: student.firstName,
            lastName: student.lastName,
            parentEmail: student.parentEmail,
            tutorFirstName: student.tutorFirstName,
            tutorLastName: student.tutorLastName,
            grade: student.grade,
            school: student.school,
            roles: student.user.roles,
            createdAt: student.createdAt,
            updatedAt: student.updatedAt,
        }));
    }

    async findOne(id: string) {
        const student = await this.prisma.student.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        roles: true,
                        createdAt: true,
                    },
                },
                bookings: {
                    include: {
                        teacher: true,
                    },
                    orderBy: { date: 'desc' },
                },
            },
        });

        if (!student) {
            throw new NotFoundException('Student not found');
        }

        return {
            id: student.id,
            userId: student.userId,
            email: student.user.email,
            firstName: student.firstName,
            lastName: student.lastName,
            parentEmail: student.parentEmail,
            tutorFirstName: student.tutorFirstName,
            tutorLastName: student.tutorLastName,
            grade: student.grade,
            school: student.school,
            roles: student.user.roles,
            createdAt: student.createdAt,
            updatedAt: student.updatedAt,
            bookings: student.bookings,
        };
    }

    async update(id: string, updateStudentDto: UpdateStudentDto) {
        // Check if student exists
        const student = await this.prisma.student.findUnique({
            where: { id },
            include: { user: true },
        });

        if (!student) {
            throw new NotFoundException('Student not found');
        }

        // If email is being updated, check it's not already in use
        if (updateStudentDto.email && updateStudentDto.email !== student.user.email) {
            const existingUser = await this.prisma.user.findUnique({
                where: { email: updateStudentDto.email },
            });

            if (existingUser) {
                throw new ConflictException('Email already in use');
            }
        }

        // Update both User and Student in a transaction
        const result = await this.prisma.$transaction(async (tx) => {
            // Update User email if provided
            if (updateStudentDto.email) {
                await tx.user.update({
                    where: { id: student.userId },
                    data: { email: updateStudentDto.email },
                });
            }

            // Update Student profile
            const updatedStudent = await tx.student.update({
                where: { id },
                data: {
                    firstName: updateStudentDto.firstName,
                    lastName: updateStudentDto.lastName,
                    parentEmail: updateStudentDto.parentEmail,
                    tutorFirstName: updateStudentDto.tutorFirstName,
                    tutorLastName: updateStudentDto.tutorLastName,
                    grade: updateStudentDto.grade,
                    school: updateStudentDto.school,
                },
                include: {
                    user: {
                        select: {
                            email: true,
                            roles: true,
                        },
                    },
                },
            });

            return updatedStudent;
        });

        return {
            id: result.id,
            userId: result.userId,
            email: result.user.email,
            firstName: result.firstName,
            lastName: result.lastName,
            parentEmail: result.parentEmail,
            tutorFirstName: result.tutorFirstName,
            tutorLastName: result.tutorLastName,
            grade: result.grade,
            school: result.school,
            roles: result.user.roles,
            updatedAt: result.updatedAt,
        };
    }

    async remove(id: string) {
        const student = await this.prisma.student.findUnique({
            where: { id },
            include: { user: true },
        });

        if (!student) {
            throw new NotFoundException('Student not found');
        }

        // Delete in transaction (Student first, then User)
        await this.prisma.$transaction(async (tx) => {
            // Delete bookings first
            await tx.booking.deleteMany({
                where: { studentId: student.userId },
            });

            // Delete Student profile
            await tx.student.delete({
                where: { id },
            });

            // Delete User
            await tx.user.delete({
                where: { id: student.userId },
            });
        });

        return { message: 'Student deleted successfully', id };
    }
}
