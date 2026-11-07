package com.chenrjie.flowboard.config;

import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.concurrent.atomic.AtomicBoolean;

@Component
@ConditionalOnProperty(
        prefix = "app.database",
        name = "async-initialization",
        havingValue = "true"
)
public class AsyncDatabaseBootstrap {

    private static final Logger log = LoggerFactory.getLogger(AsyncDatabaseBootstrap.class);
    private static final String MIGRATION_LOCK = "flowboard-flyway-migrate";
    private static final int LOCK_TIMEOUT_SECONDS = 15;
    private static final int MAX_ATTEMPTS = 3;
    private static final long RETRY_DELAY_MS = 5000L;

    private final DataSource dataSource;
    private final DatabaseMigrationStatus status;
    private final AtomicBoolean started = new AtomicBoolean(false);

    public AsyncDatabaseBootstrap(DataSource dataSource, DatabaseMigrationStatus status) {
        this.dataSource = dataSource;
        this.status = status;
        status.markRunning();
    }

    @EventListener(ApplicationReadyEvent.class)
    public void initializeInBackground() {
        if (!started.compareAndSet(false, true)) {
            log.warn("Async database initialization already started; ignoring duplicate event");
            return;
        }
        Thread.ofPlatform()
                .name("database-bootstrap")
                .daemon(true)
                .start(this::migrateWithRetry);
    }

    private void migrateWithRetry() {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            status.markRunning();
            if (runMigration()) {
                return;
            }
            if (attempt < MAX_ATTEMPTS) {
                log.warn("Async database initialization attempt {} failed; retrying in {} ms", attempt, RETRY_DELAY_MS);
                try {
                    Thread.sleep(RETRY_DELAY_MS);
                } catch (InterruptedException exception) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        status.markFailed();
        log.error("Async database initialization failed after {} attempts", MAX_ATTEMPTS);
    }

    private boolean runMigration() {
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            if (!acquireLock(statement)) {
                log.warn("Timed out waiting for database migration lock");
                return false;
            }
            try {
                int applied = Flyway.configure()
                        .dataSource(dataSource)
                        .locations("classpath:db/migration")
                        .connectRetries(10)
                        .load()
                        .migrate()
                        .migrationsExecuted;
                status.markReady(applied);
                log.info("Async database initialization completed; migrations executed: {}", applied);
                return true;
            } finally {
                releaseLock(statement);
            }
        } catch (Exception exception) {
            log.error("Async database initialization attempt failed", exception);
            return false;
        }
    }

    private boolean acquireLock(Statement statement) throws SQLException {
        try (ResultSet result = statement.executeQuery(
                "SELECT GET_LOCK('" + MIGRATION_LOCK + "', " + LOCK_TIMEOUT_SECONDS + ")")) {
            return result.next() && result.getInt(1) == 1;
        }
    }

    private void releaseLock(Statement statement) {
        try {
            statement.execute("SELECT RELEASE_LOCK('" + MIGRATION_LOCK + "')");
        } catch (SQLException exception) {
            log.warn("Failed to release database migration lock", exception);
        }
    }
}
