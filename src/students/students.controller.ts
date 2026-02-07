import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { StudentsService } from './students.service';
import { CreateStudentDto, UpdateStudentDto } from './dto/create-student.dto';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/dto/auth.dto';

@ApiTags('Students')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('students')
export class StudentsController {
    constructor(private readonly studentsService: StudentsService) { }

    @Post()
    @ApiOperation({ summary: 'Create a new student (Admin only)' })
    create(@Body() createStudentDto: CreateStudentDto) {
        return this.studentsService.create(createStudentDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all students (Admin only)' })
    @ApiQuery({ name: 'search', required: false, description: 'Search by name, email or tutor name' })
    findAll(@Query('search') search?: string) {
        return this.studentsService.findAll(search);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a student by ID (Admin only)' })
    findOne(@Param('id') id: string) {
        return this.studentsService.findOne(id);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update a student (Admin only)' })
    update(@Param('id') id: string, @Body() updateStudentDto: UpdateStudentDto) {
        return this.studentsService.update(id, updateStudentDto);
    }

    @Delete(':id')
    @ApiOperation({ summary: 'Delete a student (Admin only)' })
    remove(@Param('id') id: string) {
        return this.studentsService.remove(id);
    }
}
