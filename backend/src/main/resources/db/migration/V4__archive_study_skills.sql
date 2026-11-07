ALTER TABLE study_skills
    ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE AFTER active,
    ADD INDEX idx_study_skills_owner_archived (owner_id, archived);

ALTER TABLE study_skills DROP INDEX uk_study_skills_owner_name;

ALTER TABLE study_skills
    ADD CONSTRAINT uk_study_skills_owner_name UNIQUE (owner_id, name, archived);
