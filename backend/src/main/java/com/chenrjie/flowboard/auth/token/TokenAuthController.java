package com.chenrjie.flowboard.auth.token;

import com.chenrjie.flowboard.auth.AuthDtos.LoginRequest;
import com.chenrjie.flowboard.auth.token.TokenAuthDtos.RefreshTokenRequest;
import com.chenrjie.flowboard.auth.token.TokenAuthDtos.TokenLogoutRequest;
import com.chenrjie.flowboard.auth.token.TokenAuthDtos.TokenResponse;
import com.chenrjie.flowboard.auth.token.TokenAuthDtos.WeChatLoginRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class TokenAuthController {

    private final MiniappAuthService service;

    public TokenAuthController(MiniappAuthService service) {
        this.service = service;
    }

    @PostMapping("/wechat/login")
    public TokenResponse wechatLogin(@Valid @RequestBody WeChatLoginRequest request) {
        return service.loginWithWeChat(request.code());
    }

    @PostMapping("/token/login")
    public TokenResponse passwordLogin(@Valid @RequestBody LoginRequest request) {
        return service.loginWithPassword(request);
    }

    @PostMapping("/token/refresh")
    public TokenResponse refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return service.refresh(request.refreshToken());
    }

    @PostMapping("/token/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(
            @RequestHeader(value = "Authorization", required = false) String authorization,
            @RequestBody(required = false) TokenLogoutRequest request
    ) {
        String accessToken = authorization != null && authorization.startsWith("Bearer ")
                ? authorization.substring(7).trim()
                : null;
        service.logout(accessToken, request == null ? null : request.refreshToken());
    }
}
