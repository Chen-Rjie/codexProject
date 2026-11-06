package com.chenrjie.flowboard.study;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;

public final class StudyDtos {

    private StudyDtos() {
    }

    public record SkillRequest(
            @NotBlank(message = "技能名称不能为空")
            @Size(max = 80, message = "技能名称不能超过 80 个字符")
            String name,

            @Size(max = 500, message = "技能说明不能超过 500 个字符")
            String description,

            @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "颜色格式应为 #RRGGBB")
            String accent,

            @Min(value = 30, message = "每周学习时间不能少于 30 分钟")
            @Max(value = 1260, message = "每周学习时间不能超过 1260 分钟")
            int weeklyMinutes,

            @Min(value = 5, message = "单次学习不能少于 5 分钟")
            @Max(value = 180, message = "单次学习不能超过 180 分钟")
            int sessionMinutes,

            @Min(value = 1, message = "每周至少安排 1 次")
            @Max(value = 7, message = "每周最多安排 7 次")
            int sessionsPerWeek,

            Boolean active
    ) {
    }

    public record ItemRequest(
            @NotNull(message = "请选择技能")
            Long skillId,

            @NotBlank(message = "学习内容不能为空")
            @Size(max = 120, message = "学习内容不能超过 120 个字符")
            String title,

            @Size(max = 1000, message = "备注不能超过 1000 个字符")
            String note,

            @NotNull(message = "请选择计划日期")
            LocalDate plannedDate,

            @Min(value = 5, message = "计划时长不能少于 5 分钟")
            @Max(value = 300, message = "计划时长不能超过 300 分钟")
            int plannedMinutes
    ) {
    }

    public record CompleteItemRequest(
            @Min(value = 1, message = "学习时长不能少于 1 分钟")
            @Max(value = 600, message = "学习时长不能超过 600 分钟")
            int durationMinutes,

            @Size(max = 1000, message = "学习心得不能超过 1000 个字符")
            String note
    ) {
    }

    public record SkipItemRequest(
            @Size(max = 500, message = "跳过原因不能超过 500 个字符")
            String reason
    ) {
    }

    public record ReflowResponse(int movedItems) {
    }

    public record SkillResponse(
            Long id,
            String name,
            String description,
            String accent,
            int weeklyMinutes,
            int sessionMinutes,
            int sessionsPerWeek,
            boolean active,
            Instant createdAt
    ) {
        public static SkillResponse from(StudySkill skill) {
            return new SkillResponse(
                    skill.getId(),
                    skill.getName(),
                    skill.getDescription(),
                    skill.getAccent(),
                    skill.getWeeklyMinutes(),
                    skill.getSessionMinutes(),
                    skill.getSessionsPerWeek(),
                    skill.isActive(),
                    skill.getCreatedAt()
            );
        }
    }

    public record ItemResponse(
            Long id,
            Long skillId,
            String title,
            String note,
            LocalDate plannedDate,
            int plannedMinutes,
            StudyItemStatus status,
            Instant completedAt
    ) {
        public static ItemResponse from(StudyItem item) {
            return new ItemResponse(
                    item.getId(),
                    item.getSkillId(),
                    item.getTitle(),
                    item.getNote(),
                    item.getPlannedDate(),
                    item.getPlannedMinutes(),
                    item.getStatus(),
                    item.getCompletedAt()
            );
        }
    }

    public record SessionResponse(
            Long id,
            Long skillId,
            Long itemId,
            int durationMinutes,
            LocalDate studiedOn,
            String note,
            Instant createdAt
    ) {
        public static SessionResponse from(StudySession session) {
            return new SessionResponse(
                    session.getId(),
                    session.getSkillId(),
                    session.getItemId(),
                    session.getDurationMinutes(),
                    session.getStudiedOn(),
                    session.getNote(),
                    session.getCreatedAt()
            );
        }
    }
}
