package com.dex.itsm;

import jakarta.persistence.*;

/** Response and resolution targets, in minutes, for one ticket priority. */
@Entity
@Table(name = "itsm_sla_policies")
public class SlaPolicy {
    @Id @Column(length = 20) private String priority;
    @Column(name = "response_minutes", nullable = false) private Integer responseMinutes;
    @Column(name = "resolution_minutes", nullable = false) private Integer resolutionMinutes;
    /** Off: new tickets of this priority start no SLA clock. */
    @Column(nullable = false) private Boolean enabled = true;

    public SlaPolicy() {}
    public String getPriority() { return priority; } public void setPriority(String priority) { this.priority = priority; }
    public Integer getResponseMinutes() { return responseMinutes; } public void setResponseMinutes(Integer v) { this.responseMinutes = v; }
    public Boolean getEnabled() { return enabled; } public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    public Integer getResolutionMinutes() { return resolutionMinutes; } public void setResolutionMinutes(Integer v) { this.resolutionMinutes = v; }
}
