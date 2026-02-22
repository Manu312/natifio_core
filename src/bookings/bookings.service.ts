import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../auth/dto/auth.dto';
import { CreateBookingDto, UpdateBookingDto } from './dto/create-booking.dto';
import { AttendanceStatus } from './dto/mark-attendance.dto';

// Shared select/include shapes to avoid over-fetching
const TEACHER_SELECT = { id: true, firstName: true, lastName: true, userId: true } as const;
const STUDENT_SELECT = {
    id: true,
    firstName: true,
    lastName: true,
    userId: true,
    user: { select: { id: true, email: true } },
} as const;
const BOOKING_INCLUDE = {
    teacher: { select: TEACHER_SELECT },
    student: { select: STUDENT_SELECT },
    subject: { select: { id: true, name: true, level: true } },
} as const;

@Injectable()
export class BookingsService {
    constructor(private prisma: PrismaService) { }

    // Helper: Resolve student by studentId or userId in a single query
    private async resolveStudent(idOrUserId: string) {
        const student = await this.prisma.student.findFirst({
            where: { OR: [{ id: idOrUserId }, { userId: idOrUserId }] },
        });
        if (!student) {
            throw new BadRequestException('Student not found. Provide a valid Student ID or User ID.');
        }
        return student;
    }

    async create(createBookingDto: CreateBookingDto) {
        const { teacherId, studentId: inputStudentId, date, startTime, endTime } = createBookingDto;

        // 1. Resolve teacher and student in parallel
        const [teacher, student] = await Promise.all([
            this.prisma.teacher.findUnique({ where: { id: teacherId } }),
            this.resolveStudent(inputStudentId),
        ]);
        if (!teacher) throw new BadRequestException('Teacher not found');

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

        // 5. Check for overlapping bookings respecting teacher capacity
        const overlappingBookings = await this.prisma.booking.findMany({
            where: {
                teacherId,
                date: bookingDate,
                status: { in: ['CONFIRMED', 'PENDING'] },
            },
        });

        const overlapping = overlappingBookings.filter(booking =>
            this.doTimesOverlap(startTime, endTime, booking.startTime, booking.endTime)
        );

        // Prevent the same student from being booked twice at the same time
        const studentAlreadyBooked = overlapping.some(b => b.studentId === studentId);
        if (studentAlreadyBooked) {
            throw new BadRequestException(
                'This student already has a booking that overlaps with this time slot'
            );
        }

        // 6. Check Teacher Capacity for concurrent bookings
        if (overlapping.length >= teacher.maxCapacity) {
            throw new BadRequestException(
                `Teacher is fully booked for this time slot (${overlapping.length}/${teacher.maxCapacity})`
            );
        }

        // 7. Create Booking (usar studentId resuelto, no el del DTO)
        return this.prisma.booking.create({
            data: {
                teacherId,
                studentId,
                date: bookingDate,
                startTime,
                endTime,
            },
            include: BOOKING_INCLUDE,
        });
    }

