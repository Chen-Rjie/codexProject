package com.chenrjie.flowboard.auth.token;

import com.chenrjie.flowboard.auth.wechat.WeChatMiniappClient;
import com.chenrjie.flowboard.user.AppUserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class TokenAuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AppUserRepository users;

    @MockBean
    private WeChatMiniappClient weChatClient;

    @BeforeEach
    void clearUsers() {
        users.deleteAll();
    }

    @Test
    void logsInWithPasswordAndUsesBearerToken() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"mobile","displayName":"移动端用户","password":"Study1234"}
                                """))
                .andExpect(status().isCreated());

        String response = mockMvc.perform(post("/api/auth/token/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"mobile","password":"Study1234"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode tokens = objectMapper.readTree(response);
        String accessToken = tokens.get("accessToken").asText();

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("mobile"));

        mockMvc.perform(get("/api/study/skills")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    void exchangesWeChatCodeAndRefreshesTokens() throws Exception {
        when(weChatClient.exchangeCode("valid-code"))
                .thenReturn(new WeChatMiniappClient.WeChatSession("openid-test-001", "unionid-test-001"));

        String response = mockMvc.perform(post("/api/auth/wechat/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"valid-code"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.displayName").value("微信用户"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        JsonNode tokens = objectMapper.readTree(response);

        mockMvc.perform(post("/api/auth/token/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "refreshToken", tokens.get("refreshToken").asText()
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty());

        mockMvc.perform(post("/api/auth/token/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(java.util.Map.of(
                                "refreshToken", tokens.get("refreshToken").asText()
                        ))))
                .andExpect(status().isUnauthorized());
    }
}
