package com.dex.dto.itsm;

import com.dex.enums.ItsmTicketStatus;

import java.time.LocalDateTime;

public class ItsmTicketResponse {

    private Long id;
    private String ticketCode;
    private String title;
    private String description;
    private Long issueId;
    private String issueCode;
    private ItsmTicketStatus status;
    private String priority;
    private String assignedTo;
    private String category;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String requester;
    private Long assignmentGroupId;
    private String assignmentGroup;
    private String agentId;
    private String source;
    private String resolution;
    private LocalDateTime closedAt;
    private LocalDateTime responseDueAt;
    private LocalDateTime resolutionDueAt;
    private LocalDateTime firstResponseAt;
    private boolean responseBreached;
    private boolean resolutionBreached;
    /** Values of the custom fields (field key -> value). */
    private java.util.Map<String, Object> customValues;

    public java.util.Map<String, Object> getCustomValues() { return customValues; }
    public void setCustomValues(java.util.Map<String, Object> customValues) { this.customValues = customValues; }

    public ItsmTicketResponse() {}

    public ItsmTicketResponse(Long id, String ticketCode, String title, String description,
                              Long issueId, String issueCode, ItsmTicketStatus status,
                              String priority, String assignedTo, String category,
                              LocalDateTime createdAt, LocalDateTime updatedAt) {
        this.id = id;
        this.ticketCode = ticketCode;
        this.title = title;
        this.description = description;
        this.issueId = issueId;
        this.issueCode = issueCode;
        this.status = status;
        this.priority = priority;
        this.assignedTo = assignedTo;
        this.category = category;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTicketCode() { return ticketCode; }
    public void setTicketCode(String ticketCode) { this.ticketCode = ticketCode; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Long getIssueId() { return issueId; }
    public void setIssueId(Long issueId) { this.issueId = issueId; }
    public String getIssueCode() { return issueCode; }
    public void setIssueCode(String issueCode) { this.issueCode = issueCode; }
    public ItsmTicketStatus getStatus() { return status; }
    public void setStatus(ItsmTicketStatus status) { this.status = status; }
    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }
    public String getAssignedTo() { return assignedTo; }
    public void setAssignedTo(String assignedTo) { this.assignedTo = assignedTo; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Long getAssignmentGroupId() { return assignmentGroupId; }
    public void setAssignmentGroupId(Long assignmentGroupId) { this.assignmentGroupId = assignmentGroupId; }
    public String getAssignmentGroup() { return assignmentGroup; }
    public void setAssignmentGroup(String assignmentGroup) { this.assignmentGroup = assignmentGroup; }
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
    public void setResponseDueAt(LocalDateTime v) { this.responseDueAt = v; }
    public LocalDateTime getResolutionDueAt() { return resolutionDueAt; }
    public void setResolutionDueAt(LocalDateTime v) { this.resolutionDueAt = v; }
    public LocalDateTime getFirstResponseAt() { return firstResponseAt; }
    public void setFirstResponseAt(LocalDateTime v) { this.firstResponseAt = v; }
    public boolean isResponseBreached() { return responseBreached; }
    public void setResponseBreached(boolean v) { this.responseBreached = v; }
    public boolean isResolutionBreached() { return resolutionBreached; }
    public void setResolutionBreached(boolean v) { this.resolutionBreached = v; }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private Long id;
        private String ticketCode;
        private String title;
        private String description;
        private Long issueId;
        private String issueCode;
        private ItsmTicketStatus status;
        private String priority;
        private String assignedTo;
        private String category;
        private LocalDateTime createdAt;
        private LocalDateTime updatedAt;

        public Builder id(Long id) { this.id = id; return this; }
        public Builder ticketCode(String ticketCode) { this.ticketCode = ticketCode; return this; }
        public Builder title(String title) { this.title = title; return this; }
        public Builder description(String description) { this.description = description; return this; }
        public Builder issueId(Long issueId) { this.issueId = issueId; return this; }
        public Builder issueCode(String issueCode) { this.issueCode = issueCode; return this; }
        public Builder status(ItsmTicketStatus status) { this.status = status; return this; }
        public Builder priority(String priority) { this.priority = priority; return this; }
        public Builder assignedTo(String assignedTo) { this.assignedTo = assignedTo; return this; }
        public Builder category(String category) { this.category = category; return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public Builder updatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; return this; }

        public ItsmTicketResponse build() {
            return new ItsmTicketResponse(id, ticketCode, title, description, issueId, issueCode,
                    status, priority, assignedTo, category, createdAt, updatedAt);
        }
    }
}
