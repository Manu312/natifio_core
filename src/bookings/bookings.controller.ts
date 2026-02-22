import { Controller, Get, Post, Body, Param, Delete, Patch, UseGuards, Request, Query } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, UpdateBookingDto } from './dto/create-booking.dto';
import { AdminAssignBookingDto } from './dto/admin-assign-booking.dto';
import { MonthlyBookingDto } from './dto/monthly-booking.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/dto/auth.dto';

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller('bookings')
export class BookingsController {
    constructor(private readonly bookingsService: BookingsService) { }

    @Post()
    @UseGuards(JwtAuthGuard)
    create(@Body() createBookingDto: CreateBookingDto) {
        return this.bookingsService.create(createBookingDto);
    }

    @Get()
    @UseGuards(JwtAuthGuard)
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'ISO date string' })
    @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'ISO date string' })
    @ApiQuery({ name: 'teacherId', required: false, type: String })
    @ApiQuery({ name: 'status', required: false, type: String, description: 'PENDING, CONFIRMED, CANCELLED' })
    findAll(
        @Request() req: any,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('dateFrom') dateFrom?: string,
        @Query('dateTo') dateTo?: string,
        @Query('teacherId') teacherId?: string,
        @Query('status') status?: string,
    ) {
        return this.bookingsService.findAll(
            req.user.userId,
            req.user.roles,
            page ? parseInt(page, 10) : 1,
            limit ? parseInt(limit, 10) : 50,
            { dateFrom, dateTo, teacherId, status },
        );
    }

    @Get('recurring-groups')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Get all recurring groups (Admin only)' })
    getRecurringGroups() {
        return this.bookingsService.getRecurringGroups();
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    findOne(@Param('id') id: string) {
        return this.bookingsService.findOne(id);
    }

    @Patch(':id/confirm')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Confirm a booking (Admin only)' })
    confirm(@Param('id') id: string) {
        return this.bookingsService.confirm(id);
    }

    @Patch(':id/attendance')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN, Role.PROFESOR)
    @ApiOperation({ summary: 'Mark student attendance - PRESENT or ABSENT (Admin or assigned Teacher)' })
    markAttendance(
        @Param('id') id: string,
        @Body() dto: MarkAttendanceDto,
        @Request() req: any,
    ) {
        return this.bookingsService.markAttendance(id, dto.attendance, req.user.userId, req.user.roles, dto.notes);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Update a booking - transfer to another teacher or change time (Admin only)' })
    update(@Param('id') id: string, @Body() updateBookingDto: UpdateBookingDto) {
        return this.bookingsService.update(id, updateBookingDto);
    }

    @Post('admin-assign')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Admin assigns a class to a student (creates confirmed booking)' })
    adminAssign(@Body() adminAssignDto: AdminAssignBookingDto) {
        return this.bookingsService.adminAssign(adminAssignDto);
    }

    @Post('monthly')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Create monthly recurring bookings (Admin only)' })
    createMonthly(@Body() monthlyDto: MonthlyBookingDto) {
        return this.bookingsService.createMonthly(monthlyDto);
    }

    @Post('monthly/:groupId/renew')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Renew monthly recurring bookings for next month (Admin only)' })
    renewMonthly(@Param('groupId') groupId: string) {
        return this.bookingsService.renewMonthly(groupId);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    remove(@Param('id') id: string, @Request() req: any) {
        return this.bookingsService.remove(id, req.user.userId, req.user.roles);
    }
}
