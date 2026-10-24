package com.dex.itsm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RuleEngineTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private static JsonNode rules(String json) throws Exception {
        return JSON.readTree(json);
    }

    private static String rule(String name, int order, String conditions, String rest) {
        return "{\"name\":\"" + name + "\",\"enabled\":true,\"order\":" + order + ",\"events\":{\"insert\":true},\"match\":\"all\","
                + "\"conditions\":[" + conditions + "]," + rest + "}";
    }

    private static final String NETWORK = "{\"field\":\"category\",\"op\":\"is\",\"value\":\"Network\"}";

    @Test
    void matchingRuleSetsFieldsAndNonMatchingRuleDoesNot() throws Exception {
        JsonNode r = rules("[" + rule("net", 100, NETWORK,
                "\"actions\":[{\"type\":\"SET_PRIORITY\",\"value\":\"high\"},{\"type\":\"ASSIGN_GROUP\",\"value\":\"7\"},{\"type\":\"SET_STATE\",\"value\":\"IN_PROGRESS\"},{\"type\":\"ASSIGN_TO\",\"value\":\"alice\"}]") + "]");
        RuleEngine.Outcome hit = RuleEngine.evaluate(r, Map.of("category", " network "));
        assertEquals("HIGH", hit.priority);
        assertEquals(7L, hit.groupId);
        assertEquals("IN_PROGRESS", hit.state);
        assertEquals("alice", hit.assignedTo);
        assertEquals(1, hit.matched.size());
        RuleEngine.Outcome miss = RuleEngine.evaluate(r, Map.of("category", "Software"));
        assertNull(miss.priority);
        assertTrue(miss.matched.isEmpty());
    }

    @Test
    void laterRuleOverridesAndStopEndsTheRun() throws Exception {
        String actionLow = "\"actions\":[{\"type\":\"SET_PRIORITY\",\"value\":\"LOW\"}]";
        String actionCritical = "\"actions\":[{\"type\":\"SET_PRIORITY\",\"value\":\"CRITICAL\"}]";
        JsonNode r = rules("[" + rule("second", 200, NETWORK, actionCritical) + "," + rule("first", 100, NETWORK, actionLow) + "]");
        assertEquals("CRITICAL", RuleEngine.evaluate(r, Map.of("category", "Network")).priority);
        JsonNode stopped = rules("[" + rule("first", 100, NETWORK, actionLow + ",\"stop\":true") + "," + rule("second", 200, NETWORK, actionCritical) + "]");
        assertEquals("LOW", RuleEngine.evaluate(stopped, Map.of("category", "Network")).priority);
    }

    @Test
    void abortAndMessagesAreReported() throws Exception {
        JsonNode r = rules("[" + rule("block", 100, "{\"field\":\"shortDescription\",\"op\":\"contains\",\"value\":\"test\"}",
                "\"addMessage\":true,\"message\":\"<!--html--><p>Do not raise tests</p>\",\"abort\":true,\"actions\":[]") + "]");
        RuleEngine.Outcome out = RuleEngine.evaluate(r, Map.of("shortDescription", "This is a TEST"));
        assertEquals("block", out.abortedBy);
        assertEquals("Do not raise tests", RuleEngine.messageText(out.messages.get(0)));
    }

    @Test
    void anyMatchNeedsOneConditionAndDisabledOrNonInsertRulesAreSkipped() throws Exception {
        String two = NETWORK + ",{\"field\":\"channel\",\"op\":\"is\",\"value\":\"Email\"}";
        JsonNode any = rules("[" + rule("r", 100, two, "\"match\":\"any\",\"actions\":[{\"type\":\"SET_PRIORITY\",\"value\":\"LOW\"}]") + "]");
        assertEquals("LOW", RuleEngine.evaluate(any, Map.of("category", "Hardware", "channel", "email")).priority);
        JsonNode off = rules("[{\"name\":\"x\",\"enabled\":false,\"events\":{\"insert\":true},\"conditions\":[],\"actions\":[{\"type\":\"SET_PRIORITY\",\"value\":\"LOW\"}]},"
                + "{\"name\":\"y\",\"enabled\":true,\"events\":{\"update\":true},\"conditions\":[],\"actions\":[{\"type\":\"SET_PRIORITY\",\"value\":\"LOW\"}]}]");
        assertTrue(RuleEngine.evaluate(off, Map.of()).matched.isEmpty());
    }

    @Test
    void emptyOrMissingRulesChangeNothing() throws Exception {
        assertTrue(RuleEngine.evaluate(null, Map.of()).matched.isEmpty());
        assertTrue(RuleEngine.evaluate(rules("{}"), Map.of()).matched.isEmpty());
        JsonNode badPriority = rules("[" + rule("r", 100, "", "\"actions\":[{\"type\":\"SET_PRIORITY\",\"value\":\"URGENT\"},{\"type\":\"SET_STATE\",\"value\":\"NOPE\"}]") + "]");
        RuleEngine.Outcome out = RuleEngine.evaluate(badPriority, Map.of());
        assertNull(out.priority);
        assertNull(out.state);
    }
}
