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
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@Transactional
public class StudyService {

    private static final ZoneId APP_ZONE = ZoneId.of("Asia/Shanghai");
    private static final long MAX_RANGE_DAYS = 366;
    private static final int NOTE_LIMIT = 1000;
    private static final String REFLOW_MARK = "从错过计划自动顺延";
    private static final int REFLOW_WINDOW_DAYS = 30;

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
        if (skills.existsByOwnerIdAndArchivedFalseAndNameIgnoreCase(ownerId, name)) {
            throw new StudyConflictException("已经存在同名技能");
        }

        StudySkill skill = new StudySkill();
        skill.setOwnerId(ownerId);
        applySkill(skill, request, name, true);
        return SkillResponse.from(skills.save(skill));
    }

    public SkillResponse updateSkill(Long ownerId, Long id, SkillRequest request) {
        StudySkill skill = ownedSkill(ownerId, id);
        String name = request.name().trim();
        if (!skill.getName().equalsIgnoreCase(name)
                && skills.existsByOwnerIdAndArchivedFalseAndNameIgnoreCase(ownerId, name)) {
            throw new StudyConflictException("已经存在同名技能");
        }
        applySkill(skill, request, name, false);
        return SkillResponse.from(skills.save(skill));
    }

    public void deleteSkill(Long ownerId, Long id) {
        StudySkill skill = ownedSkill(ownerId, id);
        if (skills.existsByOwnerIdAndArchivedTrueAndNameIgnoreCase(ownerId, skill.getName())) {
            skill.setName(archivedName(skill.getName(), skill.getId()));
        }
        skill.setArchived(true);
        skill.setActive(false);
        skills.save(skill);
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
        schedulableSkill(ownerId, request.skillId());

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
        StudySkill skill = schedulableSkill(ownerId, skillId);
        LocalDate weekStart = requestedWeekStart.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        LocalDate weekEnd = weekStart.plusDays(6);
        LocalDate today = today();
        if (weekEnd.isBefore(today)) {
            return List.of();
        }
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
        Set<LocalDate> occupied = new HashSet<>();
        for (StudyItem item : existing) {
            LocalDate date = item.getPlannedDate();
            if (!date.isBefore(scheduleStart) && !date.isAfter(weekEnd)) {
                occupied.add(date);
            }
        }

        int availableDays = (int) ChronoUnit.DAYS.between(scheduleStart, weekEnd) + 1;
        int needed = skill.getSessionsPerWeek() - existing.size();
        if (needed <= 0) {
            return List.of();
        }

        List<LocalDate> freeDays = new ArrayList<>();
        for (int offset = 0; offset < availableDays; offset++) {
            LocalDate date = scheduleStart.plusDays(offset);
            if (!occupied.contains(date)) {
                freeDays.add(date);
            }
        }
        if (freeDays.isEmpty()) {
            return List.of();
        }

        int slots = Math.min(needed, freeDays.size());
        List<StudyItem> created = new ArrayList<>();
        for (int index = 0; index < slots; index++) {
            int position = slots == 1
                    ? freeDays.size() / 2
                    : Math.round(index * (freeDays.size() - 1f) / (slots - 1));
            LocalDate plannedDate = freeDays.get(position);

            StudyItem item = new StudyItem();
            item.setOwnerId(ownerId);
            item.setSkillId(skillId);
            item.setTitle(skill.getName() + " · 专注学习 " + (existing.size() + index + 1));
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
        if (item.getPlannedDate().isAfter(today())) {
            throw new StudyConflictException("还没到计划日期，不能提前完成");
        }
        if (item.getStatus() != StudyItemStatus.DONE) {
            item.setStatus(StudyItemStatus.DONE);
            item.setCompletedAt(Instant.now());
            items.save(item);

            if (!sessions.existsByOwnerIdAndItemId(ownerId, item.getId())) {
                StudySession session = new StudySession();
                session.setOwnerId(ownerId);
                session.setSkillId(item.getSkillId());
                session.setItemId(item.getId());
                session.setDurationMinutes(request.durationMinutes());
                session.setStudiedOn(today());
                session.setNote(normalize(request.note()));
                sessions.save(session);
            }
        }
        return ItemResponse.from(item);
    }

    public ItemResponse skipItem(Long ownerId, Long id, String reason) {
        StudyItem item = ownedItem(ownerId, id);
        if (item.getStatus() == StudyItemStatus.DONE) {
            throw new StudyConflictException("已完成的安排不能改为跳过");
        }
        item.setStatus(StudyItemStatus.SKIPPED);
        item.setCompletedAt(null);
        return ItemResponse.from(items.save(item));
    }

    public void deleteItem(Long ownerId, Long id) {
        items.delete(ownedItem(ownerId, id));
    }

    public int reflowMissedItems(Long ownerId) {
        LocalDate today = today();
        List<StudyItem> overdue = items
                .findByOwnerIdAndStatusAndPlannedDateBeforeOrderByPlannedDateAscCreatedAtAsc(
                        ownerId,
                        StudyItemStatus.PLANNED,
                        today
                );
        if (overdue.isEmpty()) return 0;

        LocalDate horizon = today.plusDays(REFLOW_WINDOW_DAYS);
        List<StudyItem> upcoming = items.findByOwnerIdAndPlannedDateBetweenOrderByPlannedDateAscCreatedAtAsc(
                ownerId,
                today,
                horizon
        );
        for (StudyItem item : overdue) {
            LocalDate target = today;
            while (itemsOnDate(upcoming, target) >= 2 && target.isBefore(horizon)) {
                target = target.plusDays(1);
            }
            item.setPlannedDate(target);
            String note = item.getNote() == null ? "" : item.getNote();
            if (!note.contains(REFLOW_MARK)) {
                String suffix = note.isBlank() ? REFLOW_MARK : " · " + REFLOW_MARK;
                int keep = Math.max(0, NOTE_LIMIT - suffix.length());
                item.setNote((note.length() > keep ? note.substring(0, keep) : note) + suffix);
            }
            StudyItem saved = items.save(item);
            upcoming.add(saved);
        }
        return overdue.size();
    }

    @Transactional(readOnly = true)
    public List<SessionResponse> findSessions(Long ownerId, LocalDate from, LocalDate to) {
        validateRange(from, to);
        return sessions.findByOwnerIdAndStudiedOnBetweenOrderByCreatedAtDesc(ownerId, from, to)
                .stream()
                .map(SessionResponse::from)
                .toList();
    }

    private void applySkill(StudySkill skill, SkillRequest request, String name, boolean creating) {
        skill.setName(name);
        if (creating || request.description() != null) {
            skill.setDescription(normalize(request.description()));
        }
        if (creating || request.accent() != null) {
            skill.setAccent(request.accent() == null ? "#DBFF73" : request.accent().toUpperCase(Locale.ROOT));
        }
        skill.setWeeklyMinutes(request.weeklyMinutes());
        skill.setSessionMinutes(request.sessionMinutes());
        skill.setSessionsPerWeek(request.sessionsPerWeek());
        if (request.active() != null) {
            skill.setActive(request.active());
        } else if (creating) {
            skill.setActive(true);
        }
    }

    private StudySkill ownedSkill(Long ownerId, Long id) {
        return skills.findByIdAndOwnerIdAndArchivedFalse(id, ownerId)
                .orElseThrow(() -> new StudyNotFoundException("未找到技能：" + id));
    }

    private StudySkill schedulableSkill(Long ownerId, Long id) {
        StudySkill skill = ownedSkill(ownerId, id);
        if (!skill.isActive()) {
            throw new StudyConflictException("该技能已停止排期，请先恢复排期");
        }
        return skill;
    }

    private StudyItem ownedItem(Long ownerId, Long id) {
        return items.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new StudyNotFoundException("未找到学习计划：" + id));
    }

    private void validateRange(LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from)) {
            throw new IllegalArgumentException("日期范围无效");
        }
        if (ChronoUnit.DAYS.between(from, to) > MAX_RANGE_DAYS) {
            throw new IllegalArgumentException("查询范围不能超过 366 天");
        }
    }

    private LocalDate today() {
        return LocalDate.now(APP_ZONE);
    }

    private String archivedName(String name, Long id) {
        String suffix = " · 已移除 " + id;
        int keep = Math.max(0, 80 - suffix.length());
        return (name.length() > keep ? name.substring(0, keep) : name) + suffix;
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }

    private long itemsOnDate(List<StudyItem> scheduled, LocalDate date) {
        return scheduled.stream().filter(item -> item.getPlannedDate().equals(date)).count();
    }
}
