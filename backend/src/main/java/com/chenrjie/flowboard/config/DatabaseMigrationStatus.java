package com.chenrjie.flowboard.config;

import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
public class DatabaseMigrationStatus {

    public enum State {
        READY,
        RUNNING,
        FAILED
    }

    private volatile State state = State.READY;
    private volatile int migrationsExecuted;
    private volatile Instant updatedAt = Instant.now();

    public State getState() {
        return state;
    }

    public int getMigrationsExecuted() {
        return migrationsExecuted;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public boolean isReady() {
        return state == State.READY;
    }

    public void markRunning() {
        update(State.RUNNING, 0);
    }

    public void markReady(int applied) {
        update(State.READY, applied);
    }

    public void markFailed() {
        update(State.FAILED, 0);
    }

    private void update(State state, int applied) {
        this.migrationsExecuted = applied;
        this.state = state;
        this.updatedAt = Instant.now();
    }
}
