import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../auth/dto/auth.dto';


@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.user.findMany({
            select: {
                id: true,
                email: true,
                roles: true,
                createdAt: true,
            },
        });
    }

    async updateRoles(id: string, roles: Role[]) {
        const user = await this.prisma.user.findUnique({ where: { id } });
        if (!user) {
            throw new NotFoundException('User not found');
        }

        return this.prisma.user.update({
            where: { id },
            data: { roles },
            select: {
                id: true,
                email: true,
                roles: true,
            },
        });
    }
}
