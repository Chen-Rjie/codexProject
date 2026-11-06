package com.chenrjie.flowboard.task;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.time.LocalDate;

public final class TaskDtos {

    private TaskDtos() {
    }

    public record CreateTaskRequest(
            @NotBlank(message = "任务标题不能为空")
            @Size(max = 120, message = "任务标题不能超过 120 个字符")
            String title,

            @Size(max = 1000, message = "任务描述不能超过 1000 个字符")
            String description,

            TaskStatus status,
            TaskPriority priority,
            LocalDate dueDate
    ) {
    }

    public record UpdateTaskRequest(
            @Size(min = 1, max = 120, message = "任务标题长度应为 1 到 120 个字符")
            @Pattern(regexp = ".*\\S.*", message = "任务标题不能为空")
            String title,

            @Size(max = 1000, message = "任务描述不能超过 1000 个字符")
            String description,

            TaskStatus status,
            TaskPriority priority,
            LocalDate dueDate,

            Boolean clearDueDate
    ) {
    }

    public record TaskResponse(
            Long id,
            String title,
            String description,
            TaskStatus status,
            TaskPriority priority,
            LocalDate dueDate,
            Instant createdAt,
            Instant updatedAt
    ) {
        public static TaskResponse from(Task task) {
            return new TaskResponse(
                    task.getId(),
                    task.getTitle(),
                    task.getDescription(),
                    task.getStatus(),
                    task.getPriority(),
                    task.getDueDate(),
                    task.getCreatedAt(),
                    task.getUpdatedAt()
            );
        }
    }
}

