import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";
import { CameraButton } from "@/components/camera/CameraButton";
import { CookieBanner } from "@/components/CookieBanner";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Upload from "./pages/Upload";
import Review from "./pages/Review";
import Expenses from "./pages/Expenses";
import BankImport from "./pages/BankImport";
import Reconciliation from "./pages/Reconciliation";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import ShareReceive from "./pages/ShareReceive";
import Checklists from "./pages/Checklists";
import Datenschutz from "./pages/Datenschutz";
import Onboarding from "./pages/Onboarding";
import Invoices from "./pages/Invoices";
import InvoiceEditor from "./pages/InvoiceEditor";
import Quotes from "./pages/Quotes";
import Account from "./pages/Account";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/upload" 
              element={
                <ProtectedRoute>
                  <Upload />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/review" 
              element={
                <ProtectedRoute>
                  <Review />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/expenses" 
              element={
                <ProtectedRoute>
                  <Expenses />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reconciliation" 
              element={
                <ProtectedRoute>
                  <Reconciliation />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/bank-import" 
              element={
                <ProtectedRoute>
                  <BankImport />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/reports" 
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/settings" 
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/checklists" 
              element={
                <ProtectedRoute>
                  <Checklists />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/onboarding" 
              element={
                <ProtectedRoute skipOnboardingCheck>
                  <Onboarding />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/invoices" 
              element={
                <ProtectedRoute>
                  <Invoices />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/invoices/new" 
              element={
                <ProtectedRoute>
                  <InvoiceEditor />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/invoices/:id/edit" 
              element={
                <ProtectedRoute>
                  <InvoiceEditor />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/account" 
              element={
                <ProtectedRoute>
                  <Account />
                </ProtectedRoute>
              } 
            />
            <Route path="/share-receive" element={<ShareReceive />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/datenschutz" element={<Datenschutz />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <InstallPrompt />
          <CameraButton />
          <CookieBanner />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
