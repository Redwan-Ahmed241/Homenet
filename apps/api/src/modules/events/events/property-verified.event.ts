export class PropertyVerifiedEvent {
  constructor(
    public readonly propertyId: string,
    public readonly verifiedAt: Date,
  ) {}
}
