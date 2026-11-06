FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build

COPY backend/pom.xml backend/pom.xml
COPY backend/.mvn/settings.xml backend/.mvn/settings.xml
RUN mvn -f backend/pom.xml -s backend/.mvn/settings.xml -B dependency:go-offline

COPY backend/src backend/src
RUN mvn -f backend/pom.xml -s backend/.mvn/settings.xml -B package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app

RUN groupadd --system app && useradd --system --gid app app
COPY --from=build /build/backend/target/flowboard-api-0.1.0.jar app.jar
COPY backend/certs/digicert-global-root-g2.crt digicert-global-root-g2.crt
COPY backend/certs/digicert-secure-site-ov-g2-intermediate.crt digicert-secure-site-ov-g2-intermediate.crt
RUN cp "$JAVA_HOME/lib/security/cacerts" truststore.p12 \
    && keytool -importcert -noprompt -alias digicert-global-root-g2 \
       -file digicert-global-root-g2.crt -keystore truststore.p12 -storepass changeit \
    && keytool -importcert -noprompt -alias digicert-secure-site-ov-g2-intermediate \
       -file digicert-secure-site-ov-g2-intermediate.crt -keystore truststore.p12 -storepass changeit

USER app
EXPOSE 4000
ENV SPRING_PROFILES_ACTIVE="cloud"
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -Dcom.sun.security.enableAIAcaIssuers=true -Djavax.net.ssl.trustStore=/app/truststore.p12 -Djavax.net.ssl.trustStorePassword=changeit -Djavax.net.ssl.trustStoreType=PKCS12"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
