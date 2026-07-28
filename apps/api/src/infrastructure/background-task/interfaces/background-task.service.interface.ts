export interface IBackgroundTaskService {
  enqueueVerification(propertyId: string): Promise<void>;
}
