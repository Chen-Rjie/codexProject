package com.chenrjie.flowboard.auth.wechat;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class WeChatMiniappClient {

    public record WeChatSession(String openId, String unionId) {
    }

    private record WeChatResponse(
            String openid,
            String unionid,
            String session_key,
            Integer errcode,
            String errmsg
    ) {
    }

    private final RestClient restClient = RestClient.create();
    private final String appId;
    private final String appSecret;
    private final String code2SessionUrl;

    public WeChatMiniappClient(
            @Value("${app.wechat.app-id:}") String appId,
            @Value("${app.wechat.app-secret:}") String appSecret,
            @Value("${app.wechat.code2session-url:https://api.weixin.qq.com/sns/jscode2session}")
            String code2SessionUrl
    ) {
        this.appId = appId;
        this.appSecret = appSecret;
        this.code2SessionUrl = code2SessionUrl;
    }

    public WeChatSession exchangeCode(String code) {
        if (appId == null || appId.isBlank() || appSecret == null || appSecret.isBlank()) {
            throw new WeChatUnavailableException();
        }

        WeChatResponse response = restClient.get()
                .uri(code2SessionUrl, builder -> builder
                        .queryParam("appid", appId)
                        .queryParam("secret", appSecret)
                        .queryParam("js_code", code)
                        .queryParam("grant_type", "authorization_code")
                        .build())
                .retrieve()
                .body(WeChatResponse.class);

        if (response == null || response.openid() == null || response.openid().isBlank()) {
            String message = response == null || response.errmsg() == null
                    ? "微信登录凭证无效或已过期"
                    : response.errmsg();
            throw new WeChatAuthenticationException(message);
        }
        return new WeChatSession(response.openid(), response.unionid());
    }
}
