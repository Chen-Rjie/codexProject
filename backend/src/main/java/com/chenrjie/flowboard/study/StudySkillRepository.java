package com.chenrjie.flowboard.study;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StudySkillRepository extends JpaRepository<StudySkill, Long> {

    List<StudySkill> findByOwnerIdOrderByCreatedAtAsc(Long ownerId);

    Optional<StudySkill> findByIdAndOwnerId(Long id, Long ownerId);

    boolean existsByOwnerIdAndNameIgnoreCase(Long ownerId, String name);
}
