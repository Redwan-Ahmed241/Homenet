export class PropertyRejectedEvent {
  constructor(
    public readonly propertyId: string,
    public readonly notes: string,
  ) {}
}
