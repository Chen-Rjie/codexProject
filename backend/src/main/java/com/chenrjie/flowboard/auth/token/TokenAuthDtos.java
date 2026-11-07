package com.chenrjie.flowboard.auth.token;

import com.chenrjie.flowboard.user.AppUser;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public final class TokenAuthDtos {

    private TokenAuthDtos() {
    }

    public record WeChatLoginRequest(
            String code
    ) {
    }

    public record UpdateProfileRequest(
            @NotBlank(message = "昵称不能为空")
            @Size(max = 80, message = "昵称最多 80 个字符")
            String displayName
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
