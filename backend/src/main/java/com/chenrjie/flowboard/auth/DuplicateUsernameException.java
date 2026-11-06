package com.chenrjie.flowboard.auth;

public class DuplicateUsernameException extends RuntimeException {

    public DuplicateUsernameException() {
        super("该用户名已被使用");
    }
}

