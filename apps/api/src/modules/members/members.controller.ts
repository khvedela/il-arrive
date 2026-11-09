import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  HttpCode,
  HttpStatus,
  Request,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiCookieAuth } from '@nestjs/swagger';
import { InviteMemberService } from './invite-member.service';
import { ListMembersService } from './list-members.service';
import { UpdateMemberRoleService } from './update-member-role.service';
import { RemoveMemberService } from './remove-member.service';

interface RequestWithUser extends Request {
  user: {
    activeBusinessId: string;
    userId: string;
  };
}

@ApiTags('members')
@Controller('members')
export class MembersController {
  constructor(
    private readonly inviteMember: InviteMemberService,
    private readonly listMembers: ListMembersService,
    private readonly updateMemberRole: UpdateMemberRoleService,
    private readonly removeMember: RemoveMemberService,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'List all members of the current business' })
  @ApiCookieAuth()
  async list(@Request() req: RequestWithUser) {
    return this.listMembers.execute({
      businessId: req.user.activeBusinessId,
      actorUserId: req.user.userId,
    });
  }

  @Post('invite')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invite a member by email' })
  @ApiCookieAuth()
  async invite(@Request() req: RequestWithUser, @Body() dto: { email: string; role: 'OWNER' | 'DISPATCHER' | 'TECHNICIAN' }) {
    return this.inviteMember.execute({
      businessId: req.user.activeBusinessId,
      inviterUserId: req.user.userId,
      email: dto.email,
      role: dto.role,
    });
  }

  @Patch(':memberId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update a member\'s role' })
  @ApiCookieAuth()
  async updateRole(@Request() req: RequestWithUser, @Param('memberId') memberId: string, @Body() dto: { role: 'OWNER' | 'DISPATCHER' | 'TECHNICIAN' }) {
    return this.updateMemberRole.execute({
      businessId: req.user.activeBusinessId,
      actorUserId: req.user.userId,
      memberId,
      role: dto.role,
    });
  }

  @Delete(':memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a member' })
  @ApiCookieAuth()
  async remove(@Request() req: RequestWithUser, @Param('memberId') memberId: string) {
    await this.removeMember.execute({
      businessId: req.user.activeBusinessId,
      actorUserId: req.user.userId,
      memberId,
    });
  }
}
