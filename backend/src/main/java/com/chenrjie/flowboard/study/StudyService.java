package com.chenrjie.flowboard.study;

import com.chenrjie.flowboard.study.StudyDtos.CompleteItemRequest;
import com.chenrjie.flowboard.study.StudyDtos.ItemRequest;
import com.chenrjie.flowboard.study.StudyDtos.ItemResponse;
import com.chenrjie.flowboard.study.StudyDtos.SessionResponse;
import com.chenrjie.flowboard.study.StudyDtos.SkillRequest;
import com.chenrjie.flowboard.study.StudyDtos.SkillResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@Transactional
public class StudyService {

    private final StudySkillRepository skills;
    private final StudyItemRepository items;
    private final StudySessionRepository sessions;

    public StudyService(
            StudySkillRepository skills,
            StudyItemRepository items,
            StudySessionRepository sessions
    ) {
        this.skills = skills;
        this.items = items;
        this.sessions = sessions;
    }

    @Transactional(readOnly = true)
    public List<SkillResponse> findSkills(Long ownerId) {
        return skills.findByOwnerIdOrderByCreatedAtAsc(ownerId).stream()
                .map(SkillResponse::from)
                .toList();
    }

    public SkillResponse createSkill(Long ownerId, SkillRequest request) {
        String name = request.name().trim();
        if (skills.existsByOwnerIdAndNameIgnoreCase(ownerId, name)) {
            throw new StudyConflictException("已经存在同名技能");
        }

        StudySkill skill = new StudySkill();
        skill.setOwnerId(ownerId);
        applySkill(skill, request, name);
        return SkillResponse.from(skills.save(skill));
    }

    public SkillResponse updateSkill(Long ownerId, Long id, SkillRequest request) {
        StudySkill skill = ownedSkill(ownerId, id);
        String name = request.name().trim();
        if (!skill.getName().equalsIgnoreCase(name)
                && skills.existsByOwnerIdAndNameIgnoreCase(ownerId, name)) {
            throw new StudyConflictException("已经存在同名技能");
        }
        applySkill(skill, request, name);
        return SkillResponse.from(skills.save(skill));
    }

    public void deleteSkill(Long ownerId, Long id) {
        skills.delete(ownedSkill(ownerId, id));
    }

    @Transactional(readOnly = true)
    public List<ItemResponse> findItems(Long ownerId, LocalDate from, LocalDate to) {
        validateRange(from, to);
        return items.findByOwnerIdAndPlannedDateBetweenOrderByPlannedDateAscCreatedAtAsc(ownerId, from, to)
                .stream()
                .map(ItemResponse::from)
                .toList();
    }

    public ItemResponse createItem(Long ownerId, ItemRequest request) {
        ownedSkill(ownerId, request.skillId());

        StudyItem item = new StudyItem();
        item.setOwnerId(ownerId);
        item.setSkillId(request.skillId());
        item.setTitle(request.title().trim());
        item.setNote(normalize(request.note()));
        item.setPlannedDate(request.plannedDate());
        item.setPlannedMinutes(request.plannedMinutes());
        item.setStatus(StudyItemStatus.PLANNED);
        return ItemResponse.from(items.save(item));
    }

    public List<ItemResponse> generateWeek(Long ownerId, Long skillId, LocalDate requestedWeekStart) {
        StudySkill skill = ownedSkill(ownerId, skillId);
        LocalDate weekStart = requestedWeekStart.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate weekEnd = weekStart.plusDays(6);
        LocalDate today = LocalDate.now();
        LocalDate currentWeekStart = today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate scheduleStart = weekStart.equals(currentWeekStart) && today.isAfter(weekStart)
                ? today
                : weekStart;
        List<StudyItem> existing = items.findByOwnerIdAndSkillIdAndPlannedDateBetween(
                ownerId,
                skillId,
                weekStart,
                weekEnd
        );

        List<StudyItem> created = new ArrayList<>();
        int availableDays = (int) ChronoUnit.DAYS.between(scheduleStart, weekEnd) + 1;
        int planCount = Math.min(skill.getSessionsPerWeek(), availableDays);
        for (int index = 0; index < planCount; index++) {
            int dayOffset = planCount == 1
                    ? 0
                    : Math.round(index * (availableDays - 1f) / (planCount - 1));
            LocalDate plannedDate = scheduleStart.plusDays(dayOffset);
            boolean alreadyPlanned = existing.stream()
                    .anyMatch(item -> item.getPlannedDate().equals(plannedDate));
            if (alreadyPlanned) {
                continue;
            }

            StudyItem item = new StudyItem();
            item.setOwnerId(ownerId);
            item.setSkillId(skillId);
            item.setTitle(skill.getName() + " · 专注学习 " + (index + 1));
            item.setNote("按你的每周时间预算自动安排");
            item.setPlannedDate(plannedDate);
            item.setPlannedMinutes(skill.getSessionMinutes());
            item.setStatus(StudyItemStatus.PLANNED);
            created.add(items.save(item));
        }

        return created.stream().map(ItemResponse::from).toList();
    }

    public ItemResponse completeItem(Long ownerId, Long id, CompleteItemRequest request) {
        StudyItem item = ownedItem(ownerId, id);
        if (item.getStatus() != StudyItemStatus.DONE) {
            item.setStatus(StudyItemStatus.DONE);
            item.setCompletedAt(Instant.now());
            items.save(item);

            StudySession session = new StudySession();
            session.setOwnerId(ownerId);
            session.setSkillId(item.getSkillId());
            session.setItemId(item.getId());
            session.setDurationMinutes(request.durationMinutes());
            session.setStudiedOn(LocalDate.now());
            session.setNote(normalize(request.note()));
            sessions.save(session);
        }
        return ItemResponse.from(item);
    }

    public ItemResponse skipItem(Long ownerId, Long id, String reason) {
        StudyItem item = ownedItem(ownerId, id);
        item.setStatus(StudyItemStatus.SKIPPED);
        item.setCompletedAt(null);
        if (reason != null && !reason.isBlank()) {
            item.setNote(reason.trim());
        }
        return ItemResponse.from(items.save(item));
    }

    public void deleteItem(Long ownerId, Long id) {
        items.delete(ownedItem(ownerId, id));
    }

    @Transactional(readOnly = true)
    public List<SessionResponse> findSessions(Long ownerId, LocalDate from, LocalDate to) {
        validateRange(from, to);
        return sessions.findByOwnerIdAndStudiedOnBetweenOrderByCreatedAtDesc(ownerId, from, to)
                .stream()
                .map(SessionResponse::from)
                .toList();
    }

    private void applySkill(StudySkill skill, SkillRequest request, String name) {
        skill.setName(name);
        skill.setDescription(normalize(request.description()));
        skill.setAccent(request.accent() == null ? "#DBFF73" : request.accent().toUpperCase(Locale.ROOT));
        skill.setWeeklyMinutes(request.weeklyMinutes());
        skill.setSessionMinutes(request.sessionMinutes());
        skill.setSessionsPerWeek(request.sessionsPerWeek());
        skill.setActive(request.active() == null || request.active());
    }

    private StudySkill ownedSkill(Long ownerId, Long id) {
        return skills.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new StudyNotFoundException("未找到技能：" + id));
    }

    private StudyItem ownedItem(Long ownerId, Long id) {
        return items.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new StudyNotFoundException("未找到学习计划：" + id));
    }

    private void validateRange(LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from)) {
            throw new IllegalArgumentException("日期范围无效");
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
