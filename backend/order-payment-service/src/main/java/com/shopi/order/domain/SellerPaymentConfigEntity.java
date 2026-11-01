package com.shopi.order.domain;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "seller_payment_configs", indexes = {
        @Index(name = "idx_seller_payment_seller_id", columnList = "seller_id", unique = true)
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SellerPaymentConfigEntity {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(name = "seller_id", nullable = false, unique = true)
    private UUID sellerId;

    @Column(name = "bank_name", length = 100)
    private String bankName;

    @Column(name = "account_number", length = 50)
    private String accountNumber;

    @Column(name = "account_holder", length = 100)
    private String accountHolder;

    @Column(name = "sepay_api_key", length = 255)
    private String sepayApiKey;

    @Column(name = "sepay_webhook_token", length = 255)
    private String sepayWebhookToken;

    @Column(name = "test_mode", nullable = false)
    @Builder.Default
    private Boolean testMode = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    public void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
        if (testMode == null) {
            testMode = true;
        }
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = Instant.now();
    }
}
