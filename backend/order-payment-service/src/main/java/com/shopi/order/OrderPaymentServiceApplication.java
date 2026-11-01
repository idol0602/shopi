package com.shopi.order;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class OrderPaymentServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(OrderPaymentServiceApplication.class, args);
    }
}
