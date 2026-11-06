package com.chenrjie.flowboard.security;

import com.chenrjie.flowboard.auth.token.TokenService;
import com.chenrjie.flowboard.user.AppUserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class BearerTokenAuthenticationFilter extends OncePerRequestFilter {

    private final TokenService tokenService;
    private final AppUserRepository users;

    public BearerTokenAuthenticationFilter(TokenService tokenService, AppUserRepository users) {
        this.tokenService = tokenService;
        this.users = users;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        String header = request.getHeader("Authorization");
        if (header != null && header.startsWith("Bearer ")
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            String token = header.substring(7).trim();
            tokenService.resolveAccess(token).flatMap(users::findById).ifPresent(user -> {
                AppUserPrincipal principal = AppUserPrincipal.from(user);
                principal.eraseCredentials();
                SecurityContextHolder.getContext().setAuthentication(
                        UsernamePasswordAuthenticationToken.authenticated(
                                principal,
                                null,
                                principal.getAuthorities()
                        )
                );
            });
        }
        filterChain.doFilter(request, response);
    }
}
