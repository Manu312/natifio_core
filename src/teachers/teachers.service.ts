import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeacherDto, UpdateTeacherDto } from './dto/create-teacher.dto';

@Injectable()
export class TeachersService {
    constructor(private prisma: PrismaService) { }

    async create(createTeacherDto: CreateTeacherDto) {
        const { subjectIds, ...teacherData } = createTeacherDto;

        return this.prisma.teacher.create({
            data: {
                ...teacherData,
                subjects: subjectIds?.length ? {
                    connect: subjectIds.map(id => ({ id }))
                } : undefined,
            },
            include: { subjects: true },
        });
    }

    findAll() {
        return this.prisma.teacher.findMany({
            include: { subjects: true },
        });
    }

    findOne(id: string) {
        return this.prisma.teacher.findUnique({
            where: { id },
            include: { subjects: true, availability: true },
        });
    }

    async update(id: string, updateTeacherDto: UpdateTeacherDto) {
        const { subjectIds, ...teacherData } = updateTeacherDto;

        // Check if teacher exists
        const teacher = await this.prisma.teacher.findUnique({ where: { id } });
        if (!teacher) {
            throw new NotFoundException('Teacher not found');
        }

        return this.prisma.teacher.update({
            where: { id },
            data: {
                ...teacherData,
                // Si se envían subjectIds, reemplaza todos los subjects
                subjects: subjectIds !== undefined ? {
                    set: subjectIds.map(id => ({ id }))
                } : undefined,
            },
            include: { subjects: true },
        });
    }

    remove(id: string) {
        return this.prisma.teacher.delete({
            where: { id },
        });
    }
}
