package com.chenrjie.flowboard.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@ConditionalOnProperty(prefix = "app.database", name = "async-initialization", havingValue = "true")
public class MigrationReadinessFilter extends OncePerRequestFilter {

    private final DatabaseMigrationStatus status;

    public MigrationReadinessFilter(DatabaseMigrationStatus status) {
        this.status = status;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain chain
    ) throws ServletException, IOException {
        if (request.getRequestURI().startsWith("/api/study/") && !status.isReady()) {
            boolean failed = status.getState() == DatabaseMigrationStatus.State.FAILED;
            String message = failed
                    ? "数据库初始化失败，请查看服务日志或重新部署服务"
                    : "数据库迁移进行中，请稍后重试";
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            response.setHeader("Retry-After", "2");
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(
                    "{\"status\":503,\"error\":\"Service Unavailable\",\"message\":\"" + message + "\"}"
            );
            return;
        }
        chain.doFilter(request, response);
    }
}
