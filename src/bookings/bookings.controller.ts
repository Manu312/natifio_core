import { Controller, Get, Post, Body, Param, Delete, Patch, UseGuards, Request } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto, UpdateBookingDto } from './dto/create-booking.dto';
import { AdminAssignBookingDto } from './dto/admin-assign-booking.dto';
import { MonthlyBookingDto } from './dto/monthly-booking.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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
    findAll(@Request() req: any) {
        return this.bookingsService.findAll(req.user.userId, req.user.roles);
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

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Update a booking - transfer to another teacher or change time (Admin only)' })
    update(@Param('id') id: string, @Body() updateBookingDto: UpdateBookingDto) {
        return this.bookingsService.update(id, updateBookingDto);
    }

    @Patch(':id/confirm')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Confirm a booking (Admin only)' })
    confirm(@Param('id') id: string) {
        return this.bookingsService.confirm(id);
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
