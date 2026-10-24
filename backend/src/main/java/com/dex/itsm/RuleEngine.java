package com.dex.itsm;

import com.dex.service.SetupSettingsService;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Runs the business rules an administrator builds under Setup → Business Rules when a ticket is raised, so they apply
 * however the ticket arrives (the New Incident page, an email, the API). The rules are the "businessRules" Setup setting;
 * this mirrors the evaluator the Setup page uses to preview them (src/utils/businessRules.ts).
 */
@Component
public class RuleEngine {

    public static final String SETTING_KEY = "businessRules";

    private static final Set<String> PRIORITIES = Set.of("CRITICAL", "HIGH", "MEDIUM", "LOW");
    private static final Set<String> STATES = Set.of("OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED");

    /** What the matched rules decided. Fields stay null/empty when no rule touched them. */
    public static class Outcome {
        public final List<String> matched = new ArrayList<>();
        public final List<String> messages = new ArrayList<>();
        public final Set<Long> emailGroupIds = new LinkedHashSet<>();
        public Long groupId;
        public String assignedTo;
        public String priority;
        public String state;
        public String abortedBy;
    }

    private final SetupSettingsService settings;

    public RuleEngine(SetupSettingsService settings) {
        this.settings = settings;
    }

    /** Runs the saved rules on an incident being created. Facts: category, subcategory, impact, urgency, priority, channel, assignmentGroup, shortDescription, description, requesterEmail. */
    public Outcome run(Map<String, String> facts) {
        return evaluate(settings.get(SETTING_KEY).orElse(null), facts);
    }

    /** Runs the enabled rules top to bottom (lowest order first); a later rule overrides an earlier one for the same field. */
    static Outcome evaluate(JsonNode rules, Map<String, String> facts) {
        Outcome out = new Outcome();
        if (rules == null || !rules.isArray()) return out;
        List<JsonNode> sorted = new ArrayList<>();
        rules.forEach(sorted::add);
        sorted.sort(Comparator.comparingInt(r -> r.path("order").asInt(100)));
        for (JsonNode rule : sorted) {
            if (!rule.path("enabled").asBoolean(true) || !rule.path("events").path("insert").asBoolean(false) || !matches(rule, facts)) continue;
            String name = rule.path("name").asText("");
            out.matched.add(name);
            if (rule.path("addMessage").asBoolean(false) && !messageText(rule.path("message").asText("")).isEmpty()) {
                out.messages.add(rule.path("message").asText());
            }
            if (rule.path("abort").asBoolean(false)) {
                out.abortedBy = name;
                break;
            }
            for (JsonNode action : rule.path("actions")) {
                String value = action.path("value").asText("").trim();
                if (value.isEmpty()) continue;
                switch (action.path("type").asText("")) {
                    case "ASSIGN_GROUP" -> out.groupId = parseId(value, out.groupId);
                    case "ASSIGN_TO" -> out.assignedTo = value;
                    case "SET_PRIORITY" -> {
                        String p = value.toUpperCase(Locale.ROOT);
                        if (PRIORITIES.contains(p)) out.priority = p;
                    }
                    case "SET_STATE" -> {
                        String s = value.toUpperCase(Locale.ROOT);
                        if (STATES.contains(s)) out.state = s;
                    }
                    case "EMAIL_GROUP" -> {
                        Long id = parseId(value, null);
                        if (id != null) out.emailGroupIds.add(id);
                    }
                    default -> { }
                }
            }
            if (rule.path("stop").asBoolean(false)) break;
        }
        return out;
    }

    static boolean matches(JsonNode rule, Map<String, String> facts) {
        JsonNode conditions = rule.path("conditions");
        if (!conditions.isArray() || conditions.isEmpty()) return true;
        boolean all = !"any".equals(rule.path("match").asText("all"));
        for (JsonNode c : conditions) {
            boolean hit = conditionMatches(c, facts);
            if (all && !hit) return false;
            if (!all && hit) return true;
        }
        return all;
    }

    static boolean conditionMatches(JsonNode c, Map<String, String> facts) {
        String actual = norm(facts.get(c.path("field").asText("")));
        String wanted = norm(c.path("value").asText(""));
        return switch (c.path("op").asText("")) {
            case "is" -> actual.equals(wanted);
            case "isNot" -> !actual.equals(wanted);
            case "contains" -> actual.contains(wanted);
            case "notContains" -> !actual.contains(wanted);
            case "isEmpty" -> actual.isEmpty();
            case "isNotEmpty" -> !actual.isEmpty();
            default -> false;
        };
    }

    /** The text of a rule message, which the editor stores as HTML after a marker. Empty when only markup is left. */
    static String messageText(String message) {
        return message.replaceFirst("^<!--html-->", "").replaceAll("<[^>]*>", "").replace("&nbsp;", " ").trim();
    }

    private static String norm(String s) {
        return s == null ? "" : s.trim().toLowerCase(Locale.ROOT);
    }

    private static Long parseId(String value, Long fallback) {
        try {
            return Long.valueOf(value);
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
