import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class InviteMemberDto {
  @IsUUID()
  @IsNotEmpty()
  userId: string;
}
