-- Create a trigger function that updates Property.status when Verification.status changes
CREATE OR REPLACE FUNCTION handle_verification_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When verification status becomes 'verified', set property to active
  IF NEW.status = 'verified' AND (OLD.status IS NULL OR OLD.status != 'verified') THEN
    UPDATE "Property"
    SET status = 'active', published_at = NOW()
    WHERE id = NEW.property_id;
  END IF;

  -- When verification status becomes 'rejected', revert property to pending
  IF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status != 'rejected') THEN
    UPDATE "Property"
    SET status = 'pending'
    WHERE id = NEW.property_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to the Verification table
CREATE TRIGGER trg_verification_status_change
AFTER UPDATE OF status ON "Verification"
FOR EACH ROW
EXECUTE FUNCTION handle_verification_status_change();
