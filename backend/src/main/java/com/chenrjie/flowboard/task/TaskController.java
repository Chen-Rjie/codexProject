package com.chenrjie.flowboard.task;

import com.chenrjie.flowboard.task.TaskDtos.CreateTaskRequest;
import com.chenrjie.flowboard.task.TaskDtos.TaskResponse;
import com.chenrjie.flowboard.task.TaskDtos.UpdateTaskRequest;
import com.chenrjie.flowboard.security.AppUserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.core.annotation.AuthenticationPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService service;

    public TaskController(TaskService service) {
        this.service = service;
    }

    @GetMapping
    public List<TaskResponse> findAll(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @RequestParam(required = false) TaskStatus status,
            @RequestParam(required = false) TaskPriority priority,
            @RequestParam(required = false) String search
    ) {
        return service.findAll(principal.id(), status, priority, search);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskResponse create(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody CreateTaskRequest request
    ) {
        return service.create(principal.id(), request);
    }

    @PatchMapping("/{id}")
    public TaskResponse update(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody UpdateTaskRequest request
    ) {
        return service.update(principal.id(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable Long id
    ) {
        service.delete(principal.id(), id);
    }
}

