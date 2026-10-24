package com.dex.service;

import com.dex.exception.ValidationException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/** The settings an administrator keeps under Setup: one JSON document per key, shared by everyone. */
@Service
public class SetupSettingsService {

    private static final Pattern KEY = Pattern.compile("^[a-zA-Z0-9._-]{1,100}$");
    private static final int MAX_BYTES = 512 * 1024;

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;

    public SetupSettingsService(JdbcTemplate jdbc, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.mapper = mapper;
    }

    /** Every saved setting by key. A document that cannot be read back is left out rather than failing the whole call. */
    public Map<String, JsonNode> getAll() {
        Map<String, JsonNode> out = new LinkedHashMap<>();
        jdbc.query("SELECT setting_key, value_json FROM setup_settings ORDER BY setting_key", rs -> {
            try {
                out.put(rs.getString(1), mapper.readTree(rs.getString(2)));
            } catch (JsonProcessingException ignored) {
                // a damaged row: skip it, the caller falls back to its defaults
            }
        });
        return out;
    }

    /** One saved setting, or empty when it was never saved or cannot be read back. */
    public java.util.Optional<JsonNode> get(String key) {
        checkKey(key);
        return jdbc.query("SELECT value_json FROM setup_settings WHERE setting_key = ?", rs -> {
            if (!rs.next()) return java.util.Optional.<JsonNode>empty();
            try {
                return java.util.Optional.of(mapper.readTree(rs.getString(1)));
            } catch (JsonProcessingException e) {
                return java.util.Optional.<JsonNode>empty();
            }
        }, key);
    }

    @Transactional
    public void put(String key, JsonNode value, String user) {
        checkKey(key);
        if (value == null || value.isNull()) {
            throw new ValidationException("A setting needs a value");
        }
        String json;
        try {
            json = mapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new ValidationException("The setting is not valid JSON");
        }
        if (json.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > MAX_BYTES) {
            throw new ValidationException("The setting is too large");
        }
        jdbc.update(
                "INSERT INTO setup_settings (setting_key, value_json, updated_by, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) "
                        + "ON CONFLICT (setting_key) DO UPDATE SET value_json = EXCLUDED.value_json, updated_by = EXCLUDED.updated_by, updated_at = CURRENT_TIMESTAMP",
                key, json, user);
    }

    @Transactional
    public void delete(String key) {
        checkKey(key);
        jdbc.update("DELETE FROM setup_settings WHERE setting_key = ?", key);
    }

    private static void checkKey(String key) {
        if (key == null || !KEY.matcher(key).matches()) {
            throw new ValidationException("Invalid setting name");
        }
    }
}
