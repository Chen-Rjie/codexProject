package com.chenrjie.flowboard.task;

import com.chenrjie.flowboard.security.AppUserPrincipal;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TaskControllerTest {

    private static final AppUserPrincipal OWNER =
            new AppUserPrincipal(1L, "owner", "not-used", "任务所有者");
    private static final AppUserPrincipal OTHER_USER =
            new AppUserPrincipal(2L, "other", "not-used", "其他用户");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TaskRepository repository;

    @BeforeEach
    void clearTasks() {
        repository.deleteAll();
    }

    @Test
    void createsListsUpdatesAndDeletesTask() throws Exception {
        String response = mockMvc.perform(post("/api/tasks")
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "title", "完成前后端联调",
                                "description", "验证 REST API 与看板交互",
                                "priority", "HIGH"
                        ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("TODO"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        long id = objectMapper.readTree(response).get("id").asLong();

        mockMvc.perform(get("/api/tasks").with(user(OWNER)).param("search", "联调"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].title").value("完成前后端联调"));

        mockMvc.perform(patch("/api/tasks/{id}", id)
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"IN_PROGRESS","priority":"MEDIUM"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.priority").value("MEDIUM"));

        mockMvc.perform(delete("/api/tasks/{id}", id).with(user(OWNER)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/tasks").with(user(OWNER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void rejectsBlankTitle() throws Exception {
        mockMvc.perform(post("/api/tasks")
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"   "}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("请求参数校验失败"))
                .andExpect(jsonPath("$.fieldErrors.title").exists());
    }

    @Test
    void returnsNotFoundForUnknownTask() throws Exception {
        mockMvc.perform(patch("/api/tasks/9999")
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"DONE"}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("未找到任务：9999"));
    }

    @Test
    void rejectsBlankTitleOnUpdate() throws Exception {
        String response = mockMvc.perform(post("/api/tasks")
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"待修改任务"}
                                """))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        long id = objectMapper.readTree(response).get("id").asLong();

        mockMvc.perform(patch("/api/tasks/{id}", id)
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"   "}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.title").value("任务标题不能为空"));
    }

    @Test
    void rejectsInvalidFilterValue() throws Exception {
        mockMvc.perform(get("/api/tasks").with(user(OWNER)).param("status", "UNKNOWN"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("请求参数格式不正确"));
    }

    @Test
    void doesNotExposeTasksToAnotherUser() throws Exception {
        String response = mockMvc.perform(post("/api/tasks")
                        .with(user(OWNER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"仅所有者可见"}
                                """))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        long id = objectMapper.readTree(response).get("id").asLong();

        mockMvc.perform(get("/api/tasks").with(user(OTHER_USER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(patch("/api/tasks/{id}", id)
                        .with(user(OTHER_USER))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"DONE"}
                                """))
                .andExpect(status().isNotFound());
    }

    @Test
    void requiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/tasks"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("请先登录后再继续操作"));
    }
}

