package com.chenrjie.flowboard.study;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface StudyItemRepository extends JpaRepository<StudyItem, Long> {

    List<StudyItem> findByOwnerIdAndPlannedDateBetweenOrderByPlannedDateAscCreatedAtAsc(
            Long ownerId,
            LocalDate from,
            LocalDate to
    );

    List<StudyItem> findByOwnerIdAndSkillIdAndPlannedDateBetween(
            Long ownerId,
            Long skillId,
            LocalDate from,
            LocalDate to
    );

    Optional<StudyItem> findByIdAndOwnerId(Long id, Long ownerId);

    List<StudyItem> findByOwnerIdAndStatusAndPlannedDateBeforeOrderByPlannedDateAscCreatedAtAsc(
            Long ownerId,
            StudyItemStatus status,
            LocalDate before
    );
}
