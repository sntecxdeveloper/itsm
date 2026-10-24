package com.dex.service;

import com.dex.dto.itsm.ItsmTicketResponse;
import com.dex.entity.Issue;
import com.dex.entity.ItsmTicket;
import com.dex.enums.IssueSeverity;
import com.dex.enums.ItsmTicketStatus;
import com.dex.exception.ResourceNotFoundException;
import com.dex.exception.ValidationException;
import com.dex.repository.IssueRepository;
import com.dex.repository.ItsmTicketRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ItsmService {

    private static final Logger logger = LoggerFactory.getLogger(ItsmService.class);

    private final ItsmTicketRepository itsmTicketRepository;
    private final IssueRepository issueRepository;
    private MailEventNotificationService mailNotifications;
    private com.dex.itsm.BusinessRuleService businessRules;
    private com.dex.itsm.SlaService sla;

    @Autowired
    void setWorkflow(com.dex.itsm.BusinessRuleService businessRules, com.dex.itsm.SlaService sla) {
        this.businessRules = businessRules;
        this.sla = sla;
    }

    private com.dex.itsm.RuleApplier ruleApplier;

    @Autowired
    void setRuleApplier(com.dex.itsm.RuleApplier ruleApplier) {
        this.ruleApplier = ruleApplier;
    }

    /**
     * Business rules act on a ticket being raised, before it is saved: the simple matching rules first, then the rules
     * built under Setup → Business Rules, which can also set the assignee and state or stop the ticket being created.
     */
    private com.dex.itsm.RuleEngine.Outcome applyWorkflow(ItsmTicket ticket, java.util.Map<String, String> formFacts) {
        if (businessRules != null) businessRules.apply(ticket);
        return ruleApplier == null ? new com.dex.itsm.RuleEngine.Outcome() : ruleApplier.apply(ticket, formFacts);
    }

    /** After the ticket is saved: mails the groups the rules named, and hands the rules' messages back to the caller. */
    private ItsmTicketResponse ruleResult(ItsmTicket saved, com.dex.itsm.RuleEngine.Outcome outcome) {
        if (ruleApplier != null) ruleApplier.mailGroups(saved, outcome);
        ItsmTicketResponse response = toTicketResponse(saved);
        response.setRuleMessages(outcome.messages);
        response.setAppliedRules(outcome.matched);
        return response;
    }

    /** Starts the SLA clock from the ticket's own saved creation time, so the deadlines count from the exact moment it was raised. */
    private ItsmTicket startSla(ItsmTicket saved) {
        if (sla == null) return saved;
        sla.start(saved);
        return itsmTicketRepository.save(saved);
    }

    @Autowired
    void setMailNotifications(MailEventNotificationService mailNotifications) {
        this.mailNotifications = mailNotifications;
    }

    public ItsmService(ItsmTicketRepository itsmTicketRepository, IssueRepository issueRepository) {
        this.itsmTicketRepository = itsmTicketRepository;
        this.issueRepository = issueRepository;
    }

    @Cacheable(value = "itsm", key = "#issueId == null ? 'all' : #issueId")
    public List<ItsmTicketResponse> getAllTickets(Long issueId) {
        List<ItsmTicket> tickets = issueId == null
                ? itsmTicketRepository.findAllWithIssue()
                : itsmTicketRepository.findByIssueIdWithIssue(issueId);
        return tickets.stream()
                .map(this::toTicketResponse)
                .collect(Collectors.toList());
    }

    public ItsmTicketResponse getTicketById(Long id) {
        ItsmTicket ticket = itsmTicketRepository.findWithIssueById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ItsmTicket", "id", id));
        return toTicketResponse(ticket);
    }

    @Transactional
    @CacheEvict(value = "itsm", allEntries = true)
    public ItsmTicketResponse updateTicketStatus(Long id, String status) {
        logger.info("Updating ITSM ticket {} status to: {}", id, status);
        ItsmTicket ticket = itsmTicketRepository.findWithIssueById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ItsmTicket", "id", id));
        ItsmTicketStatus previousStatus = ticket.getStatus();

        try {
            ticket.setStatus(ItsmTicketStatus.valueOf(status.toUpperCase()));
        } catch (IllegalArgumentException e) {
            throw new ValidationException("Invalid status: " + status);
        }

        if (sla != null) sla.onChange(ticket);
        ItsmTicket saved = itsmTicketRepository.save(ticket);
        if (previousStatus != saved.getStatus() && mailNotifications != null) mailNotifications.ticketUpdated(saved);
        return toTicketResponse(saved);
    }

    /**
     * Escalate an issue into an ITSM ticket. When the issue is provided its title,
     * description, severity-derived priority and category are auto-attached, along
     * with the affected machine context.
     */
    @Transactional
    @CacheEvict(value = "itsm", allEntries = true)
    public ItsmTicketResponse createTicket(Long issueId, String title, String description,
                                           String priority, String category, String assignedTo) {
        return createTicket(issueId, title, description, priority, category, assignedTo, null);
    }

    /** As above, with the requester's email address kept on the ticket so it can be mailed later. */
    @Transactional
    @CacheEvict(value = "itsm", allEntries = true)
    public ItsmTicketResponse createTicket(Long issueId, String title, String description,
                                           String priority, String category, String assignedTo, String requester) {
        return createTicket(issueId, title, description, priority, category, assignedTo, requester, null);
    }

    /** As above, with what only the form knows (subcategory, impact, urgency, channel, group) for the business rules to look at. */
    @Transactional
    @CacheEvict(value = "itsm", allEntries = true)
    public ItsmTicketResponse createTicket(Long issueId, String title, String description,
                                           String priority, String category, String assignedTo, String requester,
                                           java.util.Map<String, String> formFacts) {
        logger.info("Creating ITSM ticket for issue: {} (priority: {})", issueId, priority);

        ItsmTicket ticket = new ItsmTicket();
        ticket.setTicketCode(nextTicketCode());

        if (issueId != null) {
            Issue issue = issueRepository.findById(issueId)
                    .orElseThrow(() -> new ResourceNotFoundException("Issue", "id", issueId));
            ticket.setIssue(issue);
            if (title == null || title.isBlank()) {
                title = issue.getTitle();
            }
            if (description == null || description.isBlank()) {
                String context = issue.getDescription();
                String machine = issue.getAgent() != null
                        ? "Affected machine: " + issue.getAgent().getHostname()
                              + " (" + issue.getAgent().getAgentId() + ")"
                        : "";
                description = (context != null ? context : "") + (machine.isBlank() ? "" : "\n" + machine);
            }
            if (priority == null || priority.isBlank()) {
                priority = severityToPriority(issue.getSeverity());
            }
            if (category == null || category.isBlank()) {
                category = issue.getCategory();
            }
        }

        if (title == null || title.isBlank()) {
            throw new ValidationException("Ticket title is required");
        }

        ticket.setTitle(title.trim());
        ticket.setDescription(description);
        ticket.setStatus(ItsmTicketStatus.OPEN);
        ticket.setPriority(priority != null ? priority.toUpperCase() : "MEDIUM");
        ticket.setCategory(category);
        ticket.setAssignedTo(assignedTo);
        if (requester != null && !requester.isBlank()) ticket.setRequester(requester.trim());

        com.dex.itsm.RuleEngine.Outcome outcome = applyWorkflow(ticket, formFacts);
        ItsmTicket saved = startSla(itsmTicketRepository.save(ticket));
        logger.info("Created ITSM ticket {}: {}", saved.getTicketCode(), saved.getTitle());
        if (mailNotifications != null) mailNotifications.ticketCreated(saved);
        return ruleResult(saved, outcome);
    }

    @Transactional
    @CacheEvict(value = "itsm", allEntries = true)
    public ItsmTicketResponse assignTicket(Long id, String assignedTo) {
        if (assignedTo == null || assignedTo.isBlank()) {
            throw new ValidationException("assignedTo is required");
        }
        ItsmTicket ticket = itsmTicketRepository.findWithIssueById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ItsmTicket", "id", id));
        boolean changed = !assignedTo.trim().equals(ticket.getAssignedTo());
        ticket.setAssignedTo(assignedTo.trim());
        if (sla != null) sla.onChange(ticket);
        ItsmTicket saved = itsmTicketRepository.save(ticket);
        if (changed && mailNotifications != null) mailNotifications.ticketAssigned(saved);
        return toTicketResponse(saved);
    }

    /** Assigns a ticket to a group (or, with a null group, takes it off the group). */
    @Transactional
    @CacheEvict(value = "itsm", allEntries = true)
    public ItsmTicketResponse assignToGroup(Long id, Long groupId, String groupName) {
        ItsmTicket ticket = itsmTicketRepository.findWithIssueById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ItsmTicket", "id", id));
        ticket.setAssignmentGroupId(groupId);
        ticket.setAssignmentGroup(groupName);
        return toTicketResponse(itsmTicketRepository.save(ticket));
    }

    private String severityToPriority(IssueSeverity severity) {
        if (severity == null) return "MEDIUM";
        return switch (severity) {
            case CRITICAL -> "CRITICAL";
            case HIGH -> "HIGH";
            case MEDIUM -> "MEDIUM";
            default -> "LOW";
        };
    }

    /** A ticket the assistant raises for a task: who asked, from which device, and that it came from the assistant. */
    @Transactional
    @CacheEvict(value = "itsm", allEntries = true)
    public ItsmTicketResponse createAssistantTicket(String title, String description, String priority, String category,
                                                    String assignedTo, String requester, String agentId) {
        if (title == null || title.isBlank()) throw new ValidationException("Ticket title is required");
        ItsmTicket ticket = new ItsmTicket();
        ticket.setTicketCode(nextTicketCode());
        ticket.setTitle(title.trim().length() > 250 ? title.trim().substring(0, 250) : title.trim());
        ticket.setDescription(description);
        ticket.setStatus(ItsmTicketStatus.OPEN);
        ticket.setPriority(priority != null ? priority.toUpperCase() : "MEDIUM");
        ticket.setCategory(category);
        ticket.setAssignedTo(assignedTo != null && !assignedTo.isBlank() ? assignedTo.trim() : null);
        ticket.setRequester(requester);
        ticket.setAgentId(agentId);
        ticket.setSource("AI_TASK");
        com.dex.itsm.RuleEngine.Outcome outcome = applyWorkflow(ticket, null);
        ItsmTicket saved = startSla(itsmTicketRepository.save(ticket));
        logger.info("Assistant raised ticket {}: {}", saved.getTicketCode(), saved.getTitle());
        return ruleResult(saved, outcome);
    }

    private static final java.util.concurrent.atomic.AtomicLong FALLBACK_NUMBER = new java.util.concurrent.atomic.AtomicLong(10000);

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private org.springframework.jdbc.core.JdbcTemplate jdbc;

    /** INC + 5 digits, e.g. INC10001; the number only goes up. */
    private String nextTicketCode() {
        Long next = jdbc == null ? null
                : jdbc.queryForObject("SELECT nextval('itsm_ticket_number_seq')", Long.class);
        return "INC" + (next != null ? next : FALLBACK_NUMBER.incrementAndGet());
    }

    /** A ticket raised from an incoming email: the sender is the requester. */
    @Transactional
    @CacheEvict(value = "itsm", allEntries = true)
    public ItsmTicketResponse createEmailTicket(String title, String description, String requesterEmail) {
        String subject = title == null || title.isBlank() ? "(no subject)" : title.trim();
        ItsmTicket ticket = new ItsmTicket();
        ticket.setTicketCode(nextTicketCode());
        ticket.setTitle(subject.length() > 250 ? subject.substring(0, 250) : subject);
        ticket.setDescription(description);
        ticket.setStatus(ItsmTicketStatus.OPEN);
        ticket.setPriority("MEDIUM");
        ticket.setRequester(requesterEmail != null && requesterEmail.length() > 100
                ? requesterEmail.substring(0, 100) : requesterEmail);
        ticket.setSource("EMAIL");
        com.dex.itsm.RuleEngine.Outcome outcome = applyWorkflow(ticket, null);
        ItsmTicket saved = startSla(itsmTicketRepository.save(ticket));
        logger.info("Email raised ticket {}: {}", saved.getTicketCode(), saved.getTitle());
        if (mailNotifications != null) mailNotifications.ticketCreated(saved);
        return ruleResult(saved, outcome);
    }

    private static final java.util.regex.Pattern EMAIL_ADDRESS = java.util.regex.Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    /**
     * Emails one ticket using template text: the ticket's own data fills the placeholders and the mail goes to
     * {@code to}, or to the requester when that is an email address.
     * Not read-only: sending a mail also writes the mail log row, which a read-only transaction would reject.
     */
    public MailEventNotificationService.SendOutcome emailTicket(Long id, List<String> to, List<String> cc, List<String> bcc, String subject, String body, java.util.Map<String, String> vars) {
        ItsmTicket ticket = itsmTicketRepository.findWithIssueById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket", "id", id));
        if (subject == null || subject.isBlank() || body == null || body.isBlank()) {
            throw new ValidationException("An email subject and body are required");
        }
        List<String> recipients = cleanAddresses(to);
        List<String> copied = cleanAddresses(cc);
        List<String> hidden = cleanAddresses(bcc);
        if (recipients.isEmpty() && ticket.getRequester() != null && EMAIL_ADDRESS.matcher(ticket.getRequester().trim()).matches()) {
            recipients.add(ticket.getRequester().trim());
        }
        if (recipients.isEmpty()) throw new ValidationException("Add a recipient email address for ticket " + ticket.getTicketCode());
        MailRecipients all = new MailRecipients(recipients, copied, hidden);
        if (all.count() > 50 || java.util.stream.Stream.of(recipients, copied, hidden).flatMap(List::stream)
                .anyMatch(a -> a.length() > 255 || !EMAIL_ADDRESS.matcher(a).matches())) {
            throw new ValidationException("Enter up to 50 valid recipient email addresses");
        }
        if (mailNotifications == null) throw new ValidationException("Mail is not available");
        return mailNotifications.sendTemplated(ticket, all, subject, body, vars);
    }

    private static List<String> cleanAddresses(List<String> addresses) {
        List<String> clean = new java.util.ArrayList<>();
        if (addresses != null) for (String address : addresses) {
            if (address != null && !address.isBlank() && !clean.contains(address.trim())) clean.add(address.trim());
        }
        return clean;
    }

    /** Closes a ticket with the way it was resolved. */
    @Transactional
    @CacheEvict(value = "itsm", allEntries = true)
    public ItsmTicketResponse closeWithResolution(Long id, String resolution) {
        ItsmTicket ticket = itsmTicketRepository.findWithIssueById(id)
                .orElseThrow(() -> new ResourceNotFoundException("ItsmTicket", "id", id));
        ticket.setStatus(ItsmTicketStatus.CLOSED);
        ticket.setResolution(resolution);
        ticket.setClosedAt(java.time.LocalDateTime.now());
        if (sla != null) sla.onChange(ticket);
        return toTicketResponse(itsmTicketRepository.save(ticket));
    }

    /** The open tickets (not resolved or closed) this device's person asked for - used to avoid raising the same one twice. */
    @Transactional(readOnly = true)
    public List<ItsmTicket> openTicketsForDevice(String agentId) {
        if (agentId == null || agentId.isBlank()) return List.of();
        return itsmTicketRepository.findByAgentIdAndStatusIn(agentId,
                List.of(ItsmTicketStatus.OPEN, ItsmTicketStatus.IN_PROGRESS));
    }

    private ItsmTicketResponse toTicketResponse(ItsmTicket ticket) {
        ItsmTicketResponse response = toBaseResponse(ticket);
        response.setCustomValues(com.dex.customfields.CustomFieldService.valuesOf(ticket.getCustomValues()));
        response.setRequester(ticket.getRequester());
        response.setAssignmentGroupId(ticket.getAssignmentGroupId());
        response.setAssignmentGroup(ticket.getAssignmentGroup());
        response.setAgentId(ticket.getAgentId());
        response.setSource(ticket.getSource());
        response.setResolution(ticket.getResolution());
        response.setClosedAt(ticket.getClosedAt());
        response.setResponseDueAt(ticket.getResponseDueAt());
        response.setResolutionDueAt(ticket.getResolutionDueAt());
        response.setFirstResponseAt(ticket.getFirstResponseAt());
        response.setResponseBreached(ticket.isResponseBreached());
        response.setResolutionBreached(ticket.isResolutionBreached());
        return response;
    }

    private ItsmTicketResponse toBaseResponse(ItsmTicket ticket) {
        return ItsmTicketResponse.builder()
                .id(ticket.getId())
                .ticketCode(ticket.getTicketCode())
                .title(ticket.getTitle())
                .description(ticket.getDescription())
                .issueId(ticket.getIssue() != null ? ticket.getIssue().getId() : null)
                .issueCode(ticket.getIssue() != null ? ticket.getIssue().getIssueCode() : null)
                .status(ticket.getStatus())
                .priority(ticket.getPriority())
                .assignedTo(ticket.getAssignedTo())
                .category(ticket.getCategory())
                .createdAt(ticket.getCreatedAt())
                .updatedAt(ticket.getUpdatedAt())
                .build();
    }
}
