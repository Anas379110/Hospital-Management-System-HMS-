import OverviewPage from './pages/OverviewPage';
import AuditPage from './pages/AuditPage';
import UsersPage from './pages/UsersPage';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import PatientsPage from './pages/PatientsPage';
import NewPatientPage from './pages/NewPatientPage';
import EditPatientPage from './pages/EditPatientPage';
import PatientDetailPage from './pages/PatientDetailPage';
import AppointmentsPage from './pages/AppointmentsPage';
import DepartmentsPage from './pages/DepartmentsPage';
import PharmacyPage from './pages/PharmacyPage';
import LabPage from './pages/LabPage';
import BillingPage from './pages/BillingPage';
import ProtectedRoute, { RoleLanding } from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route element={<ProtectedRoute />}>
            <Route element={<ProtectedRoute page="overview" />}><Route path="/overview" element={<OverviewPage />} /></Route>
            <Route element={<ProtectedRoute page="patients" />}><Route path="/patients" element={<PatientsPage />} /></Route>
            <Route element={<ProtectedRoute page="registration" />}><Route path="/patients/new" element={<NewPatientPage />} /><Route path="/patients/:id/edit" element={<EditPatientPage />} /></Route>
            <Route element={<ProtectedRoute page="patients" />}><Route path="/patients/:id" element={<PatientDetailPage />} /></Route>
            <Route element={<ProtectedRoute page="appointments" />}><Route path="/appointments" element={<AppointmentsPage />} /></Route>
            <Route element={<ProtectedRoute page="departments" />}><Route path="/departments" element={<DepartmentsPage />} /></Route>
            <Route element={<ProtectedRoute page="pharmacy" />}><Route path="/pharmacy" element={<PharmacyPage />} /></Route>
            <Route element={<ProtectedRoute page="lab" />}><Route path="/lab" element={<LabPage />} /></Route>
            <Route element={<ProtectedRoute page="billing" />}><Route path="/billing" element={<BillingPage />} /></Route>
            <Route element={<ProtectedRoute page="audit" />}><Route path="/audit" element={<AuditPage />} /></Route>
            <Route element={<ProtectedRoute page="users" />}><Route path="/users" element={<UsersPage />} /></Route>
            <Route path="/" element={<RoleLanding />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
