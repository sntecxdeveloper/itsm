package com.dex.controller;

import com.dex.access.AccessCatalog;
import com.dex.access.AccessService;
import com.dex.dto.common.ApiResponse;
import com.dex.service.AuditLogService;
import com.dex.service.SetupSettingsService;
import com.fasterxml.jackson.databind.JsonNode;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * The settings under Setup. Everyone signed in reads them (the forms need them). Changing one needs the matching "edit"
 * action of its Setup section (see AccessCatalog): administrators have all of them, a named role gets the sections an
 * administrator gave it. A setting no section covers can only be changed by an administrator.
 */
@RestController
@Tag(name = "Setup settings", description = "Categories, items, channels and the other settings kept under Setup")
public class SetupSettingsController {

    private final SetupSettingsService settings;
    private final AuditLogService auditLogService;
    private final AccessService access;

    public SetupSettingsController(SetupSettingsService settings, AuditLogService auditLogService, AccessService access) {
        this.settings = settings;
        this.auditLogService = auditLogService;
        this.access = access;
    }

    @Operation(summary = "Every saved Setup setting, by key")
    @GetMapping("/api/v1/setup/settings")
    public ResponseEntity<ApiResponse<Map<String, JsonNode>>> getAll() {
        return ResponseEntity.ok(ApiResponse.success(settings.getAll()));
    }

    @Operation(summary = "Save one Setup setting (needs the edit right of its Setup section)")
    @PutMapping("/api/v1/setup/settings/{key}")
    public ResponseEntity<ApiResponse<Void>> save(@PathVariable String key, @RequestBody JsonNode value, Authentication auth) {
        requireEdit("PUT", key, auth);
        settings.put(key, value, currentUser());
        auditLogService.logCurrentUser("SETUP_SETTING_SET", "SetupSetting", null, "Changed setting " + key);
        return ResponseEntity.ok(ApiResponse.success("Setting saved", null));
    }

    @Operation(summary = "Remove one Setup setting so the built-in default is used again (needs the edit right of its Setup section)")
    @DeleteMapping("/api/v1/setup/settings/{key}")
    public ResponseEntity<ApiResponse<Void>> reset(@PathVariable String key, Authentication auth) {
        requireEdit("DELETE", key, auth);
        settings.delete(key);
        auditLogService.logCurrentUser("SETUP_SETTING_RESET", "SetupSetting", null, "Reset setting " + key);
        return ResponseEntity.ok(ApiResponse.success("Setting reset", null));
    }

    private void requireEdit(String method, String key, Authentication auth) {
        AccessCatalog.Item item = AccessCatalog.match(method, "/api/v1/setup/settings/" + key);
        boolean allowed = item == null ? auth.getAuthorities().stream().anyMatch(g -> "ROLE_ADMIN".equals(g.getAuthority())) : access.allowed(auth, item.key());
        if (!allowed) throw new AccessDeniedException("Your role does not include changing this setting. Ask an administrator.");
    }

    private String currentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null ? auth.getName() : "unknown";
    }
}
