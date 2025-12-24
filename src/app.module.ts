import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { TeachersModule } from './teachers/teachers.module';
import { SubjectsModule } from './subjects/subjects.module';
import { AvailabilityModule } from './availability/availability.module';
import { BookingsModule } from './bookings/bookings.module';
import { PrismaModule } from './prisma/prisma.module';

import { UsersModule } from './users/users.module';

@Module({
  imports: [AuthModule, UsersModule, TeachersModule, SubjectsModule, AvailabilityModule, BookingsModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
