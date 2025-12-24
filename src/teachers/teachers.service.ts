import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeacherDto, UpdateTeacherDto } from './dto/create-teacher.dto';

@Injectable()
export class TeachersService {
    constructor(private prisma: PrismaService) { }

    create(createTeacherDto: CreateTeacherDto) {
        return this.prisma.teacher.create({
            data: createTeacherDto,
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

    update(id: string, updateTeacherDto: UpdateTeacherDto) {
        return this.prisma.teacher.update({
            where: { id },
            data: updateTeacherDto,
        });
    }

    remove(id: string) {
        return this.prisma.teacher.delete({
            where: { id },
        });
    }
}
