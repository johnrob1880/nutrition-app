import { Route, Switch } from 'wouter';
import { AuthGuard } from '@/components/AuthGuard';
import { Landing } from '@/pages/Landing';
import { Login } from '@/pages/Login';
import { Register } from '@/pages/Register';
import { VerifyEmail } from '@/pages/VerifyEmail';
import { Dashboard } from '@/pages/Dashboard';
import { Invitations } from '@/pages/Invitations';
import { Clients } from '@/pages/Clients';

function App() {
  return (
    <div className="App">
      <Switch>
        {/* Public routes - redirect to dashboard if already authenticated */}
        <Route path="/login">
          <AuthGuard requireAuth={false}>
            <Login />
          </AuthGuard>
        </Route>
        
        <Route path="/register">
          <AuthGuard requireAuth={false}>
            <Register />
          </AuthGuard>
        </Route>

        <Route path="/verify-email">
          <AuthGuard requireAuth={false}>
            <VerifyEmail />
          </AuthGuard>
        </Route>

        {/* Protected routes - require authentication and consultant role */}
        <Route path="/dashboard">
          <AuthGuard>
            <Dashboard />
          </AuthGuard>
        </Route>
        
        <Route path="/invitations">
          <AuthGuard>
            <Invitations />
          </AuthGuard>
        </Route>
        
        <Route path="/clients">
          <AuthGuard>
            <Clients />
          </AuthGuard>
        </Route>

        {/* Landing page */}
        <Route path="/">
          <AuthGuard requireAuth={false}>
            <Landing />
          </AuthGuard>
        </Route>

        {/* 404 fallback */}
        <Route>
          <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Page Not Found</h2>
              <p className="text-gray-600 mb-4">The page you're looking for doesn't exist.</p>
              <a href="/dashboard" className="text-primary hover:underline">
                Go to Dashboard
              </a>
            </div>
          </div>
        </Route>
      </Switch>
    </div>
  );
}

export default App;