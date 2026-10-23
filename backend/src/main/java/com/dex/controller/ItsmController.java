package com.dex.controller;

import com.dex.dto.common.ApiResponse;
import com.dex.dto.itsm.ItsmTicketResponse;
import com.dex.service.ItsmService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import com.dex.exception.ResourceNotFoundException;
import com.dex.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/itsm")
@Tag(name = "ITSM", description = "IT Service Management ticket endpoints")
public class ItsmController {

    private static final org.slf4j.Logger logger = org.slf4j.LoggerFactory.getLogger(ItsmController.class);

    private final ItsmService itsmService;

    private final UserRepository userRepository;

    @org.springframework.beans.factory.annotation.Autowired
    private com.dex.groups.DexGroupRepository groups;

    @org.springframework.beans.factory.annotation.Autowired
    private com.dex.groups.DexGroupMemberRepository groupMembers;

    @org.springframework.beans.factory.annotation.Autowired
    private com.dex.groups.GroupService groupService;

    @org.springframework.beans.factory.annotation.Autowired
    private com.dex.service.MailEventNotificationService mailNotifications;

    @org.springframework.beans.factory.annotation.Autowired
    private com.dex.customfields.CustomFieldService customFields;

    private static String roleOf() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return null;
        return auth.getAuthorities().stream().map(a -> a.getAuthority()).filter(a -> a.startsWith("ROLE_")).findFirst().orElse(null);
    }

    public ItsmController(ItsmService itsmService, UserRepository userRepository) {
        this.itsmService = itsmService;
        this.userRepository = userRepository;
    }

    /** Admins see every ticket; everyone else sees unassigned tickets and the ones assigned to them. */
    private boolean canSee(ItsmTicketResponse ticket) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null) return false;
        if (auth.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()))) return true;
        String assignee = ticket.getAssignedTo();
        // A ticket assigned to a group is seen by that group's technicians.
        if (ticket.getAssignmentGroupId() != null && auth.getName() != null
                && groupMembers.existsByGroupIdAndMemberTypeAndMemberKey(
                        ticket.getAssignmentGroupId(), com.dex.groups.GroupType.TECHNICIAN, auth.getName())) return true;
        if (assignee == null || assignee.isBlank()) return ticket.getAssignmentGroupId() == null;
        assignee = assignee.trim();
        if (assignee.equalsIgnoreCase(auth.getName())) return true;
        final String name = assignee;
        return userRepository.findByUsername(auth.getName())
                .map(u -> name.equalsIgnoreCase(u.getFullName()) || name.equalsIgnoreCase(u.getEmail()))
                .orElse(false);
    }

    private void requireVisible(Long id) {
        // Reported as not found so a hidden ticket is indistinguishable from a missing one.
        if (!canSee(itsmService.getTicketById(id))) throw new ResourceNotFoundException("ItsmTicket", "id", id);
    }

    @Operation(summary = "Get all tickets", description = "Retrieve all ITSM tickets, optionally filtered by the originating issue")
    @GetMapping("/tickets")
    public ResponseEntity<ApiResponse<List<ItsmTicketResponse>>> getAllTickets(
            @RequestParam(required = false) Long issueId) {
        List<ItsmTicketResponse> tickets = itsmService.getAllTickets(issueId).stream().filter(this::canSee).toList();
        return ResponseEntity.ok(ApiResponse.success(tickets));
    }

    @GetMapping("/tickets/{id}")
    public ResponseEntity<ApiResponse<ItsmTicketResponse>> getTicketById(@PathVariable Long id) {
        ItsmTicketResponse ticket = itsmService.getTicketById(id);
        if (!canSee(ticket)) throw new ResourceNotFoundException("ItsmTicket", "id", id);
        return ResponseEntity.ok(ApiResponse.success(ticket));
    }

    @Operation(summary = "Update ticket status", description = "Change the status of an ITSM ticket")
    @PatchMapping("/tickets/{id}/status")
    public ResponseEntity<ApiResponse<ItsmTicketResponse>> updateTicketStatus(
            @PathVariable Long id, @RequestBody Map<String, String> body) {
        requireVisible(id);
        String status = body.get("status");
        ItsmTicketResponse ticket = itsmService.updateTicketStatus(id, status);
        return ResponseEntity.ok(ApiResponse.success("Ticket status updated", ticket));
    }

    @Operation(summary = "Create ticket", description = "Escalate into a new ITSM ticket. " +
            "Pass an issueId to auto-attach issue context, or supply title/description directly.")
    @PostMapping("/tickets")
    public ResponseEntity<ApiResponse<ItsmTicketResponse>> createTicket(
            @RequestBody Map<String, Object> body) {
        Long issueId = body.get("issueId") != null ? Long.valueOf(body.get("issueId").toString()) : null;
        ItsmTicketResponse ticket = itsmService.createTicket(
                issueId,
                body.get("title") != null ? body.get("title").toString() : null,
                body.get("description") != null ? body.get("description").toString() : null,
                body.get("priority") != null ? body.get("priority").toString() : null,
                body.get("category") != null ? body.get("category").toString() : null,
                body.get("assignedTo") != null ? body.get("assignedTo").toString() : null,
                body.get("requester") != null ? body.get("requester").toString() : null);
        if (body.get("assignmentGroupId") != null) {
            ticket = applyGroup(ticket.getId(), Long.valueOf(body.get("assignmentGroupId").toString()));
        }
        if (body.get("customValues") instanceof Map<?, ?> values) {
            @SuppressWarnings("unchecked") Map<String, Object> typed = (Map<String, Object>) values;
            customFields.saveForTicket(ticket.getId(), typed, roleOf(), SecurityContextHolder.getContext().getAuthentication().getName());
            ticket = itsmService.getTicketById(ticket.getId());
        }
        return ResponseEntity.ok(ApiResponse.success("Ticket created", ticket));
    }

    @Operation(summary = "Set the custom field values of a ticket", description = "Body: {\"values\": {\"asset_tag\": \"A-102\"}}. Every field the caller may see is set to what is sent (missing = empty).")
    @PatchMapping("/tickets/{id}/custom-fields")
    public ResponseEntity<ApiResponse<ItsmTicketResponse>> setCustomFields(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        requireVisible(id);
        Object values = body.get("values");
        @SuppressWarnings("unchecked") Map<String, Object> typed = values instanceof Map<?, ?> m ? (Map<String, Object>) m : Map.of();
        customFields.saveForTicket(id, typed, roleOf(), SecurityContextHolder.getContext().getAuthentication().getName());
        return ResponseEntity.ok(ApiResponse.success("Saved", itsmService.getTicketById(id)));
    }

    public record TicketEmailRequest(List<String> to, List<String> cc, List<String> bcc, String subject, String body, Map<String, String> vars) {}

    @Operation(summary = "Email a ticket", description = "Fills the given email template with this ticket's data and sends it to the recipients (or the requester)")
    @PostMapping("/tickets/{id}/email")
    public ResponseEntity<ApiResponse<Map<String, Integer>>> emailTicket(@PathVariable Long id, @RequestBody TicketEmailRequest request) {
        requireVisible(id);
        var outcome = itsmService.emailTicket(id, request.to(), request.cc(), request.bcc(), request.subject(), request.body(), request.vars());
        if (outcome.sent() == 0) throw new com.dex.exception.IntegrationException(outcome.error());
        String message = outcome.failed() == 0
                ? "Email sent to " + outcome.sent() + (outcome.sent() == 1 ? " person" : " people")
                : outcome.error();
        return ResponseEntity.ok(ApiResponse.success(message, Map.of("sent", outcome.sent(), "failed", outcome.failed())));
    }

    @Operation(summary = "Assign ticket to a group", description = "Any technician in the group can then see and handle the ticket; a null groupId clears it")
    @PatchMapping("/tickets/{id}/assign-group")
    public ResponseEntity<ApiResponse<ItsmTicketResponse>> assignGroup(
            @PathVariable Long id, @RequestBody Map<String, Object> body) {
        requireVisible(id);
        Object g = body.get("groupId");
        return ResponseEntity.ok(ApiResponse.success("Ticket assigned to group", applyGroup(id, g == null ? null : Long.valueOf(g.toString()))));
    }

    private ItsmTicketResponse applyGroup(Long ticketId, Long groupId) {
        if (groupId == null) return itsmService.assignToGroup(ticketId, null, null);
        com.dex.groups.DexGroup group = groups.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group", "id", groupId));
        if (!"ACTIVE".equals(group.getStatus())) throw new com.dex.exception.ValidationException("That group is inactive");
        Long previousGroupId = itsmService.getTicketById(ticketId).getAssignmentGroupId();
        ItsmTicketResponse assigned = itsmService.assignToGroup(ticketId, group.getId(), group.getName());
        if (!group.getId().equals(previousGroupId)) notifyGroup(ticketId, group);
        return assigned;
    }

    /** Tells the group's technicians, each by their own mail. A mail problem never blocks the assignment. */
    private void notifyGroup(Long ticketId, com.dex.groups.DexGroup group) {
        try {
            List<String> emails = groupService.people(group.getId(), com.dex.groups.GroupType.TECHNICIAN).stream()
                    .filter(com.dex.groups.GroupService.PersonMember::enabled)
                    .map(com.dex.groups.GroupService.PersonMember::email)
                    .filter(e -> e != null && !e.isBlank())
                    .distinct().toList();
            mailNotifications.ticketAssignedToGroup(ticketId, group.getName(), emails);
        } catch (RuntimeException e) {
            logger.warn("Could not email group {} about ticket {}", group.getName(), ticketId, e);
        }
    }

    @Operation(summary = "Assign ticket", description = "Assign a ticket to a technician")
    @PatchMapping("/tickets/{id}/assign")
    public ResponseEntity<ApiResponse<ItsmTicketResponse>> assignTicket(
            @PathVariable Long id, @RequestBody Map<String, String> body) {
        requireVisible(id);
        ItsmTicketResponse ticket = itsmService.assignTicket(id, body.get("assignedTo"));
        return ResponseEntity.ok(ApiResponse.success("Ticket assigned", ticket));
    }
}
