# Imagem única do sistema: o front (React/Vite) é compilado e servido pela API ASP.NET Core,
# na mesma origem. O n8n fica fora desta imagem e fala com ela só pela API.

# ---- Front ----
FROM node:22-alpine AS client
WORKDIR /src/metup.client
COPY metup.client/package.json metup.client/package-lock.json ./
RUN npm ci
COPY metup.client/ ./
RUN npm run build

# ---- Back ----
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS server
WORKDIR /src
COPY Metup.Domain/Metup.Domain.csproj Metup.Domain/
COPY Metup.Application/Metup.Application.csproj Metup.Application/
COPY Metup.Infrastructure/Metup.Infrastructure.csproj Metup.Infrastructure/
COPY Metup.Server/Metup.Server.csproj Metup.Server/
RUN dotnet restore Metup.Server/Metup.Server.csproj
COPY Metup.Domain/ Metup.Domain/
COPY Metup.Application/ Metup.Application/
COPY Metup.Infrastructure/ Metup.Infrastructure/
COPY Metup.Server/ Metup.Server/
RUN dotnet publish Metup.Server/Metup.Server.csproj -c Release -o /app --no-restore

# ---- Runtime ----
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_ENVIRONMENT=Production \
    ASPNETCORE_HTTP_PORTS=8080 \
    DOTNET_RUNNING_IN_CONTAINER=true
COPY --from=server /app ./
COPY --from=client /src/metup.client/dist ./wwwroot
EXPOSE 8080
# Usuário sem privilégios que já vem na imagem oficial.
USER $APP_UID
ENTRYPOINT ["dotnet", "Metup.Server.dll"]
