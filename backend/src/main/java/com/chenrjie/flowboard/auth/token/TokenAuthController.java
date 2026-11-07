package com.chenrjie.flowboard.auth.token;

import com.chenrjie.flowboard.auth.AuthDtos.LoginRequest;
import com.chenrjie.flowboard.auth.AuthDtos.RegisterRequest;
import com.chenrjie.flowboard.auth.token.TokenAuthDtos.RefreshTokenRequest;
import com.chenrjie.flowboard.auth.token.TokenAuthDtos.TokenLogoutRequest;
import com.chenrjie.flowboard.auth.token.TokenAuthDtos.TokenResponse;
import com.chenrjie.flowboard.auth.token.TokenAuthDtos.WeChatLoginRequest;
import com.chenrjie.flowboard.security.AppUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class TokenAuthController {

    private final MiniappAuthService service;
    private final boolean trustCloudHeaders;

    public TokenAuthController(
            MiniappAuthService service,
            @Value("${app.wechat.trust-cloud-headers:false}") boolean trustCloudHeaders
    ) {
        this.service = service;
        this.trustCloudHeaders = trustCloudHeaders;
    }

    @PostMapping("/wechat/login")
    public TokenResponse wechatLogin(
            @Valid @RequestBody(required = false) WeChatLoginRequest request,
            @RequestHeader(value = "X-WX-OPENID", required = false) String openId,
            @RequestHeader(value = "X-WX-UNIONID", required = false) String unionId
    ) {
        if (trustCloudHeaders && hasText(openId)) {
            return service.loginWithWeChatIdentity(openId.trim(), trimToNull(unionId));
        }
        String code = request == null ? null : trimToNull(request.code());
        if (code != null) {
            return service.loginWithWeChat(code);
        }
        throw new IllegalArgumentException("缺少微信登录凭证");
    }

    @PutMapping("/me")
    public TokenAuthDtos.TokenUser updateProfile(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody TokenAuthDtos.UpdateProfileRequest request
    ) {
        return service.updateDisplayName(principal.id(), request.displayName());
    }

    @PostMapping("/token/login")
    public TokenResponse passwordLogin(@Valid @RequestBody LoginRequest request) {
        return service.loginWithPassword(request);
    }

    @PostMapping("/token/register")
    public TokenResponse register(@Valid @RequestBody RegisterRequest request) {
        return service.registerWithPassword(request);
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

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private static String trimToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }
}
