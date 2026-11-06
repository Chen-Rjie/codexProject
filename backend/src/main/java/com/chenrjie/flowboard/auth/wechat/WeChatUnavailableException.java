package com.chenrjie.flowboard.auth.wechat;

public class WeChatUnavailableException extends RuntimeException {

    public WeChatUnavailableException() {
        super("微信登录尚未配置 AppID 或 AppSecret");
    }
}