    async findAll(
        userId: string,
        roles: Role[],
        page = 1,
        limit = 50,
        filters?: { dateFrom?: string; dateTo?: string; teacherId?: string; status?: string },
    ) {
        // Build where clause with optional filters
        const where: any = {};

        if (filters?.dateFrom || filters?.dateTo) {
            where.date = {};
            if (filters.dateFrom) where.date.gte = new Date(filters.dateFrom);
            if (filters.dateTo) where.date.lte = new Date(filters.dateTo);
        }
        if (filters?.teacherId) where.teacherId = filters.teacherId;
        if (filters?.status) where.status = filters.status;

        // Non-admin: restrict to own bookings
        if (!roles.includes(Role.ADMIN)) {
            const orConditions: any[] = [];

            // Resolve student and teacher roles in parallel
            const [student, teacher] = await Promise.all([
                roles.includes(Role.ALUMNO)
                    ? this.prisma.student.findUnique({ where: { userId } })
                    : null,
                roles.includes(Role.PROFESOR)
                    ? this.prisma.teacher.findUnique({ where: { userId } })
                    : null,
            ]);

            if (student) orConditions.push({ studentId: student.id });
            if (teacher) orConditions.push({ teacherId: teacher.id });

            if (orConditions.length === 0) return { data: [], total: 0, page, limit };

            where.OR = orConditions;
        }

        const [data, total] = await Promise.all([
            this.prisma.booking.findMany({
                where,
                include: BOOKING_INCLUDE,
                orderBy: { date: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.booking.count({ where }),
        ]);

        return { data, total, page, limit };
    }

    findOne(id: string) {
        return this.prisma.booking.findUnique({
            where: { id },
            include: BOOKING_INCLUDE,
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
            include: BOOKING_INCLUDE,
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
            include: BOOKING_INCLUDE,
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

        // 1. Resolve teacher, student, and subject in parallel
        const [teacher, student, subject] = await Promise.all([
            this.prisma.teacher.findUnique({ where: { id: teacherId } }),
            this.resolveStudent(inputStudentId),
            subjectId ? this.prisma.subject.findUnique({ where: { id: subjectId } }) : null,
        ]);
        if (!teacher) throw new BadRequestException('Teacher not found');
        if (subjectId && !subject) throw new BadRequestException('Subject not found');

        const studentId = student.id;

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

        // 7. Check for overlapping bookings respecting teacher capacity
        const overlappingBookings = await this.prisma.booking.findMany({
            where: {
                teacherId,
                date: bookingDate,
                status: { in: ['CONFIRMED', 'PENDING'] },
            },
        });

        const overlapping = overlappingBookings.filter(booking =>
            this.doTimesOverlap(startTime, endTime, booking.startTime, booking.endTime)
        );

        // Prevent the same student from being booked twice at the same time
        const studentAlreadyBooked = overlapping.some(b => b.studentId === studentId);
        if (studentAlreadyBooked) {
            throw new BadRequestException(
                'This student already has a booking that overlaps with this time slot'
            );
        }

        // 8. Check Teacher Capacity for concurrent bookings
        if (overlapping.length >= teacher.maxCapacity) {
            throw new BadRequestException(
                `Teacher is fully booked for this time slot (${overlapping.length}/${teacher.maxCapacity})`
            );
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
            include: BOOKING_INCLUDE,
        });
    }

    // Create recurring monthly bookings (OPTIMIZED: queries pulled out of loop)
    async createMonthly(monthlyDto: any) {
        const { teacherId, studentId: inputStudentId, subjectId, dayOfWeek, startTime, endTime, month, year } = monthlyDto;

        // 1. Resolve teacher, student, and subject in parallel
        const [teacher, student, subject] = await Promise.all([
            this.prisma.teacher.findUnique({ where: { id: teacherId } }),
            this.resolveStudent(inputStudentId),
            subjectId ? this.prisma.subject.findUnique({ where: { id: subjectId } }) : null,
        ]);
        if (!teacher) throw new BadRequestException('Teacher not found');
        if (subjectId && !subject) throw new BadRequestException('Subject not found');
        const studentId = student.id;

        // 2. Validate time range
        this.validateTimeRange(startTime, endTime);

        // 3. Get all dates in the month for the specified day of week
        const dates = this.getDatesForDayInMonth(dayOfWeek, month, year);
        if (dates.length === 0) {
            throw new BadRequestException(`No ${this.getDayName(dayOfWeek)}s found in ${month}/${year}`);
        }

        // 4. Fetch availability ONCE (same teacher+dayOfWeek for all dates)
        const availableSlots = await this.prisma.availability.findMany({
            where: { teacherId, dayOfWeek },
        });

        // 5. Pre-validate availability (applies to ALL dates identically)
        if (availableSlots.length === 0) {
            throw new BadRequestException(
                `Teacher is not available on ${this.getDayName(dayOfWeek)}s`,
            );
        }
        const isWithinAvailableSlot = availableSlots.some(slot =>
            this.isTimeWithinRange(startTime, endTime, slot.startTime, slot.endTime),
        );
        if (!isWithinAvailableSlot) {
            throw new BadRequestException(
                `Booking time must be within teacher's available slots. Available: ${availableSlots.map(s => `${s.startTime}-${s.endTime}`).join(', ')}`,
            );
        }

        // 6. Fetch ALL existing bookings for this teacher on these dates in ONE query
        const allExistingBookings = await this.prisma.booking.findMany({
            where: {
                teacherId,
                date: { in: dates },
                status: { in: ['CONFIRMED', 'PENDING'] },
            },
            select: { date: true, startTime: true, endTime: true, studentId: true },
        });

        // Index existing bookings by date string for O(1) lookup
        const bookingsByDate = new Map<string, typeof allExistingBookings>();
        for (const b of allExistingBookings) {
            const key = b.date.toISOString();
            if (!bookingsByDate.has(key)) bookingsByDate.set(key, []);
            bookingsByDate.get(key)!.push(b);
        }

        // 7. Create RecurringGroup
        const recurringGroup = await this.prisma.recurringGroup.create({
            data: {
                studentId, teacherId,
                subjectId: subjectId || null,
                dayOfWeek, startTime, endTime, month, year,
            },
        });

        // 8. Validate each date in-memory, then batch-create valid bookings
        const results = {
            recurringGroupId: recurringGroup.id,
            totalDates: dates.length,
            successful: [] as any[],
            failed: [] as any[],
        };

        const validDates: Date[] = [];

        for (const date of dates) {
            const dateKey = date.toISOString();
            const existingForDate = bookingsByDate.get(dateKey) || [];
            const overlapping = existingForDate.filter(b =>
                this.doTimesOverlap(startTime, endTime, b.startTime, b.endTime),
            );

            if (overlapping.some(b => b.studentId === studentId)) {
                results.failed.push({ date: dateKey, reason: 'Student already has a booking at this time' });
                continue;
            }
            if (overlapping.length >= teacher.maxCapacity) {
                results.failed.push({ date: dateKey, reason: `Teacher fully booked (${overlapping.length}/${teacher.maxCapacity})` });
                continue;
            }
            validDates.push(date);
        }

        // 9. Batch-create all valid bookings in a single transaction
        if (validDates.length > 0) {
            const createdBookings = await this.prisma.$transaction(
                validDates.map(date =>
                    this.prisma.booking.create({
                        data: {
                            teacherId, studentId,
                            subjectId: subjectId || null,
                            recurringGroupId: recurringGroup.id,
                            date, startTime, endTime,
                            status: 'CONFIRMED',
                            confirmed: true,
                        },
                        include: BOOKING_INCLUDE,
                    }),
                ),
            );
            results.successful.push(...createdBookings);
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

    // Mark student attendance (ADMIN or assigned PROFESOR)
    async markAttendance(bookingId: string, attendance: AttendanceStatus, userId: string, roles: Role[], notes?: string) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
            include: { teacher: { select: { userId: true } } },
        });
        if (!booking) throw new NotFoundException('Booking not found');

        // Permission check: ADMIN always can, PROFESOR only if assigned to this booking
        const isAdmin = roles.includes(Role.ADMIN);
        const isTeacherOfBooking = roles.includes(Role.PROFESOR) && booking.teacher.userId === userId;

        if (!isAdmin && !isTeacherOfBooking) {
            throw new ForbiddenException('Only the assigned teacher or an admin can mark attendance');
        }

        if (booking.status !== 'CONFIRMED') {
            throw new BadRequestException('Can only mark attendance on confirmed bookings');
        }

        return this.prisma.booking.update({
            where: { id: bookingId },
            data: {
                attendance,
                attendanceAt: new Date(),
                attendanceBy: userId,
                ...(notes !== undefined && { notes }),
            },
            include: BOOKING_INCLUDE,
        });
    }

    // Get all recurring groups
    async getRecurringGroups() {
        return this.prisma.recurringGroup.findMany({
            include: {
                student: { select: STUDENT_SELECT },
                teacher: { select: TEACHER_SELECT },
                subject: { select: { id: true, name: true, level: true } },
                bookings: {
                    orderBy: { date: 'asc' },
                    select: { id: true, date: true, startTime: true, endTime: true, status: true, attendance: true },
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
