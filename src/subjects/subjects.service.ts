import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSubjectDto, UpdateSubjectDto } from './dto/create-subject.dto';

@Injectable()
export class SubjectsService {
    constructor(private prisma: PrismaService) { }

    create(createSubjectDto: CreateSubjectDto) {
        return this.prisma.subject.create({
            data: createSubjectDto,
        });
    }

    findAll() {
        return this.prisma.subject.findMany();
    }

    findOne(id: string) {
        return this.prisma.subject.findUnique({
            where: { id },
            include: { teachers: true },
        });
    }

    update(id: string, updateSubjectDto: UpdateSubjectDto) {
        return this.prisma.subject.update({
            where: { id },
            data: updateSubjectDto,
        });
    }

    remove(id: string) {
        return this.prisma.subject.delete({
            where: { id },
        });
    }
}
