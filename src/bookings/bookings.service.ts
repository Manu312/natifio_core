import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../auth/dto/auth.dto';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
    constructor(private prisma: PrismaService) { }

    async create(createBookingDto: CreateBookingDto) {
        const { teacherId, studentId, date, startTime, endTime } = createBookingDto;

        // 1. Check Teacher Exists
        const teacher = await this.prisma.teacher.findUnique({ where: { id: teacherId } });
        if (!teacher) throw new BadRequestException('Teacher not found');

        // 2. Validate Time Range
        this.validateTimeRange(startTime, endTime);

        // 3. Get day of week from date
        const bookingDate = new Date(date);
        const dayOfWeek = bookingDate.getDay(); // 0=Sunday, 6=Saturday

        // 4. Check if booking is within available time slots
        const availableSlots = await this.prisma.availability.findMany({
            where: {
                teacherId,
                dayOfWeek,
            },
        });

        if (availableSlots.length === 0) {
            throw new BadRequestException(
                `Teacher is not available on ${this.getDayName(dayOfWeek)}s`
            );
        }

        const isWithinAvailableSlot = availableSlots.some(slot => 
            this.isTimeWithinRange(startTime, endTime, slot.startTime, slot.endTime)
        );

        if (!isWithinAvailableSlot) {
            throw new BadRequestException(
                `Booking time must be within teacher's available slots. Available: ${availableSlots.map(s => `${s.startTime}-${s.endTime}`).join(', ')}`
            );
        }

        // 5. Check for overlapping bookings
        const overlappingBookings = await this.prisma.booking.findMany({
            where: {
                teacherId,
                date: bookingDate,
                status: { in: ['CONFIRMED', 'PENDING'] },
            },
        });

        const hasOverlap = overlappingBookings.some(booking => 
            this.doTimesOverlap(startTime, endTime, booking.startTime, booking.endTime)
        );

        if (hasOverlap) {
            throw new BadRequestException(
                'This time slot overlaps with an existing booking'
            );
        }

        // 6. Check Teacher Capacity for concurrent bookings
        const concurrentBookings = await this.prisma.booking.count({
            where: {
                teacherId,
                date: bookingDate,
                startTime,
                endTime,
                status: { in: ['CONFIRMED', 'PENDING'] },
            },
        });

        if (concurrentBookings >= teacher.maxCapacity) {
            throw new BadRequestException('Teacher is fully booked for this time slot');
        }

        // 7. Create Booking
        return this.prisma.booking.create({
            data: {
                ...createBookingDto,
                date: bookingDate,
            },
            include: {
                teacher: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                student: {
                    select: {
                        id: true,
                        email: true,
                    },
                },
            },
        });
    }

    async findAll(userId: string, roles: Role[]) {
        if (roles.includes(Role.ADMIN)) {
            return this.prisma.booking.findMany({
                include: { teacher: true, student: true },
                orderBy: { date: 'desc' },
            });
        }

        if (roles.includes(Role.PROFESOR)) {
            // Find teacher profile for this user
            const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
            if (!teacher) return []; // Or throw error

            return this.prisma.booking.findMany({
                where: { teacherId: teacher.id },
                include: { teacher: true, student: true },
                orderBy: { date: 'desc' },
            });
        }

        // Default: ALUMNO
        return this.prisma.booking.findMany({
            where: { studentId: userId },
            include: { teacher: true, student: true },
            orderBy: { date: 'desc' },
        });
    }

    findOne(id: string) {
        return this.prisma.booking.findUnique({
            where: { id },
            include: { teacher: true, student: true },
        });
    }

    async remove(id: string, userId: string, roles: Role[]) {
        const booking = await this.prisma.booking.findUnique({ where: { id } });
        if (!booking) throw new NotFoundException('Booking not found');

        if (roles.includes(Role.ADMIN)) {
            return this.prisma.booking.delete({ where: { id } });
        }

        if (booking.studentId !== userId) {
            throw new ForbiddenException('You can only delete your own bookings');
        }

        return this.prisma.booking.delete({ where: { id } });
    }

    // Helper Methods
    private validateTimeRange(startTime: string, endTime: string) {
        const startMinutes = this.timeToMinutes(startTime);
        const endMinutes = this.timeToMinutes(endTime);

        if (endMinutes <= startMinutes) {
            throw new BadRequestException('End time must be after start time');
        }
    }

    private isTimeWithinRange(
        bookingStart: string,
        bookingEnd: string,
        slotStart: string,
        slotEnd: string
    ): boolean {
        const bookingStartMin = this.timeToMinutes(bookingStart);
        const bookingEndMin = this.timeToMinutes(bookingEnd);
        const slotStartMin = this.timeToMinutes(slotStart);
        const slotEndMin = this.timeToMinutes(slotEnd);

        return bookingStartMin >= slotStartMin && bookingEndMin <= slotEndMin;
    }

    private doTimesOverlap(
        start1: string,
        end1: string,
        start2: string,
        end2: string
    ): boolean {
        const start1Min = this.timeToMinutes(start1);
        const end1Min = this.timeToMinutes(end1);
        const start2Min = this.timeToMinutes(start2);
        const end2Min = this.timeToMinutes(end2);

        return start1Min < end2Min && end1Min > start2Min;
    }

    private timeToMinutes(time: string): number {
        const [hour, min] = time.split(':').map(Number);
        return hour * 60 + min;
    }

    private getDayName(dayOfWeek: number): string {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[dayOfWeek];
    }
}
