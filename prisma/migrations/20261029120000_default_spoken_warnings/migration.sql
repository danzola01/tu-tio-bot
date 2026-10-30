-- Built-in objectives ship with recorded voice clips: turn their spoken warnings on in saved schedules.
-- Custom objectives keep their setting, since they may have no clip.
UPDATE "DeadlockSchedule"
SET "objectives" = (
    SELECT json_group_array(
        CASE WHEN json_extract("item"."value", '$.id') IN ('small-camps', 'medium-camps', 'large-camps', 'bridge-buffs', 'sinners')
            THEN json_set("item"."value", '$.spoken', json('true'))
            ELSE json("item"."value")
        END
    )
    FROM (SELECT "value" FROM json_each("DeadlockSchedule"."objectives") ORDER BY "key") AS "item"
),
"revision" = "revision" + 1;
