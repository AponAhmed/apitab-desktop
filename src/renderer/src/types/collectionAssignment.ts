export type AssignmentStatus = 'pending' | 'accepted' | 'declined';

/** A pending offer to add a shared collection to the current user's workspace — see the accept/decline popover. */
export interface PendingAssignment {
  id: string;
  collectionId: string;
  collectionName: string;
  requestCount: number;
  previewRequests: { name: string; method: string }[];
  teamId: string;
  teamName: string;
  assignedByName: string;
  assignedAt: number;
}

/** One assignee's status on a collection — for the "Manage access" view. */
export interface CollectionAssigneeStatus {
  userId: string;
  status: AssignmentStatus;
}
