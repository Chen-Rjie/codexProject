package com.chenrjie.flowboard.auth.token;

import java.time.Duration;

public interface ApiTokenStore {

    void saveAccess(String tokenHash, Long userId, Duration ttl);

    Long findAccessUserId(String tokenHash);

    void saveRefresh(String tokenHash, Long userId, Duration ttl);

    Long consumeRefreshUserId(String tokenHash);

    void deleteAccess(String tokenHash);

    void deleteRefresh(String tokenHash);
}
