package com.dex.itsm;

import com.dex.entity.ItsmTicket;
import com.dex.enums.ItsmTicketStatus;
import com.dex.exception.ValidationException;
import com.dex.groups.DexGroup;
import com.dex.groups.DexGroupRepository;
import com.dex.groups.GroupService;
import com.dex.groups.GroupType;
import com.dex.service.MailEventNotificationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Puts the business rules (see {@link RuleEngine}) to work on a ticket that is being raised, however it arrives. */
@Service
public class RuleApplier {

    private static final Logger logger = LoggerFactory.getLogger(RuleApplier.class);
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    /** How the Setup pages name a priority, which is what a rule's "Priority is ..." condition compares with. */
    private static final Map<String, String> PRIORITY_LABEL = Map.of(
            "CRITICAL", "1 - Critical", "HIGH", "2 - High", "MEDIUM", "3 - Moderate", "LOW", "4 - Low");

    private final RuleEngine engine;
    private final DexGroupRepository groups;
    /** Looked up when a rule mails a group, so creating a ticket never depends on the groups feature starting first. */
    private final ObjectProvider<GroupService> groupService;
    private final MailEventNotificationService mail;

    public RuleApplier(RuleEngine engine, DexGroupRepository groups, ObjectProvider<GroupService> groupService, MailEventNotificationService mail) {
        this.engine = engine;
        this.groups = groups;
        this.groupService = groupService;
        this.mail = mail;
    }

    /**
     * Runs the rules on a new ticket before it is saved: they can set its priority, group, assignee and state, or stop it
     * being created (a {@link ValidationException} then tells the person which rule did). {@code formFacts} are what only the
     * form knows (subcategory, impact, urgency, channel, the group picked); anything the ticket itself holds is read from it.
     */
    public RuleEngine.Outcome apply(ItsmTicket ticket, Map<String, String> formFacts) {
        Map<String, String> facts = new HashMap<>();
        facts.put("channel", ticket.getSource() == null ? "" : "EMAIL".equalsIgnoreCase(ticket.getSource()) ? "Email" : ticket.getSource());
        facts.put("priority", PRIORITY_LABEL.getOrDefault(String.valueOf(ticket.getPriority()), ""));
        if (formFacts != null) formFacts.forEach((k, v) -> { if (v != null && !v.isBlank()) facts.put(k, v); });
        facts.put("category", orEmpty(ticket.getCategory()));
        facts.put("shortDescription", orEmpty(ticket.getTitle()));
        facts.put("description", orEmpty(ticket.getDescription()));
        facts.put("requesterEmail", orEmpty(ticket.getRequester()));

        RuleEngine.Outcome outcome = engine.run(facts);
        if (outcome.abortedBy != null) {
            List<String> notes = outcome.messages.stream().map(RuleEngine::messageText).toList();
            throw new ValidationException("The incident was not created: business rule “" + outcome.abortedBy + "” stops it."
                    + (notes.isEmpty() ? "" : " " + String.join(" ", notes)));
        }
        if (outcome.priority != null) ticket.setPriority(outcome.priority);
        if (outcome.assignedTo != null && (ticket.getAssignedTo() == null || ticket.getAssignedTo().isBlank())) ticket.setAssignedTo(outcome.assignedTo);
        if (outcome.groupId != null) {
            DexGroup group = groups.findById(outcome.groupId).filter(g -> "ACTIVE".equals(g.getStatus())).orElse(null);
            if (group != null) {
                ticket.setAssignmentGroupId(group.getId());
                ticket.setAssignmentGroup(group.getName());
            } else {
                logger.warn("Business rule assigns group {} but it is missing or inactive; left unassigned", outcome.groupId);
            }
        }
        if (outcome.state != null) ticket.setStatus(ItsmTicketStatus.valueOf(outcome.state));
        return outcome;
    }

    /** "Email the members of a group" actions: mails those groups about the ticket once it is saved. A failure never undoes the ticket. */
    public void mailGroups(ItsmTicket saved, RuleEngine.Outcome outcome) {
        if (outcome.emailGroupIds.isEmpty()) return;
        try {
            Set<String> to = new LinkedHashSet<>();
            for (Long id : outcome.emailGroupIds) {
                for (GroupType section : new GroupType[] {GroupType.TECHNICIAN, GroupType.USER}) {
                    groupService.getObject().people(id, section).stream().filter(GroupService.PersonMember::enabled)
                            .map(p -> p.email() == null ? "" : p.email().trim()).filter(e -> EMAIL.matcher(e).matches()).forEach(to::add);
                }
            }
            if (!to.isEmpty()) mail.ticketRuleMail(saved, String.join(", ", outcome.matched), List.copyOf(to));
        } catch (RuntimeException e) {
            logger.warn("Could not mail the groups named by business rules for ticket {}: {}", saved.getTicketCode(), e.getMessage());
        }
    }

    private static String orEmpty(String s) {
        return s == null ? "" : s;
    }
}
