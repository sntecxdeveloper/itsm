package com.dex.itsm;

import com.dex.entity.ItsmTicket;
import com.dex.enums.ItsmTicketStatus;
import com.dex.exception.ValidationException;
import com.dex.repository.ItsmTicketRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;

/** Works out ticket deadlines from the SLA policy for its priority and flags the ones that are missed. */
@Service
public class SlaService {

    private static final Logger logger = LoggerFactory.getLogger(SlaService.class);
    private static final List<ItsmTicketStatus> ACTIVE = List.of(ItsmTicketStatus.OPEN, ItsmTicketStatus.IN_PROGRESS);

    private final SlaPolicyRepository policies;
    private final ItsmTicketRepository tickets;

    public SlaService(SlaPolicyRepository policies, ItsmTicketRepository tickets) {
        this.policies = policies;
        this.tickets = tickets;
    }

    /** Starts the clock: sets both deadlines from the ticket's priority, counted from its saved creation time (call after the first save). */
    public void start(ItsmTicket ticket) {
        String priority = ticket.getPriority() == null ? "MEDIUM" : ticket.getPriority().toUpperCase(Locale.ROOT);
        SlaPolicy policy = policies.findById(priority).orElse(null);
        if (policy == null || !Boolean.TRUE.equals(policy.getEnabled())) return;
        LocalDateTime from = ticket.getCreatedAt() != null ? ticket.getCreatedAt() : LocalDateTime.now();
        ticket.setResponseDueAt(from.plusMinutes(policy.getResponseMinutes()));
        ticket.setResolutionDueAt(from.plusMinutes(policy.getResolutionMinutes()));
    }

    /** First pick-up (assigned, or moved on from OPEN) meets the response target; resolving or closing stops the resolution clock. */
    public void onChange(ItsmTicket ticket) {
        LocalDateTime now = LocalDateTime.now();
        boolean pickedUp = ticket.getStatus() != ItsmTicketStatus.OPEN
                || (ticket.getAssignedTo() != null && !ticket.getAssignedTo().isBlank());
        if (pickedUp && ticket.getFirstResponseAt() == null) {
            ticket.setFirstResponseAt(now);
            if (ticket.getResponseDueAt() != null && now.isAfter(ticket.getResponseDueAt())) ticket.setResponseBreached(true);
        }
        if (!ACTIVE.contains(ticket.getStatus()) && ticket.getResolutionDueAt() != null
                && now.isAfter(ticket.getResolutionDueAt())) {
            ticket.setResolutionBreached(true);
        }
    }

    /** Marks active tickets whose deadline has passed. */
    @Scheduled(fixedDelayString = "${itsm.sla-breach-check-interval-ms:60000}")
    @Transactional
    @CacheEvict(value = "itsm", allEntries = true)
    public void flagBreaches() {
        LocalDateTime now = LocalDateTime.now();
        int flagged = 0;
        for (ItsmTicket t : tickets.findByStatusIn(ACTIVE)) {
            boolean changed = false;
            if (!t.isResponseBreached() && t.getFirstResponseAt() == null
                    && t.getResponseDueAt() != null && now.isAfter(t.getResponseDueAt())) {
                t.setResponseBreached(true);
                changed = true;
            }
            if (!t.isResolutionBreached() && t.getResolutionDueAt() != null && now.isAfter(t.getResolutionDueAt())) {
                t.setResolutionBreached(true);
                changed = true;
            }
            if (changed) { tickets.save(t); flagged++; }
        }
        if (flagged > 0) logger.warn("{} ticket(s) passed an SLA deadline", flagged);
    }

    @Transactional(readOnly = true)
    public List<SlaPolicy> list() { return policies.findAll(); }

    @Transactional
    public SlaPolicy setEnabled(String priority, boolean enabled) {
        SlaPolicy policy = policies.findById(priority.toUpperCase(Locale.ROOT))
                .orElseThrow(() -> new ValidationException("Priority must be CRITICAL, HIGH, MEDIUM or LOW"));
        policy.setEnabled(enabled);
        return policies.save(policy);
    }

    @Transactional
    public SlaPolicy update(String priority, int responseMinutes, int resolutionMinutes) {
        SlaPolicy policy = policies.findById(priority.toUpperCase(Locale.ROOT))
                .orElseThrow(() -> new ValidationException("Priority must be CRITICAL, HIGH, MEDIUM or LOW"));
        if (responseMinutes < 1 || resolutionMinutes < responseMinutes) {
            throw new ValidationException("Response must be at least 1 minute and no longer than the resolution time");
        }
        policy.setResponseMinutes(responseMinutes);
        policy.setResolutionMinutes(resolutionMinutes);
        return policies.save(policy);
    }
}
