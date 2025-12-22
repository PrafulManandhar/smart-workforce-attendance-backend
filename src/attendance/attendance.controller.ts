import { Controller } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Attendance')
@ApiBearerAuth('access-token')
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}
}

