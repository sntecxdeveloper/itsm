package com.dex.itsm;

import com.dex.entity.ItsmTicket;
import com.dex.exception.ResourceNotFoundException;
import com.dex.exception.ValidationException;
import com.dex.groups.DexGroup;
import com.dex.groups.DexGroupMemberRepository;
import com.dex.groups.DexGroupRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

@Service
public class BusinessRuleService {

    private static final Set<String> PRIORITIES = Set.of("CRITICAL", "HIGH", "MEDIUM", "LOW");

    private final BusinessRuleRepository rules;
    private final DexGroupRepository groups;
    private final DexGroupMemberRepository members;

    public BusinessRuleService(BusinessRuleRepository rules, DexGroupRepository groups, DexGroupMemberRepository members) {
        this.rules = rules;
        this.groups = groups;
        this.members = members;
    }

    /** Sets priority and group on a new ticket from the first enabled rule that matches; no match leaves it as is. */
    public void apply(ItsmTicket ticket) {
        for (BusinessRule rule : rules.findByEnabledTrueOrderBySortOrderAscIdAsc()) {
            if (!matches(rule, ticket)) continue;
            if (rule.getSetPriority() != null) ticket.setPriority(rule.getSetPriority());
            if (usableGroup(rule)) {
                ticket.setAssignmentGroupId(rule.getSetGroupId());
                ticket.setAssignmentGroup(rule.getSetGroupName());
            }
            return;
        }
    }

    /**
     * The group the new-incident form should pre-fill for a category: the group of the first enabled rule that matches
     * the category, provided that group is active and has members. Empty means the form shows the full group list.
     */
    @Transactional(readOnly = true)
    public Optional<DexGroup> suggestGroup(String category) {
        ItsmTicket probe = new ItsmTicket();
        probe.setCategory(category);
        for (BusinessRule rule : rules.findByEnabledTrueOrderBySortOrderAscIdAsc()) {
            if (rule.getSetGroupId() == null || blank(rule.getMatchCategory()) || !matches(rule, probe)) continue;
            if (usableGroup(rule)) return groups.findById(rule.getSetGroupId());
        }
        return Optional.empty();
    }

    /** A rule's group is only worth assigning while it is active and someone is in it. */
    private boolean usableGroup(BusinessRule rule) {
        if (rule.getSetGroupId() == null) return false;
        return groups.findById(rule.getSetGroupId()).map(g -> "ACTIVE".equals(g.getStatus())).orElse(false)
                && members.countByGroupId(rule.getSetGroupId()) > 0;
    }

    static boolean matches(BusinessRule rule, ItsmTicket ticket) {
        if (!blank(rule.getMatchCategory())) {
            // "Software" also matches the category "Software > Outlook"
            String category = ticket.getCategory() == null ? "" : ticket.getCategory().trim().toLowerCase(Locale.ROOT);
            String wanted = rule.getMatchCategory().trim().toLowerCase(Locale.ROOT);
            if (!category.equals(wanted) && !category.startsWith(wanted + " >") && !category.startsWith(wanted + "/")) return false;
        }
        if (!blank(rule.getMatchSource()) && !rule.getMatchSource().trim().equalsIgnoreCase(ticket.getSource())) return false;
        if (!blank(rule.getMatchKeyword())) {
            String text = ((ticket.getTitle() == null ? "" : ticket.getTitle()) + " "
                    + (ticket.getDescription() == null ? "" : ticket.getDescription())).toLowerCase(Locale.ROOT);
            if (!text.contains(rule.getMatchKeyword().trim().toLowerCase(Locale.ROOT))) return false;
        }
        return true;
    }

    @Transactional(readOnly = true)
    public List<BusinessRule> list() { return rules.findAllByOrderBySortOrderAscIdAsc(); }

    @Transactional
    public BusinessRule create(BusinessRule rule) {
        rule.setId(null);
        return rules.save(clean(rule));
    }

    @Transactional
    public BusinessRule update(Long id, BusinessRule body) {
        BusinessRule rule = rules.findById(id).orElseThrow(() -> new ResourceNotFoundException("BusinessRule", "id", id));
        body.setId(rule.getId());
        return rules.save(clean(body));
    }

    @Transactional
    public void delete(Long id) {
        if (!rules.existsById(id)) throw new ResourceNotFoundException("BusinessRule", "id", id);
        rules.deleteById(id);
    }

    private BusinessRule clean(BusinessRule rule) {
        rule.setName(rule.getName().trim());
        rule.setMatchCategory(trimOrNull(rule.getMatchCategory()));
        rule.setMatchKeyword(trimOrNull(rule.getMatchKeyword()));
        rule.setMatchSource(trimOrNull(rule.getMatchSource()));
        String priority = trimOrNull(rule.getSetPriority());
        if (priority != null) {
            priority = priority.toUpperCase(Locale.ROOT);
            if (!PRIORITIES.contains(priority)) throw new ValidationException("Priority must be CRITICAL, HIGH, MEDIUM or LOW");
        }
        rule.setSetPriority(priority);
        if (rule.getSetGroupId() != null) {
            DexGroup group = groups.findById(rule.getSetGroupId())
                    .orElseThrow(() -> new ResourceNotFoundException("Group", "id", rule.getSetGroupId()));
            if (!"ACTIVE".equals(group.getStatus())) throw new ValidationException("That group is inactive");
            rule.setSetGroupName(group.getName());
        } else {
            rule.setSetGroupName(null);
        }
        if (rule.getSetPriority() == null && rule.getSetGroupId() == null) {
            throw new ValidationException("A rule must set a priority, a group, or both");
        }
        if (rule.getEnabled() == null) rule.setEnabled(true);
        if (rule.getSortOrder() == null) rule.setSortOrder(100);
        return rule;
    }

    private static boolean blank(String s) { return s == null || s.isBlank(); }
    private static String trimOrNull(String s) { return blank(s) ? null : s.trim(); }
}
