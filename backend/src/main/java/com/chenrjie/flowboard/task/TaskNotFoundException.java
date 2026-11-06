package com.chenrjie.flowboard.task;

public class TaskNotFoundException extends RuntimeException {

    public TaskNotFoundException(Long id) {
        super("未找到任务：" + id);
    }
}

