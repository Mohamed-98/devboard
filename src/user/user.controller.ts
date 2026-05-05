import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from 'generated/prisma/enums';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}
  @Patch(':id/role')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
updateRole(@Param('id') id: string, @Body('role') role: Role) {
  return this.userService.updateRole(id, role);
}
}
