package com.dex.itsm;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

/** A ticket business rule: when the conditions match a new ticket, set its priority and/or group. See V44__itsm_rules_and_sla.sql. */
@Entity
@Table(name = "itsm_business_rules")
public class BusinessRule {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @NotBlank(message = "name is required") @Column(nullable = false, length = 100) private String name;
    @Column(nullable = false) private Boolean enabled = true;
    @Column(name = "sort_order", nullable = false) private Integer sortOrder = 100;
    @Column(name = "match_category", length = 100) private String matchCategory;
    @Column(name = "match_keyword", length = 100) private String matchKeyword;
    @Column(name = "match_source", length = 30) private String matchSource;
    @Column(name = "set_priority", length = 20) private String setPriority;
    @Column(name = "set_group_id") private Long setGroupId;
    @Column(name = "set_group_name", length = 100) private String setGroupName;
    @CreationTimestamp @Column(name = "created_at", updatable = false) private LocalDateTime createdAt;
    @UpdateTimestamp @Column(name = "updated_at") private LocalDateTime updatedAt;

    public BusinessRule() {}
    public Long getId() { return id; } public void setId(Long id) { this.id = id; }
    public String getName() { return name; } public void setName(String name) { this.name = name; }
    public Boolean getEnabled() { return enabled; } public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    public Integer getSortOrder() { return sortOrder; } public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    public String getMatchCategory() { return matchCategory; } public void setMatchCategory(String v) { this.matchCategory = v; }
    public String getMatchKeyword() { return matchKeyword; } public void setMatchKeyword(String v) { this.matchKeyword = v; }
    public String getMatchSource() { return matchSource; } public void setMatchSource(String v) { this.matchSource = v; }
    public String getSetPriority() { return setPriority; } public void setSetPriority(String v) { this.setPriority = v; }
    public Long getSetGroupId() { return setGroupId; } public void setSetGroupId(Long v) { this.setGroupId = v; }
    public String getSetGroupName() { return setGroupName; } public void setSetGroupName(String v) { this.setGroupName = v; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
