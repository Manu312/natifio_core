import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../auth/dto/auth.dto';
import { CreateBookingDto, UpdateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
    constructor(private prisma: PrismaService) { }

    async create(createBookingDto: CreateBookingDto) {
        const { teacherId, studentId: inputStudentId, date, startTime, endTime } = createBookingDto;

        // 1. Check Teacher Exists
        const teacher = await this.prisma.teacher.findUnique({ where: { id: teacherId } });
        if (!teacher) throw new BadRequestException('Teacher not found');

        // 1.5. Resolve Student - acepta studentId O userId
        let student = await this.prisma.student.findUnique({ where: { id: inputStudentId } });
        
        // Si no encuentra por studentId, buscar por userId
        if (!student) {
            student = await this.prisma.student.findUnique({ where: { userId: inputStudentId } });
        }
        
        if (!student) {
            throw new BadRequestException('Student not found. Provide a valid Student ID or User ID.');
        }

        // Usar el studentId real (de la tabla Student)
        const studentId = student.id;

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

        // 7. Create Booking (usar studentId resuelto, no el del DTO)
        return this.prisma.booking.create({
            data: {
                teacherId,
                studentId, // Este es el ID real de Student (resuelto arriba)
                date: bookingDate,
                startTime,
                endTime,
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
                    include: { user: true }
                },
            },
        });
    }

    async findAll(userId: string, roles: Role[]) {
        // ADMIN ve todas las reservas
        if (roles.includes(Role.ADMIN)) {
            return this.prisma.booking.findMany({
                include: { 
                    teacher: true, 
                    student: {
                        include: { user: true }
                    }
                },
                orderBy: { date: 'desc' },
            });
        }

        // Construir filtro OR para múltiples roles
        const orConditions: any[] = [];

        // Si es ALUMNO, buscar su studentId a partir del userId
        if (roles.includes(Role.ALUMNO)) {
            const student = await this.prisma.student.findUnique({ where: { userId } });
            if (student) {
                orConditions.push({ studentId: student.id });
            }
        }

        // Si es PROFESOR, agregar condición para ver sus reservas como profesor
        if (roles.includes(Role.PROFESOR)) {
            const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
            if (teacher) {
                orConditions.push({ teacherId: teacher.id });
            }
        }

        // Si no hay condiciones (usuario sin rol válido), retornar vacío
        if (orConditions.length === 0) {
            return [];
        }

        return this.prisma.booking.findMany({
            where: {
                OR: orConditions,
            },
            include: { 
                teacher: true, 
                student: {
                    include: { user: true }
                }
            },
            orderBy: { date: 'desc' },
        });
    }

    findOne(id: string) {
        return this.prisma.booking.findUnique({
            where: { id },
            include: { 
                teacher: true, 
                student: {
                    include: { user: true }
                }
            },
        });
    }

    async remove(id: string, userId: string, roles: Role[]) {
        const booking = await this.prisma.booking.findUnique({ 
            where: { id },
            include: { student: true }
        });
        if (!booking) throw new NotFoundException('Booking not found');

        if (roles.includes(Role.ADMIN)) {
            return this.prisma.booking.delete({ where: { id } });
        }

        // Ahora comparamos con el userId del Student, no directamente con studentId
        if (booking.student.userId !== userId) {
            throw new ForbiddenException('You can only delete your own bookings');
        }

        return this.prisma.booking.delete({ where: { id } });
    }

    async confirm(id: string) {
        const booking = await this.prisma.booking.findUnique({ where: { id } });
        if (!booking) throw new NotFoundException('Booking not found');

        if (booking.confirmed) {
            throw new BadRequestException('Booking is already confirmed');
        }

        return this.prisma.booking.update({
            where: { id },
            data: {
                confirmed: true,
                status: 'CONFIRMED',
            },
            include: { 
                teacher: true, 
                student: { include: { user: true } }
            },
        });
    }

    async update(id: string, updateBookingDto: UpdateBookingDto) {
        // 1. Check if booking exists
        const booking = await this.prisma.booking.findUnique({ where: { id } });
        if (!booking) throw new NotFoundException('Booking not found');

        // 2. Determine final values (use existing if not provided)
        const teacherId = updateBookingDto.teacherId || booking.teacherId;
        const date = updateBookingDto.date ? new Date(updateBookingDto.date) : booking.date;
        const startTime = updateBookingDto.startTime || booking.startTime;
        const endTime = updateBookingDto.endTime || booking.endTime;

        // 3. If teacher is changing, verify new teacher exists
        if (updateBookingDto.teacherId) {
            const newTeacher = await this.prisma.teacher.findUnique({ 
                where: { id: updateBookingDto.teacherId } 
            });
            if (!newTeacher) throw new BadRequestException('New teacher not found');
        }

        // 4. Validate time range
        this.validateTimeRange(startTime, endTime);

        // 5. Get day of week from date
        const dayOfWeek = date.getDay();

        // 6. Check if booking is within available time slots of the (new) teacher
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

        // 7. Check for overlapping bookings (excluding current booking)
        const overlappingBookings = await this.prisma.booking.findMany({
            where: {
                teacherId,
                date,
                status: { in: ['CONFIRMED', 'PENDING'] },
                id: { not: id }, // Exclude current booking
            },
        });

        const hasOverlap = overlappingBookings.some(b =>
            this.doTimesOverlap(startTime, endTime, b.startTime, b.endTime)
        );

        if (hasOverlap) {
            throw new BadRequestException(
                'This time slot overlaps with an existing booking'
            );
        }

        // 8. Check teacher capacity (excluding current booking)
        const teacher = await this.prisma.teacher.findUnique({ where: { id: teacherId } });
        const concurrentBookings = await this.prisma.booking.count({
            where: {
                teacherId,
                date,
                startTime,
                endTime,
                status: { in: ['CONFIRMED', 'PENDING'] },
                id: { not: id }, // Exclude current booking
            },
        });

        if (concurrentBookings >= teacher!.maxCapacity) {
            throw new BadRequestException('Teacher is fully booked for this time slot');
        }

        // 9. Update booking
        return this.prisma.booking.update({
            where: { id },
            data: {
                teacherId,
                date,
                startTime,
                endTime,
                // Reset confirmation if teacher or time changed
                confirmed: false,
                status: 'PENDING',
            },
            include: { 
                teacher: true, 
                student: { include: { user: true } }
            },
        });
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

    // Admin-only: Create confirmed booking directly
    async adminAssign(adminAssignDto: any) {
        const { teacherId, studentId: inputStudentId, subjectId, date, startTime, endTime } = adminAssignDto;

        // 1. Check Teacher Exists
        const teacher = await this.prisma.teacher.findUnique({ where: { id: teacherId } });
        if (!teacher) throw new BadRequestException('Teacher not found');

        // 2. Resolve Student - acepta studentId O userId
        let student = await this.prisma.student.findUnique({ where: { id: inputStudentId } });
        
        if (!student) {
            student = await this.prisma.student.findUnique({ where: { userId: inputStudentId } });
        }
        
        if (!student) {
            throw new BadRequestException('Student not found. Provide a valid Student ID or User ID.');
        }

        const studentId = student.id;

        // 3. Validate Subject if provided
        if (subjectId) {
            const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
            if (!subject) throw new BadRequestException('Subject not found');
        }

        // 4. Validate Time Range
        this.validateTimeRange(startTime, endTime);

        // 5. Get day of week from date
        const bookingDate = new Date(date);
        const dayOfWeek = bookingDate.getDay();

        // 6. Check if booking is within available time slots
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

        // 7. Check for overlapping bookings
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

        // 8. Check Teacher Capacity for concurrent bookings
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

        // 9. Create Booking as CONFIRMED (Admin privilege)
        return this.prisma.booking.create({
            data: {
                teacherId,
                studentId,
                subjectId: subjectId || null,
                date: bookingDate,
                startTime,
                endTime,
                status: 'CONFIRMED',
                confirmed: true,
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
                    include: { user: true }
                },
                subject: true,
            },
        });
    }

    // Create recurring monthly bookings
    async createMonthly(monthlyDto: any) {
        const { teacherId, studentId: inputStudentId, subjectId, dayOfWeek, startTime, endTime, month, year } = monthlyDto;

        // 1. Validate inputs
        const teacher = await this.prisma.teacher.findUnique({ where: { id: teacherId } });
        if (!teacher) throw new BadRequestException('Teacher not found');

        // 2. Resolve Student
        let student = await this.prisma.student.findUnique({ where: { id: inputStudentId } });
        if (!student) {
            student = await this.prisma.student.findUnique({ where: { userId: inputStudentId } });
        }
        if (!student) {
            throw new BadRequestException('Student not found. Provide a valid Student ID or User ID.');
        }
        const studentId = student.id;

        // 3. Validate Subject if provided
        if (subjectId) {
            const subject = await this.prisma.subject.findUnique({ where: { id: subjectId } });
            if (!subject) throw new BadRequestException('Subject not found');
        }

        // 4. Validate time range
        this.validateTimeRange(startTime, endTime);

        // 5. Get all dates in the month for the specified day of week
        const dates = this.getDatesForDayInMonth(dayOfWeek, month, year);

        if (dates.length === 0) {
            throw new BadRequestException(`No ${this.getDayName(dayOfWeek)}s found in ${month}/${year}`);
        }

        // 6. Create RecurringGroup
        const recurringGroup = await this.prisma.recurringGroup.create({
            data: {
                studentId,
                teacherId,
                subjectId: subjectId || null,
                dayOfWeek,
                startTime,
                endTime,
                month,
                year,
            },
        });

        // 7. Attempt to create bookings for each date
        const results = {
            recurringGroupId: recurringGroup.id,
            totalDates: dates.length,
            successful: [] as any[],
            failed: [] as any[],
        };

        for (const date of dates) {
            try {
                // Check availability
                const availableSlots = await this.prisma.availability.findMany({
                    where: { teacherId, dayOfWeek },
                });

                if (availableSlots.length === 0) {
                    results.failed.push({
                        date: date.toISOString(),
                        reason: `Teacher not available on ${this.getDayName(dayOfWeek)}s`,
                    });
                    continue;
                }

                const isWithinAvailableSlot = availableSlots.some(slot =>
                    this.isTimeWithinRange(startTime, endTime, slot.startTime, slot.endTime)
                );

                if (!isWithinAvailableSlot) {
                    results.failed.push({
                        date: date.toISOString(),
                        reason: 'Time not within available slots',
                    });
                    continue;
                }

                // Check for overlaps
                const overlappingBookings = await this.prisma.booking.findMany({
                    where: {
                        teacherId,
                        date,
                        status: { in: ['CONFIRMED', 'PENDING'] },
                    },
                });

                const hasOverlap = overlappingBookings.some(booking =>
                    this.doTimesOverlap(startTime, endTime, booking.startTime, booking.endTime)
                );

                if (hasOverlap) {
                    results.failed.push({
                        date: date.toISOString(),
                        reason: 'Time slot overlaps with existing booking',
                    });
                    continue;
                }

                // Check capacity
                const concurrentBookings = await this.prisma.booking.count({
                    where: {
                        teacherId,
                        date,
                        startTime,
                        endTime,
                        status: { in: ['CONFIRMED', 'PENDING'] },
                    },
                });

                if (concurrentBookings >= teacher.maxCapacity) {
                    results.failed.push({
                        date: date.toISOString(),
                        reason: 'Teacher fully booked',
                    });
                    continue;
                }

                // Create booking
                const booking = await this.prisma.booking.create({
                    data: {
                        teacherId,
                        studentId,
                        subjectId: subjectId || null,
                        recurringGroupId: recurringGroup.id,
                        date,
                        startTime,
                        endTime,
                        status: 'CONFIRMED',
                        confirmed: true,
                    },
                    include: {
                        teacher: { select: { id: true, firstName: true, lastName: true } },
                        student: { include: { user: true } },
                        subject: true,
                    },
                });

                results.successful.push(booking);
            } catch (error) {
                results.failed.push({
                    date: date.toISOString(),
                    reason: error.message || 'Unknown error',
                });
            }
        }

        return results;
    }

    // Renew a recurring group for the next month
    async renewMonthly(groupId: string) {
        // 1. Get the recurring group
        const group = await this.prisma.recurringGroup.findUnique({
            where: { id: groupId },
        });

        if (!group) {
            throw new NotFoundException('Recurring group not found');
        }

        // 2. Calculate next month
        let nextMonth = group.month + 1;
        let nextYear = group.year;

        if (nextMonth > 12) {
            nextMonth = 1;
            nextYear += 1;
        }

        // 3. Create new monthly bookings with the same config but next month
        return this.createMonthly({
            studentId: group.studentId,
            teacherId: group.teacherId,
            subjectId: group.subjectId,
            dayOfWeek: group.dayOfWeek,
            startTime: group.startTime,
            endTime: group.endTime,
            month: nextMonth,
            year: nextYear,
        });
    }

    // Get all recurring groups
    async getRecurringGroups() {
        return this.prisma.recurringGroup.findMany({
            include: {
                student: {
                    include: { user: true },
                },
                teacher: {
                    select: { id: true, firstName: true, lastName: true },
                },
                subject: true,
                bookings: {
                    orderBy: { date: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // Helper: Get all dates in a month that fall on a specific day of week
    private getDatesForDayInMonth(dayOfWeek: number, month: number, year: number): Date[] {
        const dates: Date[] = [];
        const date = new Date(year, month - 1, 1); // month is 1-indexed, Date() expects 0-indexed

        // Find the first occurrence of the day in the month
        while (date.getDay() !== dayOfWeek) {
            date.setDate(date.getDate() + 1);
            if (date.getMonth() !== month - 1) {
                // Day doesn't exist in this month
                return dates;
            }
        }

        // Collect all occurrences of the day in the month
        while (date.getMonth() === month - 1) {
            dates.push(new Date(date));
            date.setDate(date.getDate() + 7);
        }

        return dates;
    }
}
