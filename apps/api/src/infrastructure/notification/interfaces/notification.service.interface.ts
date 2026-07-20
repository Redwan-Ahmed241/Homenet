export interface NotificationEvent {
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface INotificationService {
  send(userId: string, event: NotificationEvent): Promise<void>;
}
