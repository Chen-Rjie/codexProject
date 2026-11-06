CREATE TABLE study_skills (
    id BIGINT NOT NULL AUTO_INCREMENT,
    owner_id BIGINT NOT NULL,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(500) NOT NULL,
    accent VARCHAR(7) NOT NULL,
    weekly_minutes INT NOT NULL,
    session_minutes INT NOT NULL,
    sessions_per_week INT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT uk_study_skills_owner_name UNIQUE (owner_id, name),
    INDEX idx_study_skills_owner (owner_id, active),
    CONSTRAINT fk_study_skills_owner FOREIGN KEY (owner_id) REFERENCES app_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE study_items (
    id BIGINT NOT NULL AUTO_INCREMENT,
    owner_id BIGINT NOT NULL,
    skill_id BIGINT NOT NULL,
    title VARCHAR(120) NOT NULL,
    note VARCHAR(1000) NOT NULL,
    planned_date DATE NOT NULL,
    planned_minutes INT NOT NULL,
    status VARCHAR(24) NOT NULL,
    completed_at TIMESTAMP(6) NULL,
    created_at TIMESTAMP(6) NOT NULL,
    updated_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_study_items_owner_date (owner_id, planned_date),
    INDEX idx_study_items_skill_date (skill_id, planned_date),
    CONSTRAINT fk_study_items_owner FOREIGN KEY (owner_id) REFERENCES app_users (id) ON DELETE CASCADE,
    CONSTRAINT fk_study_items_skill FOREIGN KEY (skill_id) REFERENCES study_skills (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE study_sessions (
    id BIGINT NOT NULL AUTO_INCREMENT,
    owner_id BIGINT NOT NULL,
    skill_id BIGINT NOT NULL,
    item_id BIGINT NULL,
    duration_minutes INT NOT NULL,
    studied_on DATE NOT NULL,
    note VARCHAR(1000) NOT NULL,
    created_at TIMESTAMP(6) NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_study_sessions_owner_date (owner_id, studied_on),
    INDEX idx_study_sessions_skill_date (skill_id, studied_on),
    CONSTRAINT fk_study_sessions_owner FOREIGN KEY (owner_id) REFERENCES app_users (id) ON DELETE CASCADE,
    CONSTRAINT fk_study_sessions_skill FOREIGN KEY (skill_id) REFERENCES study_skills (id) ON DELETE CASCADE,
    CONSTRAINT fk_study_sessions_item FOREIGN KEY (item_id) REFERENCES study_items (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
