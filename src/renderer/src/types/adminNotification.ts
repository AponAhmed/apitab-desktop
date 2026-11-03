/** An in-app message pushed from the ApiTab admin panel — broadcast to everyone or targeted at this account. */
export interface AdminNotification {
  id: string;
  title: string;
  message: string;
  url: string | null;
  createdAt: number;
}
