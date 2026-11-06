package com.chenrjie.flowboard.web;

import com.chenrjie.flowboard.config.DatabaseMigrationStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class HealthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private DatabaseMigrationStatus migrationStatus;

    @AfterEach
    void resetStatus() {
        migrationStatus.markReady(0);
    }

    @Test
    void reportsUpWhenConnectionAndMigrationAreReady() throws Exception {
        migrationStatus.markReady(3);

        mockMvc.perform(get("/api/health/database"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.migration").value("READY"))
                .andExpect(jsonPath("$.migrationsExecuted").value(3));
    }

    @Test
    void reportsDownWhileMigrationIsRunning() throws Exception {
        migrationStatus.markRunning();

        mockMvc.perform(get("/api/health/database"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.migration").value("RUNNING"));
    }

    @Test
    void reportsDownWhenMigrationFailed() throws Exception {
        migrationStatus.markFailed();

        mockMvc.perform(get("/api/health/database"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.migration").value("FAILED"));
    }

    @Test
    void livenessStaysUpRegardlessOfMigrationState() throws Exception {
        migrationStatus.markFailed();

        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }
}
