import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppRole } from '../common/enums/role.enum';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { CreateDepartmentDto } from './dtos/create-department.dto';
import { UpdateDepartmentDto } from './dtos/update-department.dto';

@ApiTags('Company Departments')
@ApiBearerAuth('access-token')
@Controller('company/departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentsController {
  constructor(private departmentsService: DepartmentsService) {}

  @Post()
  @Roles(AppRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Create a new department' })
  @ApiBody({ type: CreateDepartmentDto })
  @ApiResponse({ status: 201, description: 'Department created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 409, description: 'Department name already exists for this company' })
  create(
    @CurrentUser() user: { companyId: string },
    @Body() createDepartmentDto: CreateDepartmentDto,
  ) {
    return this.departmentsService.create(user.companyId, createDepartmentDto);
  }

  @Get()
  @Roles(AppRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'List all departments for the current company' })
  @ApiResponse({
    status: 200,
    description: 'List of departments retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', example: 'clx123abc456' },
              name: { type: 'string', example: 'Kitchen' },
              description: { type: 'string', nullable: true, example: 'Kitchen operations' },
              status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'], example: 'ACTIVE' },
              createdAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' },
              updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' },
            },
          },
        },
      },
    },
  })
  findAll(@CurrentUser() user: { companyId: string }) {
    return this.departmentsService.findAll(user.companyId);
  }

  @Put(':id')
  @Roles(AppRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Update a department' })
  @ApiParam({ name: 'id', description: 'Department ID' })
  @ApiBody({ type: UpdateDepartmentDto })
  @ApiResponse({ status: 200, description: 'Department updated successfully' })
  @ApiResponse({ status: 404, description: 'Department not found or not owned by company' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 409, description: 'Department name already exists for this company' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: { companyId: string },
    @Body() updateDepartmentDto: UpdateDepartmentDto,
  ) {
    return this.departmentsService.update(id, user.companyId, updateDepartmentDto);
  }

  @Delete(':id')
  @Roles(AppRole.COMPANY_ADMIN)
  @ApiOperation({ summary: 'Delete a department' })
  @ApiParam({ name: 'id', description: 'Department ID' })
  @ApiResponse({ status: 200, description: 'Department deleted successfully' })
  @ApiResponse({ status: 404, description: 'Department not found or not owned by company' })
  @ApiResponse({
    status: 400,
    description: 'Department has shifts assigned. Reassign shifts first.',
  })
  remove(@Param('id') id: string, @CurrentUser() user: { companyId: string }) {
    return this.departmentsService.remove(id, user.companyId);
  }
}
