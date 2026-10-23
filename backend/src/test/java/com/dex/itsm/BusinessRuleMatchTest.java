package com.dex.itsm;

import com.dex.entity.ItsmTicket;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BusinessRuleMatchTest {

    private static ItsmTicket ticket(String title, String category, String source) {
        ItsmTicket t = new ItsmTicket();
        t.setTitle(title);
        t.setCategory(category);
        t.setSource(source);
        return t;
    }

    @Test
    void categoryMatchesItselfAndItsChildren() {
        BusinessRule rule = new BusinessRule();
        rule.setMatchCategory("Software");
        assertTrue(BusinessRuleService.matches(rule, ticket("x", "Software", null)));
        assertTrue(BusinessRuleService.matches(rule, ticket("x", "Software > Outlook", null)));
        assertFalse(BusinessRuleService.matches(rule, ticket("x", "Hardware", null)));
        assertFalse(BusinessRuleService.matches(rule, ticket("x", null, null)));
    }

    @Test
    void keywordAndSourceMustBothMatch() {
        BusinessRule rule = new BusinessRule();
        rule.setMatchKeyword("outlook");
        rule.setMatchSource("EMAIL");
        assertTrue(BusinessRuleService.matches(rule, ticket("Outlook is not opening", null, "EMAIL")));
        assertFalse(BusinessRuleService.matches(rule, ticket("Outlook is not opening", null, "AI_TASK")));
        assertFalse(BusinessRuleService.matches(rule, ticket("Printer jam", null, "EMAIL")));
    }

    @Test
    void emptyConditionsMatchEverything() {
        assertTrue(BusinessRuleService.matches(new BusinessRule(), ticket("anything", null, null)));
    }
}
