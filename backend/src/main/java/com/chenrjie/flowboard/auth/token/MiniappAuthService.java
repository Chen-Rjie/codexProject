package com.chenrjie.flowboard.auth.token;

import com.chenrjie.flowboard.auth.AuthDtos.LoginRequest;
import com.chenrjie.flowboard.auth.AuthService;
import com.chenrjie.flowboard.auth.token.TokenAuthDtos.TokenResponse;
import com.chenrjie.flowboard.auth.wechat.WeChatMiniappClient;
import com.chenrjie.flowboard.security.AppUserPrincipal;
import com.chenrjie.flowboard.user.AppUser;
import com.chenrjie.flowboard.user.AppUserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@Transactional
public class MiniappAuthService {

    private final AuthService authService;
    private final WeChatMiniappClient weChatClient;
    private final AppUserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;

    public MiniappAuthService(
            AuthService authService,
            WeChatMiniappClient weChatClient,
            AppUserRepository users,
            PasswordEncoder passwordEncoder,
            TokenService tokenService
    ) {
        this.authService = authService;
        this.weChatClient = weChatClient;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
    }

    public TokenResponse loginWithPassword(LoginRequest request) {
        AppUserPrincipal principal = authService.authenticate(request);
        AppUser user = users.findById(principal.id()).orElseThrow();
        return TokenResponse.from(user, tokenService.issue(user.getId()));
    }

    public TokenResponse loginWithWeChat(String code) {
        WeChatMiniappClient.WeChatSession session = weChatClient.exchangeCode(code);
        AppUser user = users.findByWechatOpenId(session.openId())
                .orElseGet(() -> createWeChatUser(session));

        if (session.unionId() != null && user.getWechatUnionId() == null) {
            user.setWechatUnionId(session.unionId());
            user = users.save(user);
        }
        return TokenResponse.from(user, tokenService.issue(user.getId()));
    }

    @Transactional(readOnly = true)
    public TokenResponse refresh(String refreshToken) {
        TokenService.IssuedTokens tokens = tokenService.refresh(refreshToken)
                .orElseThrow(() -> new InvalidTokenException("Refresh Token 无效或已过期"));
        AppUser user = users.findById(tokens.userId()).orElseThrow();
        return TokenResponse.from(user, tokens);
    }

    public void logout(String accessToken, String refreshToken) {
        tokenService.revoke(accessToken, refreshToken);
    }

    private AppUser createWeChatUser(WeChatMiniappClient.WeChatSession session) {
        AppUser user = new AppUser();
        user.setUsername("wx_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12));
        user.setDisplayName("微信用户");
        user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
        user.setWechatOpenId(session.openId());
        user.setWechatUnionId(session.unionId());
        return users.saveAndFlush(user);
    }
}
