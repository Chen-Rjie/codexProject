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

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;

import static org.hamcrest.Matchers.hasSize;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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

    private static LocalDate nextWeekStart() {
        return LocalDate.now()
                .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
                .plusWeeks(1);
    }

    private long createSkill(String name, int weeklyMinutes, int sessionMinutes, int sessionsPerWeek)
            throws Exception {
        String response = mockMvc.perform(post("/api/study/skills")
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"%s",
                                  "description":"每周稳定练习",
                                  "accent":"#DBFF73",
                                  "weeklyMinutes":%d,
                                  "sessionMinutes":%d,
                                  "sessionsPerWeek":%d
                                }
                                """.formatted(name, weeklyMinutes, sessionMinutes, sessionsPerWeek)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private JsonNode generateFor(long skillId, LocalDate weekStart) throws Exception {
        String response = mockMvc.perform(post("/api/study/skills/{id}/generate-plan", skillId)
                        .with(user(OWNER))
                        .param("weekStart", weekStart.toString()))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response);
    }

    @Test
    void createsSkillGeneratesPlanAndRecordsStudy() throws Exception {
        long skillId = createSkill("英语口语", 180, 30, 3);
        LocalDate nextWeek = nextWeekStart();
        JsonNode plan = generateFor(skillId, nextWeek);
        assertEquals(3, plan.size());
        assertEquals(nextWeek.toString(), plan.get(0).get("plannedDate").asText());

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
                        .param("from", LocalDate.now().minusDays(1).toString())
                        .param("to", LocalDate.now().plusDays(1).toString()))
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

    @Test
    void reflowsMissedItemsToUpcomingDays() throws Exception {
        LocalDate today = LocalDate.now();
        long skillId = createSkill("数据分析", 120, 25, 2);

        mockMvc.perform(post("/api/study/items")
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "skillId":%d,
                                  "title":"错过的练习",
                                  "note":"",
                                  "plannedDate":"%s",
                                  "plannedMinutes":25
                                }
                                """.formatted(skillId, today.minusDays(2).toString())))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/study/items/reflow").with(user(OWNER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.movedItems").value(1));

        mockMvc.perform(get("/api/study/items")
                        .with(user(OWNER))
                        .param("from", today.toString())
                        .param("to", today.plusDays(4).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].plannedDate").value(today.toString()));
    }

    @Test
    void editingSkillKeepsPlansInOtherWeeks() throws Exception {
        long skillId = createSkill("英语口语", 180, 30, 3);
        LocalDate nextWeek = nextWeekStart();
        assertEquals(3, generateFor(skillId, nextWeek).size());

        mockMvc.perform(put("/api/study/skills/{id}", skillId)
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"英语口语",
                                  "description":"改成新的节奏",
                                  "accent":"#8EA7FF",
                                  "weeklyMinutes":150,
                                  "sessionMinutes":25,
                                  "sessionsPerWeek":5,
                                  "active":true
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/study/items")
                        .with(user(OWNER))
                        .param("from", nextWeek.toString())
                        .param("to", nextWeek.plusDays(6).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)));
    }

    @Test
    void archivingSkillKeepsFuturePlansAndStudyHistory() throws Exception {
        long skillId = createSkill("英语口语", 180, 30, 3);
        LocalDate nextWeek = nextWeekStart();
        JsonNode plan = generateFor(skillId, nextWeek);
        long itemId = plan.get(0).get("id").asLong();

        mockMvc.perform(post("/api/study/items/{id}/complete", itemId)
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"durationMinutes":30,"note":"完成一次练习"}
                                """))
                .andExpect(status().isOk());

        long otherSkillId = createSkill("产品设计", 90, 30, 3);
        generateFor(otherSkillId, nextWeek);

        mockMvc.perform(delete("/api/study/skills/{id}", skillId).with(user(OWNER)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/study/items")
                        .with(user(OWNER))
                        .param("from", nextWeek.toString())
                        .param("to", nextWeek.plusDays(6).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(6)));

        mockMvc.perform(get("/api/study/sessions")
                        .with(user(OWNER))
                        .param("from", LocalDate.now().minusDays(1).toString())
                        .param("to", LocalDate.now().plusDays(1).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));

        mockMvc.perform(get("/api/study/skills").with(user(OWNER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].archived").value(true));
    }

    @Test
    void generateWeekFillsUpToConfiguredSessions() throws Exception {
        long skillId = createSkill("英语口语", 180, 30, 3);
        LocalDate nextWeek = nextWeekStart();

        mockMvc.perform(post("/api/study/items")
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "skillId":%d,
                                  "title":"手工加的一次",
                                  "note":"",
                                  "plannedDate":"%s",
                                  "plannedMinutes":30
                                }
                                """.formatted(skillId, nextWeek.toString())))
                .andExpect(status().isCreated());

        JsonNode created = generateFor(skillId, nextWeek);
        assertEquals(2, created.size());

        mockMvc.perform(get("/api/study/items")
                        .with(user(OWNER))
                        .param("from", nextWeek.toString())
                        .param("to", nextWeek.plusDays(6).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)));
    }
}
