export type TeamRole = 'owner' | 'admin' | 'member';

export interface Team {
  id: string;
  name: string;
  ownerId: string;
  role: TeamRole;
  createdAt?: number;
  updatedAt?: number;
}

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  role: TeamRole;
  joinedAt: number;
}
