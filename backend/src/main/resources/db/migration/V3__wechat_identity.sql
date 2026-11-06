ALTER TABLE app_users
    ADD COLUMN wechat_open_id VARCHAR(64) NULL,
    ADD COLUMN wechat_union_id VARCHAR(64) NULL;

CREATE UNIQUE INDEX uk_app_users_wechat_open_id ON app_users (wechat_open_id);
CREATE INDEX idx_app_users_wechat_union_id ON app_users (wechat_union_id);
