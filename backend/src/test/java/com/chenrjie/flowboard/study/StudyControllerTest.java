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
import java.time.ZoneId;
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

    private static final ZoneId APP_ZONE = ZoneId.of("Asia/Shanghai");
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

    private static LocalDate appToday() {
        return LocalDate.now(APP_ZONE);
    }

    private static LocalDate nextWeekStart() {
        return appToday().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).plusWeeks(1);
    }

    private long createSkill(String name, int weeklyMinutes, int sessionMinutes, int sessionsPerWeek)
            throws Exception {
        return createSkillWithBody("""
                {
                  "name":"%s",
                  "description":"每周稳定练习",
                  "accent":"#DBFF73",
                  "weeklyMinutes":%d,
                  "sessionMinutes":%d,
                  "sessionsPerWeek":%d
                }
                """.formatted(name, weeklyMinutes, sessionMinutes, sessionsPerWeek));
    }

    private long createSkillWithBody(String body) throws Exception {
        String response = mockMvc.perform(post("/api/study/skills")
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
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

    private long createTodayItem(long skillId, String title, String note) throws Exception {
        String response = mockMvc.perform(post("/api/study/items")
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "skillId":%d,
                                  "title":"%s",
                                  "note":"%s",
                                  "plannedDate":"%s",
                                  "plannedMinutes":30
                                }
                                """.formatted(skillId, title, note, appToday().toString())))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response).get("id").asLong();
    }

    private void complete(long itemId, int minutes) throws Exception {
        mockMvc.perform(post("/api/study/items/{id}/complete", itemId)
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"durationMinutes":%d,"note":"完成一次练习"}
                                """.formatted(minutes)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DONE"));
    }

    private String stopSchedulingBody(String name) {
        return """
                {
                  "name":"%s",
                  "description":"每周稳定练习",
                  "accent":"#DBFF73",
                  "weeklyMinutes":180,
                  "sessionMinutes":30,
                  "sessionsPerWeek":3,
                  "active":false
                }
                """.formatted(name);
    }

    @Test
    void createsSkillGeneratesPlanAndRecordsStudy() throws Exception {
        long skillId = createSkill("英语口语", 180, 30, 3);
        LocalDate nextWeek = nextWeekStart();
        JsonNode plan = generateFor(skillId, nextWeek);
        assertEquals(3, plan.size());
        assertEquals(nextWeek.toString(), plan.get(0).get("plannedDate").asText());

        complete(createTodayItem(skillId, "今天的练习", ""), 35);

        mockMvc.perform(get("/api/study/sessions")
                        .with(user(OWNER))
                        .param("from", appToday().minusDays(1).toString())
                        .param("to", appToday().plusDays(1).toString()))
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
        LocalDate today = appToday();
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
        generateFor(skillId, nextWeek);
        complete(createTodayItem(skillId, "今天的练习", ""), 30);

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
                        .param("from", appToday().minusDays(1).toString())
                        .param("to", appToday().plusDays(1).toString()))
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

        assertEquals(2, generateFor(skillId, nextWeek).size());

        mockMvc.perform(get("/api/study/items")
                        .with(user(OWNER))
                        .param("from", nextWeek.toString())
                        .param("to", nextWeek.plusDays(6).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(3)));
    }

    @Test
    void stoppedSkillRejectsNewPlans() throws Exception {
        long skillId = createSkill("英语口语", 180, 30, 3);
        mockMvc.perform(put("/api/study/skills/{id}", skillId)
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(stopSchedulingBody("英语口语")))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/study/skills/{id}/generate-plan", skillId)
                        .with(user(OWNER))
                        .param("weekStart", nextWeekStart().toString()))
                .andExpect(status().isConflict());

        mockMvc.perform(post("/api/study/items")
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "skillId":%d,
                                  "title":"手工添加",
                                  "note":"",
                                  "plannedDate":"%s",
                                  "plannedMinutes":30
                                }
                                """.formatted(skillId, nextWeekStart().toString())))
                .andExpect(status().isConflict());
    }

    @Test
    void updateWithoutActiveKeepsStoppedState() throws Exception {
        long skillId = createSkill("英语口语", 180, 30, 3);
        mockMvc.perform(put("/api/study/skills/{id}", skillId)
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(stopSchedulingBody("英语口语")))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/study/skills/{id}", skillId)
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"英语口语",
                                  "description":"改个说明",
                                  "accent":"#8EA7FF",
                                  "weeklyMinutes":180,
                                  "sessionMinutes":30,
                                  "sessionsPerWeek":3
                                }
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/study/skills").with(user(OWNER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].active").value(false));
    }

    @Test
    void futurePlansCannotBeCompletedEarly() throws Exception {
        long skillId = createSkill("英语口语", 180, 30, 3);
        JsonNode plan = generateFor(skillId, nextWeekStart());

        mockMvc.perform(post("/api/study/items/{id}/complete", plan.get(0).get("id").asLong())
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"durationMinutes":30,"note":"提前完成"}
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void completingTwiceProducesOnlyOneSession() throws Exception {
        long skillId = createSkill("英语口语", 180, 30, 3);
        long itemId = createTodayItem(skillId, "今天的练习", "");
        complete(itemId, 30);
        complete(itemId, 30);

        mockMvc.perform(get("/api/study/sessions")
                        .with(user(OWNER))
                        .param("from", appToday().minusDays(1).toString())
                        .param("to", appToday().plusDays(1).toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void skipKeepsOriginalNoteAndCannotUndoCompletion() throws Exception {
        long skillId = createSkill("英语口语", 180, 30, 3);
        long skippedId = createTodayItem(skillId, "要跳过的练习", "第 3 章教材");

        mockMvc.perform(post("/api/study/items/{id}/skip", skippedId)
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reason":"这周先留一点空间"}
                                """))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/study/items")
                        .with(user(OWNER))
                        .param("from", appToday().toString())
                        .param("to", appToday().toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].note").value("第 3 章教材"));

        long doneId = createTodayItem(skillId, "已完成的练习", "");
        complete(doneId, 30);
        mockMvc.perform(post("/api/study/items/{id}/skip", doneId)
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reason":"误操作"}
                                """))
                .andExpect(status().isConflict());
    }

    @Test
    void archivingSameSkillNameTwiceSucceeds() throws Exception {
        long first = createSkill("英语口语", 180, 30, 3);
        mockMvc.perform(delete("/api/study/skills/{id}", first).with(user(OWNER)))
                .andExpect(status().isNoContent());

        long second = createSkillWithBody("""
                {
                  "name":"英语口语",
                  "description":"重新开始",
                  "accent":"#DBFF73",
                  "weeklyMinutes":180,
                  "sessionMinutes":30,
                  "sessionsPerWeek":3
                }
                """);
        mockMvc.perform(delete("/api/study/skills/{id}", second).with(user(OWNER)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/study/skills")
                        .with(user(OWNER))
                        .param("unused", "value"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void missingOrOversizedQueryParametersAreRejected() throws Exception {
        mockMvc.perform(get("/api/study/items").with(user(OWNER)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/study/items")
                        .with(user(OWNER))
                        .param("from", "2020-01-01")
                        .param("to", "2030-01-01"))
                .andExpect(status().isBadRequest());
    }
}
