package com.chenrjie.flowboard.auth.token;

import com.chenrjie.flowboard.user.AppUser;
import jakarta.validation.constraints.NotBlank;

public final class TokenAuthDtos {

    private TokenAuthDtos() {
    }

    public record WeChatLoginRequest(
            @NotBlank(message = "微信登录 code 不能为空")
            String code
    ) {
    }

    public record RefreshTokenRequest(
            @NotBlank(message = "refreshToken 不能为空")
            String refreshToken
    ) {
    }

    public record TokenLogoutRequest(String refreshToken) {
    }

    public record TokenUser(
            Long id,
            String username,
            String displayName
    ) {
        public static TokenUser from(AppUser user) {
            return new TokenUser(user.getId(), user.getUsername(), user.getDisplayName());
        }
    }

    public record TokenResponse(
            String accessToken,
            String refreshToken,
            long expiresIn,
            TokenUser user
    ) {
        public static TokenResponse from(AppUser user, TokenService.IssuedTokens tokens) {
            return new TokenResponse(
                    tokens.accessToken(),
                    tokens.refreshToken(),
                    tokens.accessExpiresInSeconds(),
                    TokenUser.from(user)
            );
        }
    }
}
