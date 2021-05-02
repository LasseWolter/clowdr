ALTER TABLE "analytics"."RoomStats" ADD COLUMN "updated_at" timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION "analytics"."set_current_timestamp_updated_at"()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "set_analytics_RoomStats_updated_at"
BEFORE UPDATE ON "analytics"."RoomStats"
FOR EACH ROW
EXECUTE PROCEDURE "analytics"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_analytics_RoomStats_updated_at" ON "analytics"."RoomStats" 
IS 'trigger to set value of column "updated_at" to current timestamp on row update';