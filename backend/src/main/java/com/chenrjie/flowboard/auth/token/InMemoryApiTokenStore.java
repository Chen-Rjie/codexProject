package com.chenrjie.flowboard.auth.token;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
@Profile("test")
public class InMemoryApiTokenStore implements ApiTokenStore {

    private record Entry(Long userId, Instant expiresAt) {
    }

    private final Map<String, Entry> access = new ConcurrentHashMap<>();
    private final Map<String, Entry> refresh = new ConcurrentHashMap<>();

    @Override
    public void saveAccess(String tokenHash, Long userId, Duration ttl) {
        access.put(tokenHash, new Entry(userId, Instant.now().plus(ttl)));
    }

    @Override
    public Long findAccessUserId(String tokenHash) {
        Entry entry = access.get(tokenHash);
        if (entry == null) return null;
        if (entry.expiresAt().isBefore(Instant.now())) {
            access.remove(tokenHash);
            return null;
        }
        return entry.userId();
    }

    @Override
    public void saveRefresh(String tokenHash, Long userId, Duration ttl) {
        refresh.put(tokenHash, new Entry(userId, Instant.now().plus(ttl)));
    }

    @Override
    public Long consumeRefreshUserId(String tokenHash) {
        Entry entry = refresh.remove(tokenHash);
        if (entry == null || entry.expiresAt().isBefore(Instant.now())) return null;
        return entry.userId();
    }

    @Override
    public void deleteAccess(String tokenHash) {
        access.remove(tokenHash);
    }

    @Override
    public void deleteRefresh(String tokenHash) {
        refresh.remove(tokenHash);
    }
}
