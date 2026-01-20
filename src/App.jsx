import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';
import Home from './pages/Home/Home';
import Services from './pages/Services';
import About from './pages/Home/About';
import Contact from './pages/Contact';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import LifeCarePlan from './pages/Home/LifeCarePlan';
import MedicalCostProjection from './pages/Home/MedicalCostProjection';
import CostProjection from './pages/Home/costprojection';
import OperationsDashboard from './pages/Dashboard/OperationsDashboard';
import Footer from './components/Footer';
import AWSConfigChecker from './components/AWSConfigChecker';
import MCPProgressPage from './pages/Dashboard/MCPProgresspage';
import LCPProgressPage from './pages/Dashboard/LCPProgresspage';



function App() {
  return (
    <Router>
      <AuthProvider>
        <ScrollToTop />
        <div className="min-h-screen flex flex-col">
          <main className="flex-grow">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/services" element={<Services />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/lifecareplan" element={<LifeCarePlan />} />
              <Route path="/medicalcostprojection" element={<MedicalCostProjection />} />
              <Route path="/costprojection" element={<CostProjection />} />
              <Route path="/mcp-progress" element={<MCPProgressPage />} />
              <Route path="/lcp-progress" element={<LCPProgressPage />} />


              <Route
                path="/operations"
                element={
                  <ProtectedRoute>
                    <OperationsDashboard />
                  </ProtectedRoute>
                }
              />

            </Routes>
          </main>
          <Footer />
          <AWSConfigChecker />
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
