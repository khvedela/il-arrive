import { Module } from '@nestjs/common';
import { MembersController } from './members.controller';
import { InviteMemberService } from './invite-member.service';
import { ListMembersService } from './list-members.service';
import { UpdateMemberRoleService } from './update-member-role.service';
import { RemoveMemberService } from './remove-member.service';
import { MailModule } from '../mail/mail.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [MailModule, AuditLogModule],
  controllers: [MembersController],
  providers: [
    InviteMemberService,
    ListMembersService,
    UpdateMemberRoleService,
    RemoveMemberService,
  ],
  exports: [
    InviteMemberService,
    ListMembersService,
    UpdateMemberRoleService,
    RemoveMemberService,
  ],
})
export class MembersModule {}
