package com.chenrjie.flowboard.auth;

public class RegistrationDisabledException extends RuntimeException {

    public RegistrationDisabledException() {
        super("当前系统未开放注册");
    }
}

