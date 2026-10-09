# Third-Party Notices

PaperIsle's original project code is licensed under the MIT License in `LICENSE`. This does not change the separate license terms of third-party components included in the Android application or repository.

## Android runtime dependencies

The following coordinates were resolved for the 1.1.0 Android runtime dependency graph. Their applicable license is the Apache License, Version 2.0; a copy is included at [`third_party/licenses/Apache-2.0.txt`](third_party/licenses/Apache-2.0.txt).

| Maven coordinate | Notes |
|---|---|
| `androidx.annotation:annotation:1.8.1` | AndroidX |
| `androidx.annotation:annotation-experimental:1.4.1` | AndroidX |
| `androidx.annotation:annotation-jvm:1.8.1` | AndroidX |
| `androidx.arch.core:core-common:2.2.0` | AndroidX |
| `androidx.arch.core:core-runtime:2.2.0` | AndroidX |
| `androidx.collection:collection:1.4.2` | AndroidX |
| `androidx.collection:collection-jvm:1.4.2` | AndroidX |
| `androidx.concurrent:concurrent-futures:1.1.0` | AndroidX |
| `androidx.core:core:1.15.0` | Direct application dependency; AndroidX |
| `androidx.interpolator:interpolator:1.0.0` | AndroidX |
| `androidx.lifecycle:lifecycle-common:2.6.2` | AndroidX |
| `androidx.lifecycle:lifecycle-runtime:2.6.2` | AndroidX |
| `androidx.profileinstaller:profileinstaller:1.3.0` | AndroidX |
| `androidx.startup:startup-runtime:1.1.1` | AndroidX |
| `androidx.tracing:tracing:1.2.0` | AndroidX |
| `androidx.versionedparcelable:versionedparcelable:1.1.1` | AndroidX |
| `com.google.guava:listenablefuture:1.0` | Guava Authors; its Maven POM omits a license field, but the published 1.0 source JAR's `ListenableFuture.java` header identifies Apache License 2.0 and Copyright (C) 2007 The Guava Authors. |
| `org.jetbrains:annotations:13.0` | JetBrains annotations |
| `org.jetbrains.kotlin:kotlin-stdlib:1.8.22` | Kotlin |
| `org.jetbrains.kotlin:kotlin-stdlib-common:1.8.22` | Kotlin |
| `org.jetbrains.kotlinx:kotlinx-coroutines-android:1.6.4` | kotlinx.coroutines |
| `org.jetbrains.kotlinx:kotlinx-coroutines-bom:1.6.4` | Dependency constraints/BOM metadata; not an executable library. |
| `org.jetbrains.kotlinx:kotlinx-coroutines-core:1.6.4` | kotlinx.coroutines |
| `org.jetbrains.kotlinx:kotlinx-coroutines-core-jvm:1.6.4` | kotlinx.coroutines |

Gradle's resolved Maven POM metadata declares Apache License 2.0 for the other listed runtime coordinates. The MIT license applies only to PaperIsle's own original work; third-party notices and license terms must be preserved when redistributing those components.

## Repository build tooling

The repository contains the Gradle Wrapper JAR associated with Gradle 8.9. Gradle's upstream project is Apache License 2.0; see the included Apache license copy and the official [Gradle 8.9 license](https://github.com/gradle/gradle/blob/v8.9.0/LICENSE). The Android Gradle Plugin 8.7.3 is resolved as build tooling and is not an application runtime dependency.

## Upstream references

- [MIT License text (Open Source Initiative)](https://opensource.org/license/mit)
- [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0.txt)
- [Google Guava upstream license](https://github.com/google/guava/blob/master/LICENSE)
- [Published `listenablefuture:1.0` source JAR](https://repo1.maven.org/maven2/com/google/guava/listenablefuture/1.0/listenablefuture-1.0-sources.jar)
- [Gradle 8.9 upstream license](https://github.com/gradle/gradle/blob/v8.9.0/LICENSE)
