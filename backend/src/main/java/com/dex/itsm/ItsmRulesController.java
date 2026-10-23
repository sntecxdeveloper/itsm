package com.dex.itsm;

import com.dex.dto.common.ApiResponse;
import com.dex.exception.ValidationException;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Console settings for the ticket workflow: business rules and SLA targets. Changing them is for admins. */
@RestController
@RequestMapping("/api/v1/itsm")
public class ItsmRulesController {

    private final BusinessRuleService rules;
    private final SlaService sla;

    public ItsmRulesController(BusinessRuleService rules, SlaService sla) {
        this.rules = rules;
        this.sla = sla;
    }

    @GetMapping("/business-rules")
    public ResponseEntity<ApiResponse<List<BusinessRule>>> listRules() {
        return ResponseEntity.ok(ApiResponse.success(rules.list()));
    }

    /** The group to pre-fill when a category is picked on the new-incident form; null data means show the group list. */
    @GetMapping("/business-rules/suggest-group")
    public ResponseEntity<ApiResponse<Map<String, Object>>> suggestGroup(@RequestParam String category) {
        Map<String, Object> group = rules.suggestGroup(category)
                .<Map<String, Object>>map(g -> Map.of("id", g.getId(), "name", g.getName()))
                .orElse(null);
        return ResponseEntity.ok(ApiResponse.success(group));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/business-rules")
    public ResponseEntity<ApiResponse<BusinessRule>> createRule(@Valid @RequestBody BusinessRule rule) {
        return ResponseEntity.ok(ApiResponse.success("Created", rules.create(rule)));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/business-rules/{id}")
    public ResponseEntity<ApiResponse<BusinessRule>> updateRule(@PathVariable Long id, @Valid @RequestBody BusinessRule rule) {
        return ResponseEntity.ok(ApiResponse.success("Updated", rules.update(id, rule)));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @DeleteMapping("/business-rules/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteRule(@PathVariable Long id) {
        rules.delete(id);
        return ResponseEntity.ok(ApiResponse.success("Deleted", null));
    }

    @GetMapping("/sla-policies")
    public ResponseEntity<ApiResponse<List<SlaPolicy>>> listPolicies() {
        return ResponseEntity.ok(ApiResponse.success(sla.list()));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/sla-policies/{priority}")
    public ResponseEntity<ApiResponse<SlaPolicy>> updatePolicy(@PathVariable String priority, @RequestBody Map<String, Integer> body) {
        Integer response = body.get("responseMinutes");
        Integer resolution = body.get("resolutionMinutes");
        if (response == null || resolution == null) throw new ValidationException("responseMinutes and resolutionMinutes are required");
        return ResponseEntity.ok(ApiResponse.success("Updated", sla.update(priority, response, resolution)));
    }

    /** Switches one priority's SLA on or off; an off policy starts no clock on new tickets. */
    @PreAuthorize("hasRole('ADMIN')")
    @PatchMapping("/sla-policies/{priority}/enabled")
    public ResponseEntity<ApiResponse<SlaPolicy>> setPolicyEnabled(@PathVariable String priority, @RequestBody Map<String, Boolean> body) {
        Boolean enabled = body.get("enabled");
        if (enabled == null) throw new ValidationException("enabled is required");
        return ResponseEntity.ok(ApiResponse.success(enabled ? "Turned on" : "Turned off", sla.setEnabled(priority, enabled)));
    }
}
