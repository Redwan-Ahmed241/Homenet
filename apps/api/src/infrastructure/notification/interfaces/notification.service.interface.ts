/** Which portal shows a notification: the user app, or the admin panel. */
export type NotificationAudience = 'user' | 'admin';

export interface NotificationEvent {
  type: string;
  title: string;
  message: string;
  /** Defaults to 'user'. `sendToAdmins` always forces 'admin'. */
  audience?: NotificationAudience;
  /** In-app path opened when the notification is tapped, e.g. `/property/<id>`. */
  link?: string;
  metadata?: Record<string, unknown>;
}

export interface INotificationService {
  send(userId: string, event: NotificationEvent): Promise<void>;
  /** Same notification to several users; duplicates and empty ids are ignored. */
  sendToMany(userIds: string[], event: NotificationEvent): Promise<void>;
  /** Every user who can moderate listings, resolved at the moment of the event. */
  sendToAdmins(event: NotificationEvent): Promise<void>;
}
