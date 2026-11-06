FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

COPY pom.xml .
COPY .mvn/settings.xml .mvn/settings.xml
RUN mvn -s .mvn/settings.xml -B dependency:go-offline

COPY src src
RUN mvn -s .mvn/settings.xml -B package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app

RUN groupadd --system app && useradd --system --gid app app
COPY --from=build /build/target/flowboard-api-0.1.0.jar app.jar

USER app
EXPOSE 4000
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
