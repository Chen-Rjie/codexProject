package com.chenrjie.flowboard.auth;

import com.chenrjie.flowboard.auth.AuthDtos.LoginRequest;
import com.chenrjie.flowboard.auth.AuthDtos.RegisterRequest;
import com.chenrjie.flowboard.security.AppUserPrincipal;
import com.chenrjie.flowboard.user.AppUser;
import com.chenrjie.flowboard.user.AppUserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Service
@Transactional
public class AuthService {

    private final AppUserRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final boolean registrationEnabled;

    public AuthService(
            AppUserRepository repository,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            @Value("${app.auth.registration-enabled:true}") boolean registrationEnabled
    ) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.registrationEnabled = registrationEnabled;
    }

    @Transactional(readOnly = true)
    public AppUserPrincipal authenticate(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                UsernamePasswordAuthenticationToken.unauthenticated(
                        normalizeUsername(request.username()),
                        request.password()
                )
        );
        return (AppUserPrincipal) authentication.getPrincipal();
    }

    public AppUserPrincipal register(RegisterRequest request) {
        if (!registrationEnabled) {
            throw new RegistrationDisabledException();
        }

        String username = normalizeUsername(request.username());
        if (repository.existsByUsername(username)) {
            throw new DuplicateUsernameException();
        }

        AppUser user = new AppUser();
        user.setUsername(username);
        user.setDisplayName(request.displayName().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        return AppUserPrincipal.from(repository.saveAndFlush(user));
    }

    private String normalizeUsername(String username) {
        return username.trim().toLowerCase(Locale.ROOT);
    }
}

