package com.dex.repository;

import com.dex.entity.ItsmTicket;
import com.dex.enums.ItsmTicketStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.time.LocalDateTime;

public interface ItsmTicketRepository extends JpaRepository<ItsmTicket, Long> {

    Optional<ItsmTicket> findByTicketCode(String ticketCode);

    List<ItsmTicket> findByStatus(ItsmTicketStatus status);

    List<ItsmTicket> findByStatusIn(java.util.Collection<ItsmTicketStatus> statuses);

    List<ItsmTicket> findByAssignedTo(String assignedTo);

    List<ItsmTicket> findByAgentIdAndStatusIn(String agentId, java.util.Collection<ItsmTicketStatus> statuses);

    /** Used by the mail SLA reminders (was missing from the repository on main). */
    List<ItsmTicket> findByStatusInAndCreatedAtAfter(java.util.Collection<ItsmTicketStatus> statuses, java.time.LocalDateTime after);

    @Query("SELECT t FROM ItsmTicket t LEFT JOIN FETCH t.issue ORDER BY t.createdAt DESC")
    List<ItsmTicket> findAllWithIssue();

    @Query("SELECT t FROM ItsmTicket t LEFT JOIN FETCH t.issue WHERE t.issue.id = :issueId ORDER BY t.createdAt DESC")
    List<ItsmTicket> findByIssueIdWithIssue(@Param("issueId") Long issueId);

    @Query("SELECT t FROM ItsmTicket t LEFT JOIN FETCH t.issue WHERE t.id = :id")
    Optional<ItsmTicket> findWithIssueById(@Param("id") Long id);
}
