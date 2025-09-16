import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import {
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import DashboardPage from "./routes/dashboard.tsx";
import MovimentacoesPage from "./routes/movimentacoes.tsx";
import RelatoriosPage from "./routes/relatorios.tsx";
import HomePage from "./routes/home.tsx";
import { Navigation } from "./components/Navigation.tsx";
import LoggedProvider from "./components/logged-provider.tsx";
import { Toaster } from "sonner";

import "./styles.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const rootRoute = createRootRoute({
  component: () => (
    <LoggedProvider>
      <div className="min-h-screen bg-background">
        <Navigation />
        <Outlet />
      </div>
    </LoggedProvider>
  ),
});

const routeTree = rootRoute.addChildren([
  DashboardPage(rootRoute), // Rota principal / 
  MovimentacoesPage(rootRoute),
  RelatoriosPage(rootRoute),
  HomePage(rootRoute), // Sistema antigo em /legacy
]);

const queryClient = new QueryClient();

const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        <Toaster />
      </QueryClientProvider>
    </StrictMode>,
  );
}
