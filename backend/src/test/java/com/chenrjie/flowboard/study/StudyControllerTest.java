package com.chenrjie.flowboard.study;

import com.chenrjie.flowboard.security.AppUserPrincipal;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StudyControllerTest {

    private static final AppUserPrincipal OWNER =
            new AppUserPrincipal(11L, "learner", "not-used", "学习者");
    private static final AppUserPrincipal OTHER_USER =
            new AppUserPrincipal(12L, "other-learner", "not-used", "其他学习者");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private StudySessionRepository sessions;

    @Autowired
    private StudyItemRepository items;

    @Autowired
    private StudySkillRepository skills;

    @BeforeEach
    void clearData() {
        sessions.deleteAll();
        items.deleteAll();
        skills.deleteAll();
    }

    @Test
    void createsSkillGeneratesPlanAndRecordsStudy() throws Exception {
        String skillResponse = mockMvc.perform(post("/api/study/skills")
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"英语口语",
                                  "description":"每周稳定练习",
                                  "accent":"#DBFF73",
                                  "weeklyMinutes":180,
                                  "sessionMinutes":30,
                                  "sessionsPerWeek":3
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("英语口语"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        long skillId = objectMapper.readTree(skillResponse).get("id").asLong();

        String planResponse = mockMvc.perform(post("/api/study/skills/{id}/generate-plan", skillId)
                        .with(user(OWNER))
                        .param("weekStart", "2026-11-09"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].plannedDate").value("2026-11-09"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode plan = objectMapper.readTree(planResponse);
        long itemId = plan.get(0).get("id").asLong();

        mockMvc.perform(post("/api/study/items/{id}/complete", itemId)
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"durationMinutes":35,"note":"完成了一次跟读练习"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DONE"));

        mockMvc.perform(get("/api/study/sessions")
                        .with(user(OWNER))
                        .param("from", "2026-11-01")
                        .param("to", "2026-11-30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].durationMinutes").value(35));
    }

    @Test
    void isolatesSkillsByOwnerAndRejectsDuplicateNames() throws Exception {
        String body = """
                {
                  "name":"Java",
                  "description":"后端开发",
                  "accent":"#8EA7FF",
                  "weeklyMinutes":240,
                  "sessionMinutes":40,
                  "sessionsPerWeek":4
                }
                """;

        mockMvc.perform(post("/api/study/skills")
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/study/skills")
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isConflict());

        mockMvc.perform(get("/api/study/skills").with(user(OTHER_USER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }
}
