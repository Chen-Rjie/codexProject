package com.chenrjie.flowboard.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record LoginRequest(
            @NotBlank(message = "用户名不能为空")
            String username,

            @NotBlank(message = "密码不能为空")
            String password
    ) {
    }

    public record RegisterRequest(
            @NotBlank(message = "用户名不能为空")
            @Pattern(
                    regexp = "^[A-Za-z0-9_.-]{3,32}$",
                    message = "用户名只能包含字母、数字、下划线、短横线或点，长度为 3 到 32 位"
            )
            String username,

            @NotBlank(message = "昵称不能为空")
            @Size(max = 80, message = "昵称不能超过 80 个字符")
            String displayName,

            @NotBlank(message = "密码不能为空")
            @Size(min = 8, max = 72, message = "密码长度应为 8 到 72 个字符")
            @Pattern(
                    regexp = "^(?=.*[A-Za-z])(?=.*\\d).+$",
                    message = "密码必须同时包含字母和数字"
            )
            String password
    ) {
    }

    public record AuthResponse(
            Long id,
            String username,
            String displayName
    ) {
        public static AuthResponse from(com.chenrjie.flowboard.security.AppUserPrincipal principal) {
            return new AuthResponse(principal.id(), principal.getUsername(), principal.displayName());
        }
    }
}

