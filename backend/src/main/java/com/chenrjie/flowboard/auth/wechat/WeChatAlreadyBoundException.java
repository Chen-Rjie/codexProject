package com.chenrjie.flowboard.auth.wechat;

public class WeChatAlreadyBoundException extends RuntimeException {

    public WeChatAlreadyBoundException() {
        super("该微信已经绑定其他账号");
    }
}
