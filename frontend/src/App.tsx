import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import PatientsPage from './pages/PatientsPage';
import NewPatientPage from './pages/NewPatientPage';
import PatientDetailPage from './pages/PatientDetailPage';
import AppointmentsPage from './pages/AppointmentsPage';
import DepartmentsPage from './pages/DepartmentsPage';
import PharmacyPage from './pages/PharmacyPage';
import LabPage from './pages/LabPage';
import BillingPage from './pages/BillingPage';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route element={<ProtectedRoute />}>
            <Route path="/patients" element={<PatientsPage />} />
            <Route path="/patients/new" element={<NewPatientPage />} />
            <Route path="/patients/:id" element={<PatientDetailPage />} />
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/departments" element={<DepartmentsPage />} />
            <Route path="/pharmacy" element={<PharmacyPage />} />
            <Route path="/lab" element={<LabPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/" element={<Navigate to="/patients" replace />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
