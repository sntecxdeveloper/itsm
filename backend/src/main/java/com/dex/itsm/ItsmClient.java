package com.dex.itsm;

import java.util.List;
import java.util.Optional;

/**
 * Interface for ITSM integrations (ServiceNow, Jira, ManageEngine).
 * Implementations handle API communication with the ITSM platform.
 */
public interface ItsmClient {

    /**
     * Create a new ticket in the ITSM system.
     */
    ItsmTicket createTicket(CreateTicketRequest request);

    /**
     * Get a ticket by its external ID.
     */
    Optional<ItsmTicket> getTicket(String externalId);

    /**
     * Update ticket status.
     */
    ItsmTicket updateTicketStatus(String externalId, String status, String comment);

    /**
     * Add a comment to a ticket.
     */
    void addComment(String externalId, String comment);

    /**
     * Search tickets by query.
     */
    List<ItsmTicket> searchTickets(String query, int limit);

    /**
     * Check if the ITSM connection is healthy.
     */
    boolean isHealthy();

    /**
     * Get the provider name (e.g., "ServiceNow", "Jira").
     */
    String getProviderName();

    // ── DTOs ──

    record ItsmTicket(
        String externalId,
        String number,
        String title,
        String description,
        String status,
        String priority,
        String assignedTo,
        String category,
        String createdAt,
        String updatedAt
    ) {}

    record CreateTicketRequest(
        String title,
        String description,
        String priority,
        String category,
        String assignedTo,
        String relatedIssueCode,
        String agentId
    ) {}
}
