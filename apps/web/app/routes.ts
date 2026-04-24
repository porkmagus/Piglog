import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  index("routes/_index.tsx"),
  route("login", "routes/login.tsx"),
  route("onboarding", "routes/onboarding.tsx"),
  layout("routes/_layout.tsx", [
    route("dashboard", "routes/_layout.dashboard.tsx"),
    route("settings", "routes/_layout.settings.tsx", [
      index("routes/_layout.settings._index.tsx"),
<<<<<<< HEAD
      route("account", "routes/_layout.settings.account.tsx"),
      route("workspace", "routes/_layout.settings.workspace.tsx"),
      route("ingestion", "routes/_layout.settings.ingestion.tsx"),
      route("keys", "routes/_layout.settings.keys.tsx"),
      route("sources", "routes/_layout.settings.sources.tsx"),
      route("alerts", "routes/_layout.settings.alerts.tsx"),
      route("team", "routes/_layout.settings.team.tsx"),
    ]),
    route("streams", "routes/_layout.streams._index.tsx"),
    route("streams/:streamId", "routes/_layout.streams.$streamId.tsx"),
  ]),
] satisfies RouteConfig;
