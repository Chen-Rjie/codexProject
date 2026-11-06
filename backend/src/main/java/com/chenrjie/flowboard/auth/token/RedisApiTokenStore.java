package com.chenrjie.flowboard.auth.token;

import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;

@Component
@Profile("!test")
public class RedisApiTokenStore implements ApiTokenStore {

    private static final String ACCESS_PREFIX = "flowboard:token:access:";
    private static final String REFRESH_PREFIX = "flowboard:token:refresh:";

    private final StringRedisTemplate redis;

    public RedisApiTokenStore(StringRedisTemplate redis) {
        this.redis = redis;
    }

    @Override
    public void saveAccess(String tokenHash, Long userId, Duration ttl) {
        redis.opsForValue().set(ACCESS_PREFIX + tokenHash, userId.toString(), ttl);
    }

    @Override
    public Long findAccessUserId(String tokenHash) {
        String value = redis.opsForValue().get(ACCESS_PREFIX + tokenHash);
        return value == null ? null : Long.valueOf(value);
    }

    @Override
    public void saveRefresh(String tokenHash, Long userId, Duration ttl) {
        redis.opsForValue().set(REFRESH_PREFIX + tokenHash, userId.toString(), ttl);
    }

    @Override
    public Long consumeRefreshUserId(String tokenHash) {
        String key = REFRESH_PREFIX + tokenHash;
        String value = redis.opsForValue().get(key);
        if (value != null) {
            redis.delete(key);
        }
        return value == null ? null : Long.valueOf(value);
    }

    @Override
    public void deleteAccess(String tokenHash) {
        redis.delete(ACCESS_PREFIX + tokenHash);
    }

    @Override
    public void deleteRefresh(String tokenHash) {
        redis.delete(REFRESH_PREFIX + tokenHash);
    }
}
