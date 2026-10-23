package com.dex.entity;

import com.dex.enums.ItsmTicketStatus;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "itsm_tickets")
public class ItsmTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String ticketCode;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "issue_id")
    private Issue issue;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ItsmTicketStatus status;

    private String priority;

    private String assignedTo;

    /** The group this ticket is assigned to; any technician in it can handle the ticket. See V39__itsm_groups.sql. */
    @Column(name = "assignment_group_id")
    private Long assignmentGroupId;

    @Column(name = "assignment_group", length = 100)
    private String assignmentGroup;

    private String category;

    /** Who asked (the person at the device, or the console user) and from which device - set for tickets the assistant raises. */
    @Column(length = 100)
    private String requester;

    @Column(name = "agent_id", length = 100)
    private String agentId;

    /** Where it came from, e.g. AI_TASK. */
    @Column(length = 30)
    private String source;

    @Column(columnDefinition = "TEXT")
    private String resolution;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    /** SLA deadlines worked out when the ticket is raised, and whether they were missed. See V44__itsm_rules_and_sla.sql. */
    @Column(name = "response_due_at")
    private LocalDateTime responseDueAt;

    @Column(name = "resolution_due_at")
    private LocalDateTime resolutionDueAt;

    @Column(name = "first_response_at")
    private LocalDateTime firstResponseAt;

    @Column(name = "response_breached", nullable = false)
    private boolean responseBreached;

    @Column(name = "resolution_breached", nullable = false)
    private boolean resolutionBreached;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    /** Values of the custom fields administrators defined (JSON: field key -> value); see CustomFieldService. */
    @Column(name = "custom_values", columnDefinition = "TEXT")
    private String customValues;

    public String getCustomValues() { return customValues; }
    public void setCustomValues(String customValues) { this.customValues = customValues; }

    public ItsmTicket() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTicketCode() { return ticketCode; }
    public void setTicketCode(String ticketCode) { this.ticketCode = ticketCode; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Issue getIssue() { return issue; }
    public void setIssue(Issue issue) { this.issue = issue; }
    public ItsmTicketStatus getStatus() { return status; }
    public void setStatus(ItsmTicketStatus status) { this.status = status; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getAssignedTo() { return assignedTo; }
    public void setAssignedTo(String assignedTo) { this.assignedTo = assignedTo; }
    public Long getAssignmentGroupId() { return assignmentGroupId; }
    public void setAssignmentGroupId(Long assignmentGroupId) { this.assignmentGroupId = assignmentGroupId; }
    public String getAssignmentGroup() { return assignmentGroup; }
    public void setAssignmentGroup(String assignmentGroup) { this.assignmentGroup = assignmentGroup; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getRequester() { return requester; }
    public void setRequester(String requester) { this.requester = requester; }
    public String getAgentId() { return agentId; }
    public void setAgentId(String agentId) { this.agentId = agentId; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public String getResolution() { return resolution; }
    public void setResolution(String resolution) { this.resolution = resolution; }
    public LocalDateTime getClosedAt() { return closedAt; }
    public void setClosedAt(LocalDateTime closedAt) { this.closedAt = closedAt; }
    public LocalDateTime getResponseDueAt() { return responseDueAt; }
    public void setResponseDueAt(LocalDateTime responseDueAt) { this.responseDueAt = responseDueAt; }
    public LocalDateTime getResolutionDueAt() { return resolutionDueAt; }
    public void setResolutionDueAt(LocalDateTime resolutionDueAt) { this.resolutionDueAt = resolutionDueAt; }
    public LocalDateTime getFirstResponseAt() { return firstResponseAt; }
    public void setFirstResponseAt(LocalDateTime firstResponseAt) { this.firstResponseAt = firstResponseAt; }
    public boolean isResponseBreached() { return responseBreached; }
    public void setResponseBreached(boolean responseBreached) { this.responseBreached = responseBreached; }
    public boolean isResolutionBreached() { return resolutionBreached; }
    public void setResolutionBreached(boolean resolutionBreached) { this.resolutionBreached = resolutionBreached; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
