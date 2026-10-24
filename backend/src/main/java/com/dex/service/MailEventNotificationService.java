package com.dex.service;

import com.dex.entity.ItsmTicket;
import com.dex.enums.ItsmTicketStatus;
import com.dex.repository.ItsmTicketRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class MailEventNotificationService {

    private static final Logger logger = LoggerFactory.getLogger(MailEventNotificationService.class);
    private static final long SLA_WARNING_HOURS = 1;
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{\\s*([\\w.]+)\\s*\\}\\}");

    private final MailSettingsService settings;
    private final ResendEmailService email;
    private final ItsmTicketRepository tickets;
    private final JdbcTemplate jdbc;

    public MailEventNotificationService(
            MailSettingsService settings,
            ResendEmailService email,
            ItsmTicketRepository tickets,
            JdbcTemplate jdbc
    ) {
        this.settings = settings;
        this.email = email;
        this.tickets = tickets;
        this.jdbc = jdbc;
    }

    public void ticketCreated(ItsmTicket ticket) {
        sendEvent("created", "Ticket created", ticket);
    }

    public void ticketAssigned(ItsmTicket ticket) {
        sendEvent("assigned", "Ticket assigned", ticket);
    }

    /** Mails every given member of the group the ticket was just assigned to, each in their own mail. */
    public void ticketAssignedToGroup(Long ticketId, String groupName, List<String> recipients) {
        if (!settings.shouldNotify("assigned") || recipients.isEmpty()) return;
        tickets.findById(ticketId).ifPresent(ticket -> {
            String label = "Ticket assigned to group " + groupName;
            String note = "<p><strong>Sent to " + recipients.size() + (recipients.size() == 1 ? " person" : " people")
                    + ":</strong> " + escapeHtml(String.join(", ", recipients)) + "</p>";
            String error = email.sendShared(new MailRecipients(recipients, List.of(), List.of()),
                    "DEX " + label + ": " + ticket.getTicketCode(), ticketHtml(label, ticket, note));
            if (error != null) logger.error("Could not send {} email for ticket {}: {}", label, ticket.getTicketCode(), error);
        });
    }

    /** Mails the people a business rule named ("Email the members of a group") about the ticket it just matched. */
    public void ticketRuleMail(ItsmTicket ticket, String ruleNames, List<String> recipients) {
        if (recipients.isEmpty()) return;
        String label = "Ticket created";
        String note = "<p><strong>Sent by business rule:</strong> " + escapeHtml(ruleNames) + "</p>";
        String error = email.sendShared(new MailRecipients(recipients, List.of(), List.of()),
                "DEX " + label + ": " + ticket.getTicketCode(), ticketHtml(label, ticket, note));
        if (error != null) logger.error("Could not send the business rule email for ticket {}: {}", ticket.getTicketCode(), error);
    }

    public void ticketUpdated(ItsmTicket ticket) {
        sendEvent("updated", "Ticket updated", ticket);
    }

    private void sendEvent(String event, String label, ItsmTicket ticket) {
        if (!settings.shouldNotify(event)) return;
        sendToConfiguredRecipients(label, ticket);
    }

    @Scheduled(fixedDelayString = "${mail-settings.sla-check-interval-ms:60000}")
    public void sendApproachingSlaReminders() {
        if (!settings.shouldNotify("sla")) return;
        List<String> recipients = settings.notificationRecipients();
        if (recipients.isEmpty()) return;

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime warningWindowEnd = now.plusHours(SLA_WARNING_HOURS);
        for (ItsmTicket ticket : tickets.findByStatusInAndCreatedAtAfter(
                List.of(ItsmTicketStatus.OPEN, ItsmTicketStatus.IN_PROGRESS), now.minusHours(73))) {
            if (ticket.getId() == null || ticket.getCreatedAt() == null
                    || reminderAlreadySent(ticket.getId())) {
                continue;
            }
            LocalDateTime dueAt = ticket.getResolutionDueAt() != null ? ticket.getResolutionDueAt()
                    : ticket.getCreatedAt().plusHours(slaHours(ticket.getPriority()));
            if (dueAt.isAfter(now) && !dueAt.isAfter(warningWindowEnd)
                    && sendToConfiguredRecipients("SLA approaching", ticket, recipients)) {
                jdbc.update("INSERT INTO mail_sla_reminders_sent (ticket_id) VALUES (?)", ticket.getId());
            }
        }
    }

    private boolean reminderAlreadySent(long ticketId) {
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM mail_sla_reminders_sent WHERE ticket_id = ?",
                Integer.class, ticketId);
        return count != null && count > 0;
    }

    private void sendToConfiguredRecipients(String label, ItsmTicket ticket) {
        sendToConfiguredRecipients(label, ticket, settings.notificationRecipients());
    }

    private boolean sendToConfiguredRecipients(String label, ItsmTicket ticket, List<String> recipients) {
        if (recipients.isEmpty()) {
            logger.warn("Mail notification {} skipped for {}: no notification recipients configured",
                    label, ticket.getTicketCode());
            return false;
        }

        String subject = "DEX " + label + ": " + ticket.getTicketCode();
        String body = ticketHtml(label, ticket, "");
        boolean allSent = true;
        for (String recipient : recipients) {
            try {
                String error = email.send(recipient, subject, body);
                if (error != null) {
                    allSent = false;
                    logger.error("Could not send {} email for ticket {} to {}: {}",
                            label, ticket.getTicketCode(), recipient, error);
                }
            } catch (RuntimeException error) {
                allSent = false;
                logger.error("Could not send {} email for ticket {} to {}",
                        label, ticket.getTicketCode(), recipient, error);
            }
        }
        return allSent;
    }

    private static String ticketHtml(String label, ItsmTicket ticket, String note) {
        String description = ticket.getDescription() == null ? "" : ticket.getDescription();
        return """
                <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">
                  <h2>%s</h2>
                  %s
                  <p><strong>Ticket:</strong> %s</p>
                  <p><strong>Title:</strong> %s</p>
                  <p><strong>Status:</strong> %s</p>
                  <p><strong>Priority:</strong> %s</p>
                  <p><strong>Assigned to:</strong> %s</p>
                  <p><strong>Description:</strong><br>%s</p>
                </div>
                """.formatted(escapeHtml(label), note, escapeHtml(ticket.getTicketCode()),
                escapeHtml(ticket.getTitle()), escapeHtml(String.valueOf(ticket.getStatus())),
                escapeHtml(ticket.getPriority()), escapeHtml(ticket.getAssignedTo()),
                escapeHtml(description).replace("\n", "<br>"));
    }

    /**
     * Fills a template with this ticket's own data and mails it. Ticket fields win over {@code extraVars}
     * (which carry values only the caller knows, such as a link). Unknown placeholders are left as written.
     * It goes out as one mail: people in To and CC see each other, BCC stays hidden. Reports how many it reached.
     */
    public record SendOutcome(int sent, int failed, String error) {}

    public SendOutcome sendTemplated(ItsmTicket ticket, MailRecipients recipients, String subjectTemplate,
                                String bodyTemplate, Map<String, String> extraVars) {
        Map<String, String> vars = new HashMap<>();
        if (extraVars != null) vars.putAll(extraVars);
        vars.put("ticket.id", ticket.getTicketCode());
        vars.put("ticket.title", ticket.getTitle());
        vars.put("ticket.description", ticket.getDescription());
        vars.put("ticket.priority", ticket.getPriority());
        vars.put("ticket.status", String.valueOf(ticket.getStatus()));
        vars.put("ticket.category", ticket.getCategory());
        vars.put("ticket.assignedTo", ticket.getAssignedTo());
        if (ticket.getAssignedTo() != null) vars.putIfAbsent("technician.name", ticket.getAssignedTo());
        if (ticket.getRequester() != null) vars.put("requester.name", ticket.getRequester());
        addCalculatedVars(vars, ticket);
        String subject = render(subjectTemplate, vars);
        if (bodyTemplate.startsWith(ResendEmailService.HTML_MARKER)) {
            // Values go into HTML, so escape them (the template's own markup stays as written).
            vars.replaceAll((key, value) -> value == null ? null : escapeHtml(value));
        }
        String body = render(bodyTemplate, vars);
        String failure = email.sendTemplateShared(recipients, subject, body);
        return failure == null
                ? new SendOutcome(recipients.count(), 0, null)
                : new SendOutcome(0, recipients.count(), failure);
    }

    private static final java.time.format.DateTimeFormatter PLACEHOLDER_TIME =
            java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    /** The rest of the ticket's data, and the SLA figures worked out from it, for use as placeholders. */
    private static void addCalculatedVars(Map<String, String> vars, ItsmTicket ticket) {
        vars.put("ticket.requester", ticket.getRequester());
        vars.put("ticket.source", ticket.getSource());
        vars.put("ticket.resolution", ticket.getResolution());
        vars.put("ticket.assignmentGroup", ticket.getAssignmentGroup());
        vars.put("ticket.agentId", ticket.getAgentId());
        vars.put("ticket.createdAt", formatTime(ticket.getCreatedAt()));
        vars.put("ticket.updatedAt", formatTime(ticket.getUpdatedAt()));
        vars.put("ticket.closedAt", formatTime(ticket.getClosedAt()));
        vars.put("sla.responseDueAt", formatTime(ticket.getResponseDueAt()));
        vars.put("sla.resolutionDueAt", formatTime(ticket.getResolutionDueAt()));
        vars.put("sla.firstResponseAt", formatTime(ticket.getFirstResponseAt()));
        vars.put("sla.responseBreached", String.valueOf(ticket.isResponseBreached()));
        vars.put("sla.resolutionBreached", String.valueOf(ticket.isResolutionBreached()));
        vars.put("sla.timeToResolution", timeLeft(ticket.getResolutionDueAt()));
        vars.put("sla.timeToResponse", ticket.getFirstResponseAt() != null ? "responded" : timeLeft(ticket.getResponseDueAt()));
        if (ticket.getCreatedAt() != null) {
            LocalDateTime end = ticket.getClosedAt() != null ? ticket.getClosedAt() : LocalDateTime.now();
            vars.put("ticket.ageHours", String.valueOf(java.time.Duration.between(ticket.getCreatedAt(), end).toHours()));
        }
    }

    private static String formatTime(LocalDateTime time) {
        return time == null ? null : time.format(PLACEHOLDER_TIME);
    }

    /** "3h 20m left", or "overdue by 1h 5m"; null when there is no due time. */
    private static String timeLeft(LocalDateTime due) {
        if (due == null) return null;
        java.time.Duration left = java.time.Duration.between(LocalDateTime.now(), due);
        java.time.Duration abs = left.abs();
        String span = abs.toHours() + "h " + abs.toMinutesPart() + "m";
        return left.isNegative() ? "overdue by " + span : span + " left";
    }

    private static String render(String template, Map<String, String> vars) {
        Matcher matcher = PLACEHOLDER.matcher(template);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            String value = vars.get(matcher.group(1));
            matcher.appendReplacement(out, Matcher.quoteReplacement(value != null ? value : matcher.group()));
        }
        matcher.appendTail(out);
        return out.toString();
    }

    private static int slaHours(String priority) {
        if (priority == null) return 24;
        return switch (priority.toUpperCase(Locale.ROOT)) {
            case "CRITICAL" -> 4;
            case "HIGH" -> 8;
            case "LOW" -> 72;
            default -> 24;
        };
    }

    private static String escapeHtml(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
