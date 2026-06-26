import { ErrorBoundary } from "@/components/common/ErrorBoundary"
import AppRoutes from "./routes"

function App() {
  return (
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
  )
}

export default App
