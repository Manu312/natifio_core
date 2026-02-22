import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAvailabilityDto, CreateBulkAvailabilityDto, UpdateAvailabilityDto } from './dto/create-availability.dto';

@Injectable()
export class AvailabilityService {
    constructor(private prisma: PrismaService) { }

    async create(createAvailabilityDto: CreateAvailabilityDto) {
        // Validate time range
        this.validateTimeRange(createAvailabilityDto.startTime, createAvailabilityDto.endTime);
        
        return this.prisma.availability.create({
            data: createAvailabilityDto,
        });
    }

    async createBulk(createBulkAvailabilityDto: CreateBulkAvailabilityDto) {
        const { teacherId, slots } = createBulkAvailabilityDto;

        // Validate teacher exists
        const teacher = await this.prisma.teacher.findUnique({ where: { id: teacherId } });
        if (!teacher) {
            throw new BadRequestException('Teacher not found');
        }

        // Validate all time ranges
        for (const slot of slots) {
            this.validateTimeRange(slot.startTime, slot.endTime);
        }

        // Create all availability slots in a single batch
        await this.prisma.availability.createMany({
            data: slots.map(slot => ({
                teacherId,
                dayOfWeek: slot.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
            })),
        });

        // Fetch created slots to return (createMany doesn't return records)
        const availabilities = await this.prisma.availability.findMany({
            where: { teacherId },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
        });

        return {
            message: `Created ${slots.length} availability slots`,
            availabilities,
        };
    }

    async findByTeacher(teacherId: string) {
        return this.prisma.availability.findMany({
            where: { teacherId },
            orderBy: [
                { dayOfWeek: 'asc' },
                { startTime: 'asc' },
            ],
        });
    }

    findAll() {
        return this.prisma.availability.findMany({
            include: { teacher: true },
        });
    }

    findOne(id: string) {
        return this.prisma.availability.findUnique({
            where: { id },
        });
    }

    async update(id: string, updateAvailabilityDto: UpdateAvailabilityDto) {
        // Check if availability exists
        const availability = await this.prisma.availability.findUnique({ where: { id } });
        if (!availability) {
            throw new NotFoundException('Availability slot not found');
        }

        // Validate time range if both times are provided
        if (updateAvailabilityDto.startTime || updateAvailabilityDto.endTime) {
            const startTime = updateAvailabilityDto.startTime || availability.startTime;
            const endTime = updateAvailabilityDto.endTime || availability.endTime;
            this.validateTimeRange(startTime, endTime);
        }

        return this.prisma.availability.update({
            where: { id },
            data: updateAvailabilityDto,
        });
    }

    remove(id: string) {
        return this.prisma.availability.delete({
            where: { id },
        });
    }

    private validateTimeRange(startTime: string, endTime: string) {
        const [startHour, startMin] = startTime.split(':').map(Number);
        const [endHour, endMin] = endTime.split(':').map(Number);
        
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        if (endMinutes <= startMinutes) {
            throw new BadRequestException('End time must be after start time');
        }
    }
}
