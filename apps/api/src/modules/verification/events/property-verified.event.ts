export class PropertyVerifiedEvent {
  constructor(
    public readonly propertyId: string,
    public readonly userId: string,
    public readonly verifiedAt: Date,
  ) {}
}
