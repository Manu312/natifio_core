import { Controller, Get, Post, Body, Param, Delete, Patch, UseGuards } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { CreateAvailabilityDto, CreateBulkAvailabilityDto, UpdateAvailabilityDto } from './dto/create-availability.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/dto/auth.dto';
import { RolesGuard } from '../auth/roles.guard';

@ApiTags('Availability')
@ApiBearerAuth()
@Controller('availability')
export class AvailabilityController {
    constructor(private readonly availabilityService: AvailabilityService) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Create single availability slot' })
    create(@Body() createAvailabilityDto: CreateAvailabilityDto) {
        return this.availabilityService.create(createAvailabilityDto);
    }

    @Post('bulk')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Create multiple availability slots for a teacher' })
    createBulk(@Body() createBulkAvailabilityDto: CreateBulkAvailabilityDto) {
        return this.availabilityService.createBulk(createBulkAvailabilityDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all availability slots' })
    findAll() {
        return this.availabilityService.findAll();
    }

    @Get('teacher/:teacherId')
    @ApiOperation({ summary: 'Get availability slots for a specific teacher' })
    findByTeacher(@Param('teacherId') teacherId: string) {
        return this.availabilityService.findByTeacher(teacherId);
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.availabilityService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Update availability slot (Admin only)' })
    update(@Param('id') id: string, @Body() updateAvailabilityDto: UpdateAvailabilityDto) {
        return this.availabilityService.update(id, updateAvailabilityDto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.ADMIN)
    remove(@Param('id') id: string) {
        return this.availabilityService.remove(id);
    }
}
