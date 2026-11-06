package com.chenrjie.flowboard.config;

import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

@Component
@ConditionalOnProperty(
        prefix = "app.database",
        name = "async-initialization",
        havingValue = "true"
)
public class AsyncDatabaseBootstrap {

    private static final Logger log = LoggerFactory.getLogger(AsyncDatabaseBootstrap.class);

    private final DataSource dataSource;

    public AsyncDatabaseBootstrap(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void initializeInBackground() {
        Thread.ofPlatform()
                .name("database-bootstrap")
                .daemon(true)
                .start(() -> {
                    try {
                        int applied = Flyway.configure()
                                .dataSource(dataSource)
                                .locations("classpath:db/migration")
                                .connectRetries(10)
                                .load()
                                .migrate()
                                .migrationsExecuted;
                        log.info("Async database initialization completed; migrations executed: {}", applied);
                    } catch (Exception exception) {
                        log.error("Async database initialization failed", exception);
                    }
                });
    }
}
