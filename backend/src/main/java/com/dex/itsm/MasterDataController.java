package com.dex.itsm;

import com.dex.dto.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The category, subcategory, item, assignment-group and priority lists the incident forms use. Everyone signed in reads them; changing them is for admins. */
@RestController
@RequestMapping("/api/v1/itsm/master")
public class MasterDataController {

    private final MasterDataService master;

    public MasterDataController(MasterDataService master) {
        this.master = master;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<MasterDataService.Master>> get() {
        return ResponseEntity.ok(ApiResponse.success(master.get()));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping
    public ResponseEntity<ApiResponse<MasterDataService.Master>> save(@RequestBody MasterDataService.Master body) {
        return ResponseEntity.ok(ApiResponse.success("Saved", master.replace(body)));
    }
}
