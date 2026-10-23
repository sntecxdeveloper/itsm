package com.dex.itsm;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BusinessRuleRepository extends JpaRepository<BusinessRule, Long> {
    List<BusinessRule> findAllByOrderBySortOrderAscIdAsc();
    List<BusinessRule> findByEnabledTrueOrderBySortOrderAscIdAsc();
}
