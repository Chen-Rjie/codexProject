package com.chenrjie.flowboard.study;

import com.chenrjie.flowboard.security.AppUserPrincipal;
import com.chenrjie.flowboard.study.StudyDtos.CompleteItemRequest;
import com.chenrjie.flowboard.study.StudyDtos.ItemRequest;
import com.chenrjie.flowboard.study.StudyDtos.ItemResponse;
import com.chenrjie.flowboard.study.StudyDtos.SessionResponse;
import com.chenrjie.flowboard.study.StudyDtos.SkipItemRequest;
import com.chenrjie.flowboard.study.StudyDtos.SkillRequest;
import com.chenrjie.flowboard.study.StudyDtos.SkillResponse;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/study")
public class StudyController {

    private final StudyService service;

    public StudyController(StudyService service) {
        this.service = service;
    }

    @GetMapping("/skills")
    public List<SkillResponse> skills(@AuthenticationPrincipal AppUserPrincipal principal) {
        return service.findSkills(principal.id());
    }

    @PostMapping("/skills")
    @ResponseStatus(HttpStatus.CREATED)
    public SkillResponse createSkill(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody SkillRequest request
    ) {
        return service.createSkill(principal.id(), request);
    }

    @PutMapping("/skills/{id}")
    public SkillResponse updateSkill(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody SkillRequest request
    ) {
        return service.updateSkill(principal.id(), id, request);
    }

    @DeleteMapping("/skills/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSkill(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable Long id) {
        service.deleteSkill(principal.id(), id);
    }

    @PostMapping("/skills/{id}/generate-plan")
    public List<ItemResponse> generatePlan(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable Long id,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate weekStart
    ) {
        return service.generateWeek(principal.id(), id, weekStart);
    }

    @GetMapping("/items")
    public List<ItemResponse> items(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return service.findItems(principal.id(), from, to);
    }

    @PostMapping("/items")
    @ResponseStatus(HttpStatus.CREATED)
    public ItemResponse createItem(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @Valid @RequestBody ItemRequest request
    ) {
        return service.createItem(principal.id(), request);
    }

    @PostMapping("/items/{id}/complete")
    public ItemResponse completeItem(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody CompleteItemRequest request
    ) {
        return service.completeItem(principal.id(), id, request);
    }

    @PostMapping("/items/{id}/skip")
    public ItemResponse skipItem(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody(required = false) SkipItemRequest request
    ) {
        return service.skipItem(principal.id(), id, request == null ? null : request.reason());
    }

    @DeleteMapping("/items/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteItem(@AuthenticationPrincipal AppUserPrincipal principal, @PathVariable Long id) {
        service.deleteItem(principal.id(), id);
    }

    @GetMapping("/sessions")
    public List<SessionResponse> sessions(
            @AuthenticationPrincipal AppUserPrincipal principal,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        return service.findSessions(principal.id(), from, to);
    }
}
