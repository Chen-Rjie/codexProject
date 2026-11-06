#!/usr/bin/env node

import { accessSync, constants, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const projectRoot = path.resolve(import.meta.dirname, '..')
const toolsRoot = path.join(projectRoot, '.tools')
const settingsPath = path.join(projectRoot, 'backend', '.mvn', 'settings.xml')

function directoriesIn(directory) {
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(directory, entry.name))
  } catch {
    return []
  }
}

function findJavaHome() {
  for (const candidate of directoriesIn(path.join(toolsRoot, 'jdk'))) {
    try {
      accessSync(path.join(candidate, 'bin', process.platform === 'win32' ? 'java.exe' : 'java'), constants.X_OK)
      return candidate
    } catch {
      // Continue with the next unpacked JDK.
    }
  }
  return process.env.JAVA_HOME
}

function findMaven() {
  for (const candidate of directoriesIn(path.join(toolsRoot, 'maven'))) {
    const executable = path.join(candidate, 'bin', process.platform === 'win32' ? 'mvn.cmd' : 'mvn')
    try {
      accessSync(executable, constants.X_OK)
      return executable
    } catch {
      // Continue with the next unpacked Maven distribution.
    }
  }
  return process.platform === 'win32' ? 'mvn.cmd' : 'mvn'
}

const javaHome = findJavaHome()
const mavenExecutable = findMaven()
const javaBin = javaHome ? path.join(javaHome, 'bin') : ''
const mavenBin = path.isAbsolute(mavenExecutable) ? path.dirname(mavenExecutable) : ''
const env = {
  ...process.env,
  ...(javaHome ? { JAVA_HOME: javaHome } : {}),
  PATH: [javaBin, mavenBin, process.env.PATH].filter(Boolean).join(path.delimiter),
}

const result = spawnSync(
  mavenExecutable,
  ['-s', settingsPath, '-f', path.join(projectRoot, 'backend', 'pom.xml'), ...process.argv.slice(2)],
  {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
    shell: false,
  },
)

if (result.error) {
  console.error(`无法启动 Maven：${result.error.message}`)
  process.exit(1)
}

process.exit(result.status ?? 1)

