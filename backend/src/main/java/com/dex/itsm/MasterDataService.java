package com.dex.itsm;

import com.dex.exception.ValidationException;
import com.dex.service.SetupSettingsService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * The ITSM master data: Category &gt; Subcategory &gt; Item lists, the assignment group that handles each category or subcategory, and
 * the impact x urgency priority table. They live in the database (V57__itsm_master_data.sql) so every browser, mail-to-ticket and the
 * API see the same lists. Groups travel by name (the Setup pages work with names) and are stored by id. Nothing is built in: the lists
 * come from Setup → Categories (typed in or imported from Excel).
 */
@Service
public class MasterDataService {

    private static final Logger logger = LoggerFactory.getLogger(MasterDataService.class);
    private static final int MAX_CATEGORIES = 200;
    private static final int MAX_SUBCATEGORIES = 500;
    private static final int MAX_ITEMS = 500;

    public record Sub(String name, String group, List<String> items) {}
    public record Cat(String name, String group, List<Sub> subcategories) {}
    public record Level(String impact, String urgency, String priority) {}
    public record Master(List<Cat> categories, List<Level> priorityMatrix) {}

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final SetupSettingsService settings;

    public MasterDataService(JdbcTemplate jdbc, ObjectMapper mapper, SetupSettingsService settings) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.settings = settings;
    }

    @Transactional(readOnly = true)
    public Master get() {
        Map<Long, Cat> cats = new LinkedHashMap<>();
        Map<Long, Sub> subs = new HashMap<>();
        jdbc.query("SELECT c.id, c.name, g.name FROM itsm_categories c LEFT JOIN dex_groups g ON g.id = c.assignment_group_id ORDER BY c.sort_order, c.id",
                rs -> { cats.put(rs.getLong(1), new Cat(rs.getString(2), rs.getString(3), new ArrayList<>())); });
        jdbc.query("SELECT s.id, s.category_id, s.name, g.name FROM itsm_subcategories s LEFT JOIN dex_groups g ON g.id = s.assignment_group_id ORDER BY s.sort_order, s.id",
                rs -> {
                    Cat cat = cats.get(rs.getLong(2));
                    if (cat == null) return;
                    Sub sub = new Sub(rs.getString(3), rs.getString(4), new ArrayList<>());
                    subs.put(rs.getLong(1), sub);
                    cat.subcategories().add(sub);
                });
        jdbc.query("SELECT subcategory_id, name FROM itsm_items ORDER BY sort_order, id", rs -> {
            Sub sub = subs.get(rs.getLong(1));
            if (sub != null) sub.items().add(rs.getString(2));
        });
        List<Level> matrix = jdbc.query("SELECT impact, urgency, priority FROM itsm_priority_matrix ORDER BY impact, urgency",
                (rs, i) -> new Level(rs.getString(1), rs.getString(2), rs.getString(3)));
        return new Master(new ArrayList<>(cats.values()), matrix);
    }

    /** Replaces the whole master with what the Setup page saved. A null priority table leaves the saved one alone. */
    @Transactional
    public Master replace(Master master) {
        if (master == null || master.categories() == null) throw new ValidationException("categories are required");
        validate(master);
        Map<String, Long> groupIds = new HashMap<>();
        jdbc.query("SELECT id, name FROM dex_groups", rs -> { groupIds.put(rs.getString(2).toLowerCase(Locale.ROOT), rs.getLong(1)); });

        jdbc.update("DELETE FROM itsm_categories"); // subcategories and items go with them
        int categoryOrder = 0;
        for (Cat cat : master.categories()) {
            long categoryId = insert("INSERT INTO itsm_categories (name, sort_order, assignment_group_id) VALUES (?, ?, ?)",
                    cat.name().trim(), categoryOrder++, groupId(groupIds, cat.group()));
            int subOrder = 0;
            for (Sub sub : cat.subcategories() == null ? List.<Sub>of() : cat.subcategories()) {
                long subId = insert("INSERT INTO itsm_subcategories (category_id, name, sort_order, assignment_group_id) VALUES (?, ?, ?, ?)",
                        categoryId, sub.name().trim(), subOrder++, groupId(groupIds, sub.group()));
                int itemOrder = 0;
                for (String item : sub.items() == null ? List.<String>of() : sub.items()) {
                    jdbc.update("INSERT INTO itsm_items (subcategory_id, name, sort_order) VALUES (?, ?, ?)", subId, item.trim(), itemOrder++);
                }
            }
        }
        if (master.priorityMatrix() != null && !master.priorityMatrix().isEmpty()) {
            jdbc.update("DELETE FROM itsm_priority_matrix");
            for (Level l : master.priorityMatrix()) {
                jdbc.update("INSERT INTO itsm_priority_matrix (impact, urgency, priority) VALUES (?, ?, ?)", l.impact().trim(), l.urgency().trim(), l.priority().trim());
            }
        }
        return get();
    }

    /**
     * The group that handles a category: the subcategory's own group, else the category's. Null when none is set, so the ticket
     * stays unassigned. Names match without regard to case.
     */
    @Transactional(readOnly = true)
    public Long groupFor(String category, String subcategory) {
        if (category == null || category.isBlank()) return null;
        List<Long> found = jdbc.query(
                "SELECT COALESCE(s.assignment_group_id, c.assignment_group_id) FROM itsm_categories c "
                        + "LEFT JOIN itsm_subcategories s ON s.category_id = c.id AND LOWER(s.name) = ? WHERE LOWER(c.name) = ?",
                (rs, i) -> { long id = rs.getLong(1); return rs.wasNull() ? null : id; },
                subcategory == null ? "" : subcategory.trim().toLowerCase(Locale.ROOT), category.trim().toLowerCase(Locale.ROOT));
        return found.isEmpty() ? null : found.get(0);
    }

    /**
     * Fills the master the first time the server starts, from the Setup settings an administrator already saved (categories, issues,
     * categoryGroups) so nothing they set up is lost. With none saved the lists stay empty until they are imported from Excel.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void seedIfEmpty() {
        try {
            Integer existing = jdbc.queryForObject("SELECT COUNT(*) FROM itsm_categories", Integer.class);
            if (existing != null && existing > 0) return;
            Master saved = fromSettings();
            if (saved.categories().isEmpty()) return;
            replace(saved);
            logger.info("ITSM master data filled with {} categories from the saved Setup lists", saved.categories().size());
        } catch (RuntimeException e) {
            // The lists are an aid for the forms: the server still starts without them.
            logger.error("ITSM master data could not be filled: {}", e.getMessage(), e);
        }
    }

    /** The categories an administrator already saved under Setup (categories, issues, categoryGroups), if any. */
    private Master fromSettings() {
        JsonNode categories = settings.get("categories").orElse(null);
        if (categories == null || !categories.isArray()) return new Master(List.of(), null);
        JsonNode issues = settings.get("issues").orElse(null);
        JsonNode groups = settings.get("categoryGroups").orElse(null);

        List<Cat> out = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (JsonNode c : categories) {
            String name = c.path("name").asText("").trim();
            if (name.isEmpty() || !seen.add(name.toLowerCase(Locale.ROOT))) continue;
            List<Sub> subs = new ArrayList<>();
            Set<String> seenSubs = new LinkedHashSet<>();
            for (JsonNode s : c.path("subcategories")) {
                String sub = s.asText("").trim();
                if (sub.isEmpty() || !seenSubs.add(sub.toLowerCase(Locale.ROOT))) continue;
                List<String> items = new ArrayList<>();
                if (issues != null && issues.path(sub).isArray()) issues.path(sub).forEach(n -> items.add(n.asText("")));
                subs.add(new Sub(sub, groupName(groups, name + "::" + sub), distinct(items)));
            }
            out.add(new Cat(name, groupName(groups, name), subs));
        }
        return new Master(out, null);
    }

    private static String groupName(JsonNode groups, String key) {
        if (groups == null) return null;
        String name = groups.path(key).asText("").trim();
        return name.isEmpty() ? null : name;
    }

    private static void validate(Master master) {
        if (master.categories().size() > MAX_CATEGORIES) throw new ValidationException("Too many categories (" + MAX_CATEGORIES + " at most)");
        Set<String> names = new LinkedHashSet<>();
        for (Cat cat : master.categories()) {
            String name = name(cat == null ? null : cat.name(), 100, "A category");
            if (!names.add(name.toLowerCase(Locale.ROOT))) throw new ValidationException("The category \"" + name + "\" is listed twice");
            List<Sub> subs = cat.subcategories() == null ? List.of() : cat.subcategories();
            if (subs.size() > MAX_SUBCATEGORIES) throw new ValidationException("Too many subcategories in \"" + name + "\"");
            Set<String> subNames = new LinkedHashSet<>();
            for (Sub sub : subs) {
                String subName = name(sub == null ? null : sub.name(), 100, "A subcategory of \"" + name + "\"");
                if (!subNames.add(subName.toLowerCase(Locale.ROOT))) throw new ValidationException("The subcategory \"" + subName + "\" is listed twice in \"" + name + "\"");
                List<String> items = sub.items() == null ? List.of() : sub.items();
                if (items.size() > MAX_ITEMS) throw new ValidationException("Too many items in \"" + subName + "\"");
                Set<String> itemNames = new LinkedHashSet<>();
                for (String item : items) {
                    String itemName = name(item, 200, "An item of \"" + subName + "\"");
                    if (!itemNames.add(itemName.toLowerCase(Locale.ROOT))) throw new ValidationException("The item \"" + itemName + "\" is listed twice in \"" + subName + "\"");
                }
            }
        }
        if (master.priorityMatrix() != null) {
            Set<String> pairs = new LinkedHashSet<>();
            for (Level l : master.priorityMatrix()) {
                String impact = name(l == null ? null : l.impact(), 30, "An impact");
                String urgency = name(l.urgency(), 30, "An urgency");
                name(l.priority(), 30, "A priority");
                if (!pairs.add(impact + "|" + urgency)) throw new ValidationException("Impact \"" + impact + "\" and urgency \"" + urgency + "\" are listed twice");
            }
        }
    }

    private static String name(String value, int max, String what) {
        String v = value == null ? "" : value.trim();
        if (v.isEmpty()) throw new ValidationException(what + " needs a name");
        if (v.length() > max) throw new ValidationException(what + " is too long (" + max + " characters at most)");
        return v;
    }

    private static List<String> distinct(List<String> items) {
        Set<String> seen = new LinkedHashSet<>();
        List<String> out = new ArrayList<>();
        for (String i : items) {
            String t = i == null ? "" : i.trim();
            if (!t.isEmpty() && seen.add(t.toLowerCase(Locale.ROOT))) out.add(t);
        }
        return out;
    }

    private static Long groupId(Map<String, Long> ids, String name) {
        return name == null || name.isBlank() ? null : ids.get(name.trim().toLowerCase(Locale.ROOT));
    }

    private long insert(String sql, Object... args) {
        KeyHolder keys = new GeneratedKeyHolder();
        jdbc.update(con -> {
            PreparedStatement ps = con.prepareStatement(sql, new String[] {"id"});
            for (int i = 0; i < args.length; i++) ps.setObject(i + 1, args[i]);
            return ps;
        }, keys);
        Number key = keys.getKey();
        if (key == null) throw new IllegalStateException("The database did not return the new id");
        return key.longValue();
    }
}
