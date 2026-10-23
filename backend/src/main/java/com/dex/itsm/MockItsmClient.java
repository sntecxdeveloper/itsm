package com.dex.itsm;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Mock ITSM client for development.
 * Stores tickets in-memory for testing.
 */
@Component
public class MockItsmClient implements ItsmClient {

    private static final Logger logger = LoggerFactory.getLogger(MockItsmClient.class);
    private final Map<String, ItsmTicket> tickets = new ConcurrentHashMap<>();
    private int ticketCounter = 1000;

    @Override
    public ItsmTicket createTicket(CreateTicketRequest request) {
        String id = "INC" + (++ticketCounter);
        String number = "INC-" + ticketCounter;

        var ticket = new ItsmTicket(
            id, number, request.title(), request.description(),
            "NEW", request.priority() != null ? request.priority() : "MEDIUM",
            request.assignedTo(), request.category(),
            java.time.LocalDateTime.now().toString(),
            java.time.LocalDateTime.now().toString()
        );

        tickets.put(id, ticket);
        logger.info("📋 Mock ITSM: Created ticket {} — {}", number, request.title());
        return ticket;
    }

    @Override
    public Optional<ItsmTicket> getTicket(String externalId) {
        return Optional.ofNullable(tickets.get(externalId));
    }

    @Override
    public ItsmTicket updateTicketStatus(String externalId, String status, String comment) {
        var existing = tickets.get(externalId);
        if (existing == null) throw new RuntimeException("Ticket not found: " + externalId);

        var updated = new ItsmTicket(
            existing.externalId(), existing.number(), existing.title(), existing.description(),
            status, existing.priority(), existing.assignedTo(), existing.category(),
            existing.createdAt(), java.time.LocalDateTime.now().toString()
        );

        tickets.put(externalId, updated);
        logger.info("📋 Mock ITSM: Updated ticket {} to {} — {}", externalId, status, comment);
        return updated;
    }

    @Override
    public void addComment(String externalId, String comment) {
        logger.info("📋 Mock ITSM: Added comment to ticket {}: {}", externalId, comment);
    }

    @Override
    public List<ItsmTicket> searchTickets(String query, int limit) {
        String lower = query.toLowerCase();
        return tickets.values().stream()
            .filter(t -> t.title().toLowerCase().contains(lower) || t.number().toLowerCase().contains(lower))
            .limit(limit)
            .toList();
    }

    @Override
    public boolean isHealthy() { return true; }

    @Override
    public String getProviderName() { return "Mock ITSM"; }
}
