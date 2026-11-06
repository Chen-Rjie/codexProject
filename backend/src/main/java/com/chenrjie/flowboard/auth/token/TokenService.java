package com.chenrjie.flowboard.auth.token;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;

@Service
public class TokenService {

    public record IssuedTokens(
            Long userId,
            String accessToken,
            String refreshToken,
            long accessExpiresInSeconds
    ) {
    }

    private final ApiTokenStore store;
    private final Duration accessTtl;
    private final Duration refreshTtl;
    private final SecureRandom random = new SecureRandom();

    public TokenService(
            ApiTokenStore store,
            @Value("${app.tokens.access-ttl:2h}") Duration accessTtl,
            @Value("${app.tokens.refresh-ttl:30d}") Duration refreshTtl
    ) {
        this.store = store;
        this.accessTtl = accessTtl;
        this.refreshTtl = refreshTtl;
    }

    public IssuedTokens issue(Long userId) {
        String accessToken = opaqueToken();
        String refreshToken = opaqueToken();
        store.saveAccess(hash(accessToken), userId, accessTtl);
        store.saveRefresh(hash(refreshToken), userId, refreshTtl);
        return new IssuedTokens(userId, accessToken, refreshToken, accessTtl.toSeconds());
    }

    public Optional<Long> resolveAccess(String token) {
        if (token == null || token.isBlank()) return Optional.empty();
        return Optional.ofNullable(store.findAccessUserId(hash(token)));
    }

    public Optional<IssuedTokens> refresh(String refreshToken) {
        if (refreshToken == null || refreshToken.isBlank()) return Optional.empty();
        Long userId = store.consumeRefreshUserId(hash(refreshToken));
        return userId == null ? Optional.empty() : Optional.of(issue(userId));
    }

    public void revoke(String accessToken, String refreshToken) {
        if (accessToken != null && !accessToken.isBlank()) {
            store.deleteAccess(hash(accessToken));
        }
        if (refreshToken != null && !refreshToken.isBlank()) {
            store.deleteRefresh(hash(refreshToken));
        }
    }

    private String opaqueToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
