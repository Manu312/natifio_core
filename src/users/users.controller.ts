import { Controller, Get, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { Role } from '../auth/dto/auth.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get()
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'List all users (Admin only)' })
    findAll() {
        return this.usersService.findAll();
    }

    @Patch(':id/roles')
    @Roles(Role.ADMIN)
    @ApiOperation({ summary: 'Update user roles (Admin only)' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                roles: {
                    type: 'array',
                    items: {
                        type: 'string',
                        enum: ['ADMIN', 'PROFESOR', 'ALUMNO'],
                    }
                }
            }
        }
    })
    updateRoles(@Param('id') id: string, @Body('roles') roles: Role[]) {
        return this.usersService.updateRoles(id, roles);
    }
}
