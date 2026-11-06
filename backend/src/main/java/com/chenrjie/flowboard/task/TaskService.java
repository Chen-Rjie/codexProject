package com.chenrjie.flowboard.task;

import com.chenrjie.flowboard.task.TaskDtos.CreateTaskRequest;
import com.chenrjie.flowboard.task.TaskDtos.TaskResponse;
import com.chenrjie.flowboard.task.TaskDtos.UpdateTaskRequest;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@Transactional
public class TaskService {

    private final TaskRepository repository;

    public TaskService(TaskRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public List<TaskResponse> findAll(Long ownerId, TaskStatus status, TaskPriority priority, String search) {
        Specification<Task> specification = (root, query, builder) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(builder.equal(root.get("ownerId"), ownerId));

            if (status != null) {
                predicates.add(builder.equal(root.get("status"), status));
            }
            if (priority != null) {
                predicates.add(builder.equal(root.get("priority"), priority));
            }
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase(Locale.ROOT) + "%";
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("title")), pattern),
                        builder.like(builder.lower(root.get("description")), pattern)
                ));
            }

            return builder.and(predicates.toArray(Predicate[]::new));
        };

        return repository.findAll(specification, Sort.by(Sort.Direction.DESC, "updatedAt"))
                .stream()
                .map(TaskResponse::from)
                .toList();
    }

    public TaskResponse create(Long ownerId, CreateTaskRequest request) {
        Task task = new Task();
        task.setOwnerId(ownerId);
        task.setTitle(request.title().trim());
        task.setDescription(normalizeDescription(request.description()));
        task.setStatus(request.status() == null ? TaskStatus.TODO : request.status());
        task.setPriority(request.priority() == null ? TaskPriority.MEDIUM : request.priority());
        task.setDueDate(request.dueDate());
        return TaskResponse.from(repository.save(task));
    }

    public TaskResponse update(Long ownerId, Long id, UpdateTaskRequest request) {
        Task task = repository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new TaskNotFoundException(id));

        if (request.title() != null) {
            task.setTitle(request.title().trim());
        }
        if (request.description() != null) {
            task.setDescription(normalizeDescription(request.description()));
        }
        if (request.status() != null) {
            task.setStatus(request.status());
        }
        if (request.priority() != null) {
            task.setPriority(request.priority());
        }
        if (Boolean.TRUE.equals(request.clearDueDate())) {
            task.setDueDate(null);
        } else if (request.dueDate() != null) {
            task.setDueDate(request.dueDate());
        }

        return TaskResponse.from(repository.save(task));
    }

    public void delete(Long ownerId, Long id) {
        Task task = repository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new TaskNotFoundException(id));
        repository.delete(task);
    }

    private String normalizeDescription(String description) {
        return description == null ? "" : description.trim();
    }
}

