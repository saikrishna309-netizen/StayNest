# ============================================================================
# Stage 1: Build Spring Boot Backend with Maven & Java 21
# ============================================================================
FROM maven:3.9-eclipse-temurin-21-jammy AS build
WORKDIR /app

# Copy Maven pom.xml and settings.xml
COPY backend/pom.xml .
COPY backend/settings.xml* .

# Copy source code
COPY backend/src ./src

# Build production jar skipping tests for speed
RUN mvn clean package -DskipTests

# ============================================================================
# Stage 2: Lightweight Production Runtime with Temurin JRE 21
# ============================================================================
FROM eclipse-temurin:21-jre-jammy
WORKDIR /app

# Create unprivileged application user
RUN addgroup --system spring && adduser --system spring --ingroup spring
USER spring:spring

# Copy packaged jar from build stage
COPY --from=build /app/target/*.jar app.jar

# Render exposes $PORT dynamically (defaults to 8080)
EXPOSE 8080

ENV SPRING_PROFILES_ACTIVE=prod
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -Dserver.port=${PORT:-8080} -jar app.jar"]
