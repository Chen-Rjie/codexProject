package com.chenrjie.flowboard.web;

import com.chenrjie.flowboard.config.DatabaseMigrationStatus;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    private final DataSource dataSource;
    private final DatabaseMigrationStatus migrationStatus;
    private final StringRedisTemplate redis;

    public HealthController(
            DataSource dataSource,
            DatabaseMigrationStatus migrationStatus,
            ObjectProvider<StringRedisTemplate> redisProvider
    ) {
        this.dataSource = dataSource;
        this.migrationStatus = migrationStatus;
        this.redis = redisProvider.getIfAvailable();
    }

    @GetMapping
    public Map<String, Object> health() {
        return Map.of(
                "status", "UP",
                "service", "flowboard-api",
                "timestamp", Instant.now()
        );
    }

    @GetMapping("/database")
    public ResponseEntity<Map<String, Object>> databaseHealth() {
        try (Connection connection = dataSource.getConnection()) {
            boolean ready = connection.isValid(3) && migrationStatus.isReady();
            return ResponseEntity.status(ready ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
                    .body(databaseBody(ready));
        } catch (SQLException exception) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(databaseBody(false));
        }
    }

    private Map<String, Object> databaseBody(boolean ready) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", ready ? "UP" : "DOWN");
        body.put("component", "mysql");
        body.put("migration", migrationStatus.getState().name());
        body.put("migrationsExecuted", migrationStatus.getMigrationsExecuted());
        body.put("migrationUpdatedAt", migrationStatus.getUpdatedAt().toString());
        body.put("timestamp", Instant.now());
        return body;
    }

    @GetMapping("/redis")
    public ResponseEntity<Map<String, Object>> redisHealth() {
        if (redis == null) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of(
                            "status", "DOWN",
                            "component", "redis",
                            "timestamp", Instant.now()
                    ));
        }
        try (RedisConnection connection = redis.getConnectionFactory().getConnection()) {
            String response = connection.ping();
            boolean valid = "PONG".equalsIgnoreCase(response);
            Map<String, Object> body = Map.of(
                    "status", valid ? "UP" : "DOWN",
                    "component", "redis",
                    "timestamp", Instant.now()
            );
            return ResponseEntity.status(valid ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE)
                    .body(body);
        } catch (RuntimeException exception) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of(
                            "status", "DOWN",
                            "component", "redis",
                            "timestamp", Instant.now()
                    ));
        }
    }
}

