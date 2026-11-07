package com.chenrjie.flowboard.study;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface StudySessionRepository extends JpaRepository<StudySession, Long> {

    List<StudySession> findByOwnerIdAndStudiedOnBetweenOrderByCreatedAtDesc(
            Long ownerId,
            LocalDate from,
            LocalDate to
    );

    boolean existsByOwnerIdAndItemId(Long ownerId, Long itemId);
}
