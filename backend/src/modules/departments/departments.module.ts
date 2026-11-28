import { DepartmentSetupService } from './department-setup.service';
import { DepartmentSetupController } from './department-setup.controller';
import { Module } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { DepartmentsController } from './departments.controller';

@Module({
  providers: [DepartmentsService, DepartmentSetupService],
  controllers: [DepartmentsController, DepartmentSetupController],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
